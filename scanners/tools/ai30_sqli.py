"""
SQL Injection Scanner wrapper for AI 30 Days integration
"""
import os
import sys
import subprocess
import json
from typing import List, Dict, Any

# Add AI 30 Days path
AI30_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "AI 30 Days")
sys.path.insert(0, AI30_PATH)

from ..engine import register_tool, ToolContext


@register_tool("sqli_scanner", category="injection", scope=["WEB", "API", "FULL"])
def run_sqli_scanner(ctx: ToolContext) -> List[Dict[str, Any]]:
    """
    Deep SQL Injection Scanner
    
    Detects:
    - Error-based SQL injection
    - Time-based blind SQL injection
    - Union-based SQL injection
    - Boolean-based blind SQL injection
    - WAF bypass techniques
    """
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
            module = _safe_import_ai30_script("sqli_scanner_pro.py")
            scanner = module.SQLiScanner(target)
            results = scanner.run()
            
            for vuln in results.get("vulnerabilities", []):
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
            findings.append(_finding(
                title="SQL Injection Scanner - Script Not Found",
                description="The sqli_scanner_pro.py script was not found.",
                severity="INFO",
                remediation="Ensure the AI 30 Days scripts are properly installed.",
                evidence={"target": target},
            ))
        except Exception as e:
            findings.append(_finding(
                title="SQL Injection Scanner Error",
                description=f"Scanner encountered an error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration and target accessibility.",
                evidence={"error": str(e), "target": target},
            ))
            
        return findings
