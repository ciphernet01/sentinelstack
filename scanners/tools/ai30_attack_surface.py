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
        "toolName": "AttackSurface Pro+",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "OWASP-A05-2021"],
    }


@register_tool("ai30_attack_surface")
class AI30AttackSurface:
    """AttackSurface Pro+ wrapper (conservative).

    The upstream AI30 tool tests multiple HTTP methods, including DELETE.
    For safety we force GET-only and cap the path set.

    - Suppresses stdout/stderr to preserve stdout JSON contract.
    - Gated behind authorizationConfirmed because it performs active probing.
    """

    name = "ai30_attack_surface"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="AttackSurface Pro+ skipped (authorization not confirmed)",
                    description=(
                        "AttackSurface Pro+ performs active exposure probing across common public/user/admin/internal paths. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable attack surface probing.",
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
            module = _safe_import_ai30_script("attack_surface_pro_plus.py")
            scanner_cls = getattr(module, "AttackSurfaceProPlus", None)
            if scanner_cls is None:
                raise AttributeError("AttackSurfaceProPlus not found")

            # Force safe-ish behavior.
            # GET only to avoid triggering destructive side effects.
            setattr(module, "HTTP_METHODS", ["GET"])

            # Reduce paths a bit (still covers common exposures).
            setattr(module, "PUBLIC_PATHS", ["/", "/health", "/status"])
            setattr(module, "USER_PATHS", ["/profile", "/account", "/settings", "/api/user", "/api/profile"])
            setattr(module, "ADMIN_PATHS", ["/admin", "/api/admin", "/admin/users"])
            setattr(module, "INTERNAL_PATHS", ["/internal", "/_internal", "/debug", "/metrics", "/actuator/health", "/.env"])

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = scanner_cls(base_url, threads=6)
                raw = scanner.run()

            findings: List[Dict[str, Any]] = []
            for item in raw or []:
                if not isinstance(item, dict):
                    continue

                score = int(item.get("score") or 0)
                severity = _normalize_severity(item.get("severity") or "INFO")
                if score < 40 and severity in {"INFO", "LOW"}:
                    continue

                category = item.get("category")
                behavior = item.get("behavior")
                risk = item.get("risk")

                title = "Attack surface exposure detected"
                if category and behavior:
                    title = f"Attack surface: {category} path {behavior.replace('_', ' ')}"

                findings.append(
                    _finding(
                        title=title,
                        description=(
                            "Automated probing suggests an exposed endpoint that may violate intended trust boundaries. "
                            "Validate whether the resource should be publicly accessible."
                        ),
                        severity=severity,
                        remediation=(
                            "- Require authentication/authorization for non-public endpoints.\n"
                            "- Restrict internal/admin paths at the edge (WAF/CDN) and via network controls.\n"
                            "- Remove debug/metrics endpoints from public exposure."
                        ),
                        evidence={
                            "url": item.get("url"),
                            "path": item.get("path"),
                            "method": item.get("method"),
                            "category": category,
                            "behavior": behavior,
                            "risk": risk,
                            "unauthStatus": item.get("unauth_status"),
                            "score": score,
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="AttackSurface Pro+ failed",
                    description="AttackSurface Pro+ could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies (requests) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
