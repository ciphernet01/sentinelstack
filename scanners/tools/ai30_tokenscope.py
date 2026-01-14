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
        "toolName": "TokenScope Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A07-2021", "OWASP-A01-2021"],
    }


def _remediation_text() -> str:
    return (
        "Enforce strict token validation: verify signature, issuer (iss), audience (aud), and time-based claims (exp/nbf/iat). "
        "Reject weak/none algorithms, rotate signing keys, enforce short TTL, and implement replay protections (jti + server-side tracking for high-risk operations)."
    )


@register_tool("ai30_tokenscope")
class AI30TokenScope:
    """TokenScope Pro (Enterprise) wrapper.

    Uses the AI30 implementation (tokenscope_pro2.py) in a non-interactive mode:
    - Silences all tool prints to preserve stdout JSON contract.
    - Does not write AI30 report files.
    - Gated behind authorizationConfirmed because it performs active requests and safe mutation testing.
    """

    name = "ai30_tokenscope"
    supported_scopes = ["AUTH", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="TokenScope Pro skipped (authorization not confirmed)",
                    description=(
                        "TokenScope Pro performs active token discovery and enforcement testing. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable token enforcement testing.",
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
            module = _safe_import_ai30_script("tokenscope_pro2.py")
            scanner_cls = getattr(module, "TokenScopePro", None)
            if scanner_cls is None:
                raise AttributeError("TokenScopePro not found")

            # Keep it conservative: fewer threads; endpoints are baked into the AI30 script.
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = scanner_cls(base_url=target, threads=2)
                raw = scanner.run()

            findings: List[Dict[str, Any]] = []
            for item in raw or []:
                if not isinstance(item, dict):
                    continue

                score = int(item.get("score") or 0)
                if score < 30:
                    continue

                severity = _normalize_severity(item.get("severity", "INFO"))
                classification = item.get("classification") or []
                violations = item.get("enforcement_violations") or []
                replay = bool(item.get("replay_detected"))

                title_bits: List[str] = []
                if violations:
                    title_bits.append("Token enforcement violations")
                if replay:
                    title_bits.append("Replay vulnerability")
                if not title_bits:
                    title_bits.append("Token security issues")

                title = f"TokenScope Pro: {', '.join(title_bits)}"

                findings.append(
                    _finding(
                        title=title,
                        description=(
                            "Token analysis indicates potential weaknesses in token claim validation and/or enforcement. "
                            "Review evidence for detected violations and replay behavior."
                        ),
                        severity=severity,
                        remediation=_remediation_text(),
                        evidence={
                            "url": item.get("url"),
                            "path": item.get("path"),
                            "method": item.get("method"),
                            "score": score,
                            "classification": classification,
                            "tokenType": item.get("token_type"),
                            "tokenAlgorithm": item.get("token_algorithm"),
                            "enforcementViolations": violations,
                            "replayDetected": replay,
                            "owaspReferences": item.get("owasp_references") or [],
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="TokenScope Pro failed",
                    description="TokenScope Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies and retry.",
                    evidence={"error": str(exc)},
                )
            ]
