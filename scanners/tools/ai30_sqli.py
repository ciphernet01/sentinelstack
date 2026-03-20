"""SQL Injection Scanner wrapper for AI 30 Days integration"""
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
        "toolName": "SQL Injection Scanner Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A03-2021", "CWE-89"],
    }


@register_tool("sqli_scanner")
class SQLiScannerTool:
    """Deep SQL Injection Scanner - detects various SQL injection vulnerabilities"""
    
    name = "sqli_scanner"
    supported_scopes = ["WEB", "API", "FULL"]
    
    def run(self, ctx) -> List[Dict[str, Any]]:
        # Require authorization for active injection testing
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="SQL Injection Scanner skipped (authorization not confirmed)",
                    description="This tool performs active SQL injection testing. It is disabled unless scan authorization is explicitly confirmed.",
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true to enable active SQL injection testing.",
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
            module = safe_import_ai30_script("sqli_scanner_pro.py")
            scanner_cls = getattr(module, "SQLiScanner", None)
            if scanner_cls is None:
                raise AttributeError("SQLiScanner class not found")
            
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                scanner = scanner_cls(target)
                results = scanner.run()
            
            for vuln in results.get("vulnerabilities", []):
                # Validate the finding has actual evidence
                if not vuln.get("parameter") and not vuln.get("payload"):
                    continue  # Skip findings without proof
                
                findings.append(_finding(
                    title=f"SQL Injection - {vuln.get('type', 'Generic')}",
                    description=f"SQL injection vulnerability detected using {vuln.get('technique', 'unknown')} technique.",
                    severity=vuln.get("severity", "HIGH"),
                    remediation="Use parameterized queries or prepared statements. Never concatenate user input into SQL queries.",
                    evidence={
                        "url": vuln.get("url", target),
                        "parameter": vuln.get("parameter"),
                        "payload": vuln.get("payload"),
                        "technique": vuln.get("technique"),
                        "database_type": vuln.get("database_type"),
                    },
                ))
                
        except FileNotFoundError:
            # Script not found - not an error, just skip
            pass
        except Exception as e:
            findings.append(_finding(
                title="SQL Injection Scanner Error",
                description=f"Scanner encountered an error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration and target accessibility.",
                evidence={"error": str(e), "target": target},
            ))
            
        return findings
