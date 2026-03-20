from __future__ import annotations

import io
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List

from scanners.engine.registry import register_tool
from scanners.tools._safe_import import safe_import_ai30_script


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "Threat Intelligence Aggregator Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A09-2021"],
    }


def _risk_level_to_severity(level: str) -> str:
    lvl = str(level or "").strip().upper()
    if lvl == "MALICIOUS":
        return "HIGH"
    if lvl == "SUSPICIOUS":
        return "MEDIUM"
    if lvl == "LOW-RISK":
        return "LOW"
    return "INFO"


@register_tool("ai30_threat_intel")
class AI30ThreatIntel:
    """Threat Intel Aggregator Pro wrapper.

    File-based: provide one of:
    - SENTINEL_THREAT_INTEL_PATHS: comma-separated files/folders to scan for IPs
    - SENTINEL_THREAT_INTEL_IPS: comma-separated IPs to score
    """

    name = "ai30_threat_intel"
    supported_scopes = ["WEB", "API", "AUTH", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        raw_paths = os.getenv("SENTINEL_THREAT_INTEL_PATHS", "").strip()
        raw_ips = os.getenv("SENTINEL_THREAT_INTEL_IPS", "").strip()

        if not raw_paths and not raw_ips:
            return [
                _finding(
                    title="Threat Intel Aggregator Pro skipped (no inputs provided)",
                    description=(
                        "This tool scores IPs extracted from local files/folders (logs/reports) or provided manually. "
                        "No paths or IPs were provided to the scanner runtime."
                    ),
                    severity="INFO",
                    remediation=(
                        "Set SENTINEL_THREAT_INTEL_PATHS (files/folders) or SENTINEL_THREAT_INTEL_IPS (comma-separated IPs) "
                        "inside the scanner runtime and rerun the assessment."
                    ),
                    evidence={"env": ["SENTINEL_THREAT_INTEL_PATHS", "SENTINEL_THREAT_INTEL_IPS"]},
                )
            ]

        try:
            module = safe_import_ai30_script("threat_intel_aggregator_pro.py")

            analyze_ips = getattr(module, "analyze_ips", None)
            extract_ips_from_text = getattr(module, "extract_ips_from_text", None)
            guess_country_from_asn = getattr(module, "guess_country_from_asn", None)
            if analyze_ips is None or extract_ips_from_text is None or guess_country_from_asn is None:
                raise AttributeError("Required functions not found")

            from collections import Counter

            all_ips = Counter()

            # Manual IPs
            if raw_ips:
                for ip in [p.strip() for p in raw_ips.split(",") if p.strip()]:
                    all_ips[ip] += 1

            # Scan provided paths (best-effort, capped)
            max_files = int(os.getenv("SENTINEL_THREAT_INTEL_MAX_FILES", "200") or "200")
            max_files = max(10, min(max_files, 1000))
            max_bytes = int(os.getenv("SENTINEL_THREAT_INTEL_MAX_BYTES", str(2 * 1024 * 1024)) or str(2 * 1024 * 1024))
            max_bytes = max(64 * 1024, min(max_bytes, 10 * 1024 * 1024))

            def scan_file_limited(path: Path) -> None:
                try:
                    with path.open("r", errors="ignore") as f:
                        content = f.read(max_bytes)
                    for ip in extract_ips_from_text(content):
                        all_ips[ip] += 1
                except Exception:
                    return

            def scan_folder_limited(folder: Path) -> None:
                count = 0
                for p in folder.rglob("*"):
                    if count >= max_files:
                        break
                    if not p.is_file():
                        continue
                    if p.suffix.lower() not in {".txt", ".log", ".json"}:
                        continue
                    scan_file_limited(p)
                    count += 1

            if raw_paths:
                for p in [x.strip() for x in raw_paths.split(",") if x.strip()][:20]:
                    path = Path(p)
                    if path.is_dir():
                        scan_folder_limited(path)
                    elif path.is_file():
                        scan_file_limited(path)

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                results = analyze_ips(all_ips)

            # Emit only suspicious+.
            findings: List[Dict[str, Any]] = []
            for ip, data in (results or {}).items():
                level = str((data or {}).get("risk_level") or "")
                severity = _risk_level_to_severity(level)
                if severity not in {"HIGH", "MEDIUM"}:
                    continue

                findings.append(
                    _finding(
                        title=f"Potentially malicious IP identified ({level})",
                        description=(
                            "Heuristic threat scoring flagged an IP as suspicious/malicious based on activity volume and patterns. "
                            "Validate in your SIEM/WAF logs and consider blocking if confirmed."
                        ),
                        severity=severity,
                        remediation=(
                            "Investigate the IP in access logs and authentication logs; apply WAF/rate limits; "
                            "block the IP if confirmed malicious; alert on reoccurrence."
                        ),
                        evidence={
                            "ip": ip,
                            "count": (data or {}).get("counts"),
                            "asn": (data or {}).get("asn"),
                            "country": (data or {}).get("country"),
                            "risk": {
                                "score": (data or {}).get("risk_score"),
                                "level": (data or {}).get("risk_level"),
                                "reasons": (data or {}).get("risk_reasons"),
                            },
                        },
                    )
                )

            if not findings and all_ips:
                return [
                    _finding(
                        title="Threat intel scan completed (no suspicious IPs)",
                        description="Heuristic threat scoring did not flag any IPs as suspicious/malicious.",
                        severity="INFO",
                        remediation="Continue monitoring and periodically rescore IPs from fresh logs.",
                        evidence={"uniqueIps": len(all_ips)},
                    )
                ]

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="Threat Intel Aggregator Pro failed",
                    description="Threat Intel Aggregator Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the AI30 script exists and rerun with SENTINEL_THREAT_INTEL_PATHS/IPs set.",
                    evidence={"error": str(exc)},
                )
            ]
