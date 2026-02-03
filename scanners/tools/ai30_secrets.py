"""Secret Scanner wrapper for AI 30 Days integration"""
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
        "toolName": "Secret Scanner Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A07-2021", "CWE-798"],
    }


@register_tool("secret_scanner")
class SecretScannerTool:
    """Deep Secret Scanner - detects exposed credentials, API keys, tokens"""
    
    name = "secret_scanner"
    supported_scopes = ["WEB", "API", "FULL"]
    
    def run(self, ctx) -> List[Dict[str, Any]]:
        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        
        try:
            module = _safe_import_ai30_script("secret_scanner_pro.py")
            scanner = module.SecretScanner(target)
            results = scanner.run()
            
            for secret in results.get("secrets_found", []):
                secret_type = secret.get("type", "unknown").replace("_", " ").title()
                severity = "CRITICAL"
                if secret.get("type") in ["jwt", "base64_data"]:
                    severity = "HIGH"
                elif secret.get("type") in ["api_endpoint", "internal_url"]:
                    severity = "MEDIUM"
                
                findings.append(_finding(
                    title=f"Exposed {secret_type}",
                    description=f"Sensitive credential or secret detected: {secret_type}",
                    severity=severity,
                    remediation="Rotate the exposed credential immediately. Use environment variables or secret management.",
                    evidence={
                        "url": secret.get("url", target),
                        "secret_type": secret.get("type"),
                        "location": secret.get("location"),
                        "value_preview": (secret.get("value", "")[:15] + "...") if secret.get("value") else None,
                    },
                ))
            
            for path in results.get("sensitive_paths", []):
                findings.append(_finding(
                    title=f"Sensitive Path Accessible: {path.get('path')}",
                    description="A sensitive file or path is publicly accessible.",
                    severity="HIGH",
                    remediation="Restrict access to sensitive files. Add authentication or remove from public access.",
                    evidence={"path": path.get("path"), "status_code": path.get("status_code")},
                ))
                
        except FileNotFoundError:
            pass  # Script not available
        except Exception as e:
            findings.append(_finding(
                title="Secret Scanner Error",
                description=f"Scanner error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration.",
                evidence={"error": str(e)},
            ))
            
        return findings
