from __future__ import annotations

import io
import os
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
        "toolName": "AuthShield Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A07-2021", "OWASP-A02-2021"],
    }


@register_tool("ai30_authshield")
class AI30AuthShield:
    """AuthShield Pro wrapper (observation-only, non-destructive).

    Notes:
    - Non-destructive: observes auth endpoints, session cookies, and security headers only.
    - Does NOT test credentials or perform active authentication attacks.
    - Suppresses stdout/stderr to preserve scanner JSON-only stdout contract.
    - Runs without authorizationConfirmed gate because it's read-only.
    """

    name = "ai30_authshield"
    supported_scopes = ["AUTH", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        base_url = str(ctx.target or "").strip()
        if not base_url:
            return []

        if not base_url.startswith("http://") and not base_url.startswith("https://"):
            base_url = "https://" + base_url

        parsed = urlparse(base_url)
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

        # Conservative defaults
        threads = int(os.getenv("SENTINEL_AUTHSHIELD_THREADS", "3") or "3")
        threads = max(1, min(threads, 6))

        try:
            module = _safe_import_ai30_script("authshield_pro.py")

            AuthAuditPro = getattr(module, "AuthAuditPro", None)
            if AuthAuditPro is None:
                raise AttributeError("AuthAuditPro not found")

            tool = AuthAuditPro(base_url, threads=threads)

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                raw_findings = tool.run() or []

            # Process findings
            findings: List[Dict[str, Any]] = []
            for f in raw_findings:
                score = int(f.get("score") or 0)
                severity_raw = str(f.get("severity") or "INFO")
                severity = _normalize_severity(severity_raw)

                # Filter low-signal findings
                if score < 10:
                    continue

                url = f.get("url")
                config_issues = f.get("configuration_issues") or []
                best_practice_violations = f.get("best_practice_violations") or []
                recommendations = f.get("security_recommendations") or []
                cookie_attrs = f.get("cookie_attributes") or {}
                missing_headers = f.get("security_headers_missing") or []

                findings.append(
                    _finding(
                        title=f"Authentication configuration issue detected ({severity})",
                        description=(
                            "AuthShield analysis identified authentication or session security configuration weaknesses. "
                            "Review cookie attributes, security headers, and session management practices."
                        ),
                        severity=severity,
                        remediation=(
                            "Enable HttpOnly/Secure/SameSite flags on session cookies; "
                            "implement security headers (HSTS, CSP, X-Frame-Options); "
                            "enforce HTTPS; implement CSRF protection; ensure proper logout handling."
                        ),
                        evidence={
                            "url": url,
                            "score": score,
                            "configurationIssues": config_issues,
                            "bestPracticeViolations": best_practice_violations,
                            "recommendations": recommendations,
                            "cookieAttributes": cookie_attrs,
                            "missingSecurityHeaders": missing_headers,
                        },
                    )
                )

            if not findings and raw_findings:
                return [
                    _finding(
                        title="AuthShield analysis completed (no significant issues)",
                        description="AuthShield observed authentication endpoints but found no significant configuration issues.",
                        severity="INFO",
                        remediation="Continue monitoring authentication security and session management practices.",
                        evidence={"endpointsAnalyzed": len(raw_findings)},
                    )
                ]

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="AuthShield Pro failed",
                    description="AuthShield Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies (requests) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
