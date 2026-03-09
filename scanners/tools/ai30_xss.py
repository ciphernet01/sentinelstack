"""XSS Scanner wrapper for AI 30 Days integration"""
from __future__ import annotations

import io
from contextlib import redirect_stderr, redirect_stdout
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
        "toolName": "XSS Scanner Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A03-2021", "CWE-79"],
    }


@register_tool("xss_scanner")
class XSSScannerTool:
    """Deep XSS Scanner - detects reflected, DOM-based, and stored XSS"""
    
    name = "xss_scanner"
    supported_scopes = ["WEB", "FULL"]
    
    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="XSS Scanner skipped (authorization not confirmed)",
                    description="This tool performs active XSS testing. Disabled unless authorization is confirmed.",
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true to enable active XSS testing.",
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
            module = safe_import_ai30_script("xss_scanner_pro.py")
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = module.XSSScanner(target)
                results = scanner.run()
            
            for vuln in results.get("vulnerabilities", []):
                xss_type = vuln.get("xss_type", "generic").replace("_", " ").title()
                severity = "HIGH" if vuln.get("xss_type") in ["reflected", "dom_based"] else "MEDIUM"
                
                findings.append(_finding(
                    title=f"XSS Vulnerability - {xss_type}",
                    description=f"Cross-site scripting vulnerability detected in {vuln.get('context', 'unknown')} context.",
                    severity=severity,
                    remediation="Implement proper output encoding. Use CSP. Sanitize all user inputs.",
                    evidence={
                        "url": vuln.get("url", target),
                        "parameter": vuln.get("parameter"),
                        "payload": vuln.get("payload"),
                        "context": vuln.get("context"),
                    },
                ))
            
            for sink in results.get("dom_sinks", []):
                findings.append(_finding(
                    title=f"Potential DOM XSS Sink: {sink.get('sink')}",
                    description="Dangerous DOM sink detected that could lead to XSS.",
                    severity="MEDIUM",
                    remediation="Avoid innerHTML, document.write. Use textContent instead.",
                    evidence={"sink": sink.get("sink"), "source": sink.get("source")},
                ))
                
        except FileNotFoundError:
            pass  # Script not available
        except Exception as e:
            findings.append(_finding(
                title="XSS Scanner Error",
                description=f"Scanner error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration.",
                evidence={"error": str(e)},
            ))
            
        return findings
