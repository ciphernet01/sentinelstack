from __future__ import annotations

import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

from scanners.engine.registry import register_tool


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _safe_import_ai30_script(script_filename: str):
    ai30_dir = _repo_root() / "AI 30 Days"
    script_path = ai30_dir / script_filename
    if not script_path.exists():
        raise FileNotFoundError(f"AI30 script not found: {script_path}")

    import importlib.util

    module_name = f"ai30_{script_filename.replace('.', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load spec for: {script_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "SessionGuard Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A07-2021", "OWASP-A01-2021"],
    }


@register_tool("ai30_sessionguard")
class AI30SessionGuard:
    """SessionGuard Pro wrapper.

    Runs the AI30 SessionGuardPro scanner non-interactively:
    - Suppresses stdout/stderr to preserve stdout JSON contract.
    - Uses conservative threading.
    - Gated behind authorizationConfirmed because it performs active requests and session flow probing.
    """

    name = "ai30_sessionguard"
    supported_scopes = ["AUTH", "WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="SessionGuard Pro skipped (authorization not confirmed)",
                    description=(
                        "SessionGuard Pro performs active session and cookie flow analysis. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable session security analysis.",
                    evidence={"authorizationConfirmed": False},
                )
            ]

        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        parsed = urlparse(target)
        if not parsed.scheme or not parsed.netloc:
            return [
                _finding(
                    title="Invalid target URL",
                    description=f"Target '{ctx.target}' is not a valid URL.",
                    severity="INFO",
                    remediation="Provide a fully qualified target URL (e.g., https://example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        try:
            module = _safe_import_ai30_script("sessionguard_pro.py")
            scanner_cls = getattr(module, "SessionGuardPro", None)
            if scanner_cls is None:
                raise AttributeError("SessionGuardPro not found")

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = scanner_cls(base_url=target, threads=2)
                raw_findings = scanner.run(
                    # Let AI30 defaults drive endpoint lists (already capped internally).
                    login_endpoints=None,
                    session_endpoints=None,
                )

            findings: List[Dict[str, Any]] = []
            for item in raw_findings or []:
                if not isinstance(item, dict):
                    continue

                score = int(item.get("score") or 0)
                severity = _normalize_severity(item.get("severity") or "INFO")

                # Filter out near-noise.
                if score < 25 and severity in {"INFO", "LOW"}:
                    continue

                vulns = item.get("vulnerabilities") or []
                missing_headers = item.get("security_headers_missing") or []

                title_bits: List[str] = []
                if item.get("session_fixation_detected"):
                    title_bits.append("session fixation signal")
                if item.get("session_reuse_after_logout"):
                    title_bits.append("session persists after logout")
                if missing_headers:
                    title_bits.append("missing security headers")
                if not title_bits and vulns:
                    title_bits.append("session hardening gaps")
                if not title_bits:
                    title_bits.append("session security observations")

                title = f"SessionGuard Pro: {', '.join(title_bits)}"

                remediation_lines: List[str] = [
                    "- Set session cookies with HttpOnly, Secure, and SameSite=strict/lax (as appropriate).",
                    "- Regenerate session identifiers on authentication and privilege changes.",
                    "- Invalidate sessions on logout server-side (token/session store revocation).",
                    "- Ensure TLS enforcement (HSTS) and add key security headers (CSP, X-Frame-Options, etc.).",
                ]

                findings.append(
                    _finding(
                        title=title,
                        description=(
                            "Automated analysis of session cookies, session flows, and security headers indicates potential session management weaknesses. "
                            "Review evidence for specific endpoints and detected issues."
                        ),
                        severity=severity,
                        remediation="\n".join(remediation_lines),
                        evidence={
                            "url": item.get("url"),
                            "path": item.get("path"),
                            "method": item.get("method"),
                            "score": score,
                            "sessionCookiesFound": item.get("session_cookies_found") or [],
                            "cookieAttributes": item.get("cookie_attributes") or {},
                            "sessionEntropyBits": item.get("session_entropy_bits"),
                            "sessionFixationDetected": bool(item.get("session_fixation_detected")),
                            "sessionReuseAfterLogout": bool(item.get("session_reuse_after_logout")),
                            "concurrentSessionsAllowed": bool(item.get("concurrent_sessions_allowed")),
                            "securityHeadersMissing": missing_headers,
                            "vulnerabilities": vulns,
                            "bestPracticeViolations": item.get("best_practice_violations") or [],
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="SessionGuard Pro failed",
                    description="SessionGuard Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies and retry.",
                    evidence={"error": str(exc)},
                )
            ]
