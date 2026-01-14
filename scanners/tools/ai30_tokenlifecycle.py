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
        "toolName": "TokenLifecycle Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A07-2021", "OWASP-A02-2021"],
    }


@register_tool("ai30_tokenlifecycle")
class AI30TokenLifecycle:
    """TokenLifecycle Pro wrapper (standard mode).

    Runs EnhancedTokenLifecyclePro with aggressive=False and a restricted endpoint set.
    This tool performs active token endpoint probing and may trigger auth flows, so it is gated.

    - Suppresses stdout/stderr to preserve stdout JSON contract.
    - Gated behind authorizationConfirmed.
    """

    name = "ai30_tokenlifecycle"
    supported_scopes = ["AUTH", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="TokenLifecycle Pro skipped (authorization not confirmed)",
                    description=(
                        "TokenLifecycle Pro performs active token endpoint discovery and lifecycle testing. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable token lifecycle analysis.",
                    evidence={"authorizationConfirmed": False},
                )
            ]

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
                    remediation="Provide a fully qualified target URL (e.g., https://api.example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        try:
            module = _safe_import_ai30_script("tokenlifecycle_pro.py")
            scanner_cls = getattr(module, "EnhancedTokenLifecyclePro", None)
            token_endpoints = list(getattr(module, "TOKEN_ENDPOINTS", []))

            if scanner_cls is None:
                raise AttributeError("EnhancedTokenLifecyclePro not found")

            # Keep it conservative: only first 2 known token endpoints.
            restricted_token_endpoints = (token_endpoints or [])[:2]

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = scanner_cls(base_url=base_url, threads=2, aggressive=False)
                raw = scanner.run(token_endpoints=restricted_token_endpoints)

            findings: List[Dict[str, Any]] = []
            for item in raw or []:
                if not isinstance(item, dict):
                    continue

                score = int(item.get("score") or 0)
                severity = _normalize_severity(item.get("severity") or "INFO")

                # Keep medium+ only.
                if score < 40:
                    continue

                vulns = item.get("vulnerabilities") or []
                recs = item.get("recommendations") or []

                title = "Token lifecycle weakness"
                if item.get("excessive_lifetime"):
                    title = "Token lifecycle: excessive token lifetime"
                elif item.get("refresh_token_reuse"):
                    title = "Token lifecycle: refresh token reuse"
                elif item.get("token_valid_after_logout"):
                    title = "Token lifecycle: token remains valid after logout"
                elif vulns:
                    title = f"Token lifecycle: {vulns[0].replace('_', ' ').lower()}"

                remediation = "\n".join([f"- {r}" for r in recs]) if recs else (
                    "- Enforce short-lived access tokens and rotate refresh tokens.\n"
                    "- Validate JWT claims (exp/nbf/iat, iss, aud) and reject weak algorithms.\n"
                    "- Revoke tokens on logout and sensitive events (password reset, privilege change)."
                )

                findings.append(
                    _finding(
                        title=title,
                        description=(
                            "Automated testing indicates potential weaknesses in token issuance, validation, or revocation. "
                            "Review evidence for token claim/lifetime issues and reuse behavior."
                        ),
                        severity=severity,
                        remediation=remediation,
                        evidence={
                            "url": item.get("url"),
                            "path": item.get("path"),
                            "method": item.get("method"),
                            "score": score,
                            "tokenType": item.get("token_type"),
                            "tokenAlgorithm": item.get("token_algorithm"),
                            "tokenLifetimeSeconds": item.get("token_lifetime_seconds"),
                            "missingClaims": {
                                "exp": bool(item.get("missing_exp")),
                                "iat": bool(item.get("missing_iat")),
                                "nbf": bool(item.get("missing_nbf")),
                            },
                            "flags": {
                                "excessiveLifetime": bool(item.get("excessive_lifetime")),
                                "refreshTokenPresent": bool(item.get("refresh_token_present")),
                                "refreshTokenReuse": bool(item.get("refresh_token_reuse")),
                                "refreshTokenRotation": bool(item.get("refresh_token_rotation")),
                                "tokenValidAfterLogout": bool(item.get("token_valid_after_logout")),
                                "refreshTokenValidAfterLogout": bool(item.get("refresh_token_valid_after_logout")),
                                "concurrentUseAllowed": bool(item.get("concurrent_use_allowed")),
                            },
                            "vulnerabilities": vulns,
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="TokenLifecycle Pro failed",
                    description="TokenLifecycle Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies and retry.",
                    evidence={"error": str(exc)},
                )
            ]
