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
        "toolName": "AuthZScope Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021"],
    }


@register_tool("ai30_authzscope")
class AI30AuthZScope:
    """AuthZScope Pro wrapper (GET-only).

    The upstream tool optionally POSTs to some endpoints. For safety we run GET-only
    via the underlying analyzer/scorer classes.

    - Suppresses stdout/stderr to preserve stdout JSON contract.
    - Gated behind authorizationConfirmed because it performs active probing.
    """

    name = "ai30_authzscope"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="AuthZScope Pro skipped (authorization not confirmed)",
                    description=(
                        "AuthZScope Pro performs active authorization boundary probing across common endpoints. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable authorization boundary analysis.",
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
                    remediation="Provide a fully qualified target URL (e.g., https://example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        try:
            module = _safe_import_ai30_script("authzscope_pro.py")
            analyzer_cls = getattr(module, "AuthorizationAnalyzer", None)
            scorer_cls = getattr(module, "AuthorizationScorer", None)
            default_endpoints = list(getattr(module, "AUTHORIZATION_ENDPOINTS", []))

            if analyzer_cls is None or scorer_cls is None:
                raise AttributeError("AuthorizationAnalyzer/AuthorizationScorer not found")

            # Cap endpoints to keep it quick and non-spammy.
            endpoints = (default_endpoints or [])[:10]

            analyzer = analyzer_cls(base_url)
            scorer = scorer_cls()

            raw: List[Dict[str, Any]] = []
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                for ep in endpoints:
                    url = analyzer.build_url(ep)
                    finding = analyzer.test_endpoint_authorization(url, "GET")
                    finding = scorer.score_finding(finding)
                    scorer.generate_recommendations(finding)
                    raw.append(finding)

            findings: List[Dict[str, Any]] = []
            for item in raw or []:
                if not isinstance(item, dict):
                    continue

                score = int(item.get("score") or 0)
                severity = _normalize_severity(item.get("severity") or "INFO")

                # Keep medium+ only to reduce noise.
                if score < 40:
                    continue

                endpoint = item.get("path") or item.get("url")
                title = "Authorization boundary weakness"
                if item.get("vertical_violation"):
                    title = "Authorization weakness: possible vertical privilege issue"
                elif item.get("horizontal_violation"):
                    title = "Authorization weakness: possible horizontal access issue"
                elif item.get("missing_authorization"):
                    title = "Authorization weakness: missing authorization enforcement"

                findings.append(
                    _finding(
                        title=title,
                        description=(
                            "Automated probing suggests authorization may not be enforced consistently for this endpoint. "
                            "Validate access behavior with real roles/identities and ensure server-side authorization checks." 
                        ),
                        severity=severity,
                        remediation=(
                            "- Enforce server-side authorization on every request, not just UI controls.\n"
                            "- Use centralized policy checks (RBAC/ABAC) and deny-by-default.\n"
                            "- Avoid trusting client-supplied role/user identifiers."
                        ),
                        evidence={
                            "url": item.get("url"),
                            "path": item.get("path"),
                            "method": item.get("method"),
                            "score": score,
                            "roleTested": item.get("role_tested"),
                            "authorizationBoundary": item.get("authorization_boundary"),
                            "statusCodes": item.get("status_codes") or [],
                            "flags": {
                                "missingAuthorization": bool(item.get("missing_authorization")),
                                "privilegeOverreach": bool(item.get("privilege_overreach")),
                                "roleInconsistency": bool(item.get("role_inconsistency")),
                                "boundaryLeakage": bool(item.get("boundary_leakage")),
                                "horizontalViolation": bool(item.get("horizontal_violation")),
                                "verticalViolation": bool(item.get("vertical_violation")),
                            },
                            "recommendations": item.get("recommendations") or [],
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="AuthZScope Pro failed",
                    description="AuthZScope Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies and retry.",
                    evidence={"error": str(exc)},
                )
            ]
