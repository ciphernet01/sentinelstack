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
        "toolName": "Broken Access Control Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021"],
    }


@register_tool("ai30_broken_access_control")
class AI30BrokenAccessControl:
    """Broken Access Control Pro wrapper.

    Imports and runs the exact AI30 script (broken_access_control_pro.py) non-interactively:
    - Suppresses stdout/stderr to preserve stdout JSON contract.
    - Uses conservative limits to reduce load.
    - Gated behind authorizationConfirmed because it performs active probing and tampering.
    """

    name = "ai30_broken_access_control"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="Broken Access Control Pro skipped (authorization not confirmed)",
                    description=(
                        "This tool performs active forced browsing, IDOR pattern probing, and request tampering. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable active access control testing.",
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
            module = _safe_import_ai30_script("broken_access_control_pro.py")
            scanner_cls = getattr(module, "EnhancedAccessControlScanner", None)
            scorer_cls = getattr(module, "EnhancedScorer", None)

            if scanner_cls is None or scorer_cls is None:
                raise AttributeError("EnhancedAccessControlScanner/EnhancedScorer not found")

            # Conservative defaults to reduce noise/load.
            threads = 4
            max_paths = 40
            pace = (0.05, 0.15)

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = scanner_cls(
                    base_url=target,
                    threads=threads,
                    aggressive=False,
                    pace=pace,
                    verify_ssl=True,
                )
                raw_findings = scanner.run(
                    forced_list=None,
                    idor_templates=None,
                    cookies=None,
                    extra_wordlist=None,
                    max_paths=max_paths,
                )

            findings: List[Dict[str, Any]] = []
            for item in raw_findings or []:
                if not isinstance(item, dict):
                    continue

                scored = scorer_cls.score_finding(dict(item))
                score = int(scored.get("score") or 0)
                severity = _normalize_severity(scored.get("severity") or "INFO")

                # Only keep HIGH+ findings (score >= 70) to reduce noise
                # This is enterprise-grade software - we want accuracy over volume
                if score < 70:
                    continue

                finding_type = scored.get("type") or "access_control"
                url = scored.get("url")
                status = scored.get("status")
                analysis = scored.get("analysis") or {}

                if finding_type == "idor":
                    title = "Broken Access Control: possible IDOR exposure"
                elif finding_type == "forced_browsing":
                    title = "Broken Access Control: forced browsing exposure"
                elif finding_type == "header_tampering":
                    title = "Broken Access Control: header tampering bypass signal"
                elif finding_type == "method_tampering":
                    title = "Broken Access Control: HTTP method tampering bypass signal"
                else:
                    title = "Broken Access Control: access control weakness"

                remediation_list = scorer_cls.generate_remediation(scored)
                remediation = "\n".join(f"- {r}" for r in (remediation_list or []))

                reasons = analysis.get("reasons") or []
                description = (
                    "Automated probing suggests an access control weakness. "
                    "Review evidence (status changes, unique content, or sensitive markers) to validate impact." 
                )

                findings.append(
                    _finding(
                        title=title,
                        description=description,
                        severity=severity,
                        remediation=remediation or "Implement consistent authorization checks server-side for every request.",
                        evidence={
                            "type": finding_type,
                            "url": url,
                            "status": status,
                            "score": score,
                            "analysis": {
                                "confidence": analysis.get("confidence"),
                                "reasons": reasons,
                                "indicators": analysis.get("indicators"),
                            },
                            "details": {
                                "path": scored.get("path"),
                                "template": scored.get("template"),
                                "testedId": scored.get("tested_id"),
                                "originalStatus": scored.get("original_status"),
                                "tamperedStatus": scored.get("tampered_status"),
                                "tamperedHeaders": scored.get("tampered_headers"),
                            },
                            "responseSample": (scored.get("response") or {}).get("sample"),
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="Broken Access Control Pro failed",
                    description="Broken Access Control Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies and retry.",
                    evidence={"error": str(exc)},
                )
            ]
