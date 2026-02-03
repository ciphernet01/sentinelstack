"""SSRF Scanner wrapper for AI 30 Days integration"""
from __future__ import annotations

import sys
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
        "toolName": "SSRF Scanner Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A10-2021", "CWE-918"],
    }


@register_tool("ssrf_scanner")
class SSRFScannerTool:
    """Deep SSRF Scanner - detects server-side request forgery vulnerabilities"""
    
    name = "ssrf_scanner"
    supported_scopes = ["WEB", "API", "FULL"]
    
    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="SSRF Scanner skipped (authorization not confirmed)",
                    description="This tool tests for SSRF including cloud metadata access. Disabled unless authorization confirmed.",
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true to enable SSRF testing.",
                    evidence={"authorizationConfirmed": False},
                )
            ]

        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        
        try:
            module = _safe_import_ai30_script("ssrf_scanner_pro.py")
            scanner = module.SSRFScanner(target)
            results = scanner.run()
            
            for finding in results.get("findings", []):
                findings.append(_finding(
                    title=finding.get("title", "SSRF Vulnerability"),
                    description=f"Server-side request forgery vulnerability detected.",
                    severity=finding.get("severity", "HIGH"),
                    remediation="Implement allowlists for URLs. Block internal IPs and cloud metadata endpoints.",
                    evidence={
                        "parameter": finding.get("parameter"),
                        "payload": finding.get("payload"),
                        "indicators": finding.get("indicators"),
                    },
                ))
            
            # Cloud metadata access is critical
            for metadata in results.get("cloud_metadata", []):
                if metadata.get("type") == "CLOUD_METADATA_ACCESS":
                    findings.append(_finding(
                        title=f"Cloud Metadata Access ({metadata.get('provider', 'Unknown')})",
                        description="SSRF allows access to cloud instance metadata - potential credential theft.",
                        severity="CRITICAL",
                        remediation="Block access to 169.254.169.254 and metadata endpoints.",
                        evidence={
                            "provider": metadata.get("provider"),
                            "parameter": metadata.get("parameter"),
                            "payload": metadata.get("payload"),
                        },
                    ))
                
        except FileNotFoundError:
            pass
        except Exception as e:
            findings.append(_finding(
                title="SSRF Scanner Error",
                description=f"Scanner error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration.",
                evidence={"error": str(e)},
            ))
            
        return findings
