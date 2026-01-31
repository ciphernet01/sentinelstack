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
    findings = []
    
    try:
        from sqli_scanner_pro import SQLiScanner
        
        scanner = SQLiScanner(ctx.target)
        results = scanner.run()
        
        for vuln in results.get("vulnerabilities", []):
            findings.append({
                "tool": "sqli_scanner",
                "type": "SQL_INJECTION",
                "title": f"SQL Injection - {vuln.get('type', 'Generic')}",
                "severity": vuln.get("severity", "HIGH"),
                "target": ctx.target,
                "url": vuln.get("url", ctx.target),
                "parameter": vuln.get("parameter"),
                "payload": vuln.get("payload"),
                "evidence": vuln.get("evidence"),
                "technique": vuln.get("technique"),
                "database_type": vuln.get("database_type"),
                "remediation": "Use parameterized queries or prepared statements. Never concatenate user input into SQL queries.",
                "cwe": "CWE-89",
                "owasp": "A03:2021 Injection",
            })
            
        # Add summary finding if vulnerabilities found
        if results.get("summary", {}).get("total_vulnerabilities", 0) > 0:
            findings.append({
                "tool": "sqli_scanner",
                "type": "SCAN_SUMMARY",
                "title": "SQL Injection Scan Summary",
                "severity": "INFO",
                "target": ctx.target,
                "details": results.get("summary"),
            })
            
    except ImportError:
        # Fallback to subprocess
        script_path = os.path.join(AI30_PATH, "sqli_scanner_pro.py")
        if os.path.exists(script_path):
            try:
                result = subprocess.run(
                    [sys.executable, script_path, "--target", ctx.target, "--json"],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                if result.stdout:
                    data = json.loads(result.stdout)
                    for vuln in data.get("vulnerabilities", []):
                        findings.append({
                            "tool": "sqli_scanner",
                            "type": "SQL_INJECTION",
                            "title": f"SQL Injection - {vuln.get('type', 'Generic')}",
                            "severity": vuln.get("severity", "HIGH"),
                            "target": ctx.target,
                            "url": vuln.get("url"),
                            "parameter": vuln.get("parameter"),
                            "payload": vuln.get("payload"),
                            "cwe": "CWE-89",
                        })
            except Exception as e:
                findings.append({
                    "tool": "sqli_scanner",
                    "type": "ERROR",
                    "title": "SQL Injection Scanner Error",
                    "severity": "INFO",
                    "details": str(e),
                })
    except Exception as e:
        findings.append({
            "tool": "sqli_scanner",
            "type": "ERROR",
            "title": "SQL Injection Scanner Error",
            "severity": "INFO",
            "details": str(e),
        })
        
    return findings
