from __future__ import annotations

import io
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List

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
        "toolName": "AI Log Analyzer Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A09-2021"],
    }


def _map_risk_level_to_severity(level: str) -> str:
    lvl = str(level or "").strip().upper()
    if lvl == "HIGH":
        return "HIGH"
    if lvl == "MEDIUM":
        return "MEDIUM"
    if lvl == "LOW":
        return "LOW"
    return "INFO"


@register_tool("ai30_log_analyzer")
class AI30LogAnalyzer:
    """Log Analyzer Pro wrapper.

    This is file-based, so it runs only if you provide log paths via env:
    - SENTINEL_LOG_ANALYZER_PATHS: comma-separated list of access.log paths
    """

    name = "ai30_log_analyzer"
    supported_scopes = ["WEB", "API", "AUTH", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        raw_paths = os.getenv("SENTINEL_LOG_ANALYZER_PATHS", "").strip()
        if not raw_paths:
            return [
                _finding(
                    title="AI Log Analyzer Pro skipped (no log paths provided)",
                    description=(
                        "This tool analyzes web server access logs (Apache/Nginx). "
                        "No log file paths were provided to the scanner runtime."
                    ),
                    severity="INFO",
                    remediation=(
                        "Set SENTINEL_LOG_ANALYZER_PATHS to a comma-separated list of log file paths "
                        "inside the scanner runtime (local or Docker) and rerun the assessment."
                    ),
                    evidence={"env": "SENTINEL_LOG_ANALYZER_PATHS"},
                )
            ]

        paths = [p.strip() for p in raw_paths.split(",") if p.strip()]
        if not paths:
            return []

        deep = os.getenv("SENTINEL_LOG_ANALYZER_DEEP", "0").strip().lower() in {"1", "true", "yes", "y"}

        try:
            module = _safe_import_ai30_script("log_analyzer_pro.py")
            analyze_log = getattr(module, "analyze_log", None)
            if analyze_log is None:
                raise AttributeError("analyze_log not found")

            findings: List[Dict[str, Any]] = []
            for path in paths[:10]:
                with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                    results = analyze_log(path, deep=deep)

                if not results:
                    findings.append(
                        _finding(
                            title="Log analysis failed or empty",
                            description="The log file could not be analyzed or contained no parsable entries.",
                            severity="INFO",
                            remediation="Verify the log path exists and is readable in the scanner runtime.",
                            evidence={"path": path},
                        )
                    )
                    continue

                score = int(results.get("risk_score") or 0)
                level = str(results.get("risk_level") or "INFO")
                severity = _map_risk_level_to_severity(level)

                if severity == "INFO":
                    continue

                findings.append(
                    _finding(
                        title=f"Suspicious activity detected in access logs ({level})",
                        description=(
                            "Log analysis detected patterns consistent with common attacks (SQLi/XSS/traversal/bruteforce) "
                            "or malicious scanner activity. Review the flagged IPs and requests."
                        ),
                        severity=severity,
                        remediation=(
                            "Block or rate-limit abusive IPs; enable WAF rules; harden auth endpoints; "
                            "monitor and alert on repeated anomalies; review SIEM/IDS integrations."
                        ),
                        evidence={
                            "path": path,
                            "risk": {"score": score, "level": level, "reasons": results.get("risk_reasons")},
                            "topIps": results.get("top_ips"),
                            "topAttackType": results.get("top_attack_type"),
                            "attackCounts": {k: int(v) for k, v in (results.get("attack_counts") or {}).items()},
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="AI Log Analyzer Pro failed",
                    description="AI Log Analyzer Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the AI30 script exists and rerun with SENTINEL_LOG_ANALYZER_PATHS set.",
                    evidence={"error": str(exc)},
                )
            ]
