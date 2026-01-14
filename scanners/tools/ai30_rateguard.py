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
        "toolName": "RateGuard Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A04-2021"],
    }


@register_tool("ai30_rateguard")
class AI30RateGuard:
    """Heavy/active rate limiting assessment.

    - Gated by `authorizationConfirmed`.
    - Runs in a conservative configuration (stealth profile, minimal endpoints/methods)
      to reduce disruption risk.
    """

    name = "ai30_rateguard"
    supported_scopes = ["API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="RateGuard Pro skipped (authorization not confirmed)",
                    description=(
                        "RateGuard Pro performs active burst testing which can impact service stability. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable active rate limit testing.",
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
                    remediation="Provide a fully qualified target URL (e.g., https://api.example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        try:
            module = _safe_import_ai30_script("rateguard_pro.py")
            enhanced_cls = getattr(module, "EnhancedRateGuard", None)
            if enhanced_cls is None:
                raise AttributeError("EnhancedRateGuard not found")

            # Keep it conservative: 1 endpoint, GET only, stealth profile.
            endpoints = ["/", "/api", "/api/v1"]
            methods = ["GET"]

            # Silence all tool prints to preserve stdout JSON contract.
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = enhanced_cls(base_url=target, threads=2, profile="stealth")
                try:
                    raw = scanner.run_scan(endpoints=endpoints, methods=methods)
                finally:
                    try:
                        scanner.close()
                    except Exception:
                        pass

            findings: List[Dict[str, Any]] = []
            for item in raw or []:
                if not isinstance(item, dict):
                    continue

                severity = _normalize_severity(item.get("severity", "INFO"))
                score = item.get("score")
                url = item.get("url")
                endpoint = item.get("endpoint")

                vulns = item.get("vulnerabilities") or []
                bypass = item.get("bypass_results") or []

                if severity in {"CRITICAL", "HIGH", "MEDIUM"}:
                    findings.append(
                        _finding(
                            title=f"Rate limiting weakness detected ({severity})",
                            description=(
                                "Active burst testing suggests the target may lack effective rate limiting or can be bypassed. "
                                "Review evidence for detected blocking signals, headers, and bypass behavior."
                            ),
                            severity=severity,
                            remediation=(
                                "Implement robust rate limiting (per user/token/IP), return 429 with Retry-After, and apply protections consistently across endpoints. "
                                "Block known bypass techniques and normalize request identifiers."
                            ),
                            evidence={
                                "url": url,
                                "endpoint": endpoint,
                                "score": score,
                                "analysis": item.get("analysis"),
                                "vulnerabilities": vulns,
                                "bypassResults": bypass,
                                "profile": item.get("profile"),
                            },
                        )
                    )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="RateGuard Pro failed",
                    description="RateGuard Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies and retry.",
                    evidence={"error": str(exc)},
                )
            ]
