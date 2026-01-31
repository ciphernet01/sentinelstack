"""
XSS Scanner wrapper for AI 30 Days integration
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


@register_tool("xss_scanner", category="injection", scope=["WEB", "FULL"])
def run_xss_scanner(ctx: ToolContext) -> List[Dict[str, Any]]:
    """
    Deep Cross-Site Scripting (XSS) Scanner
    
    Detects:
    - Reflected XSS
    - DOM-based XSS
    - Stored XSS indicators
    - Context-aware payloads (HTML, JS, attribute, URL)
    - Polyglot payloads
    - WAF bypass techniques
    """
    findings = []
    
    try:
        from xss_scanner_pro import XSSScanner
        
        scanner = XSSScanner(ctx.target)
        results = scanner.run()
        
        for vuln in results.get("vulnerabilities", []):
            severity = "HIGH" if vuln.get("xss_type") == "reflected" else "MEDIUM"
            if vuln.get("xss_type") == "dom_based":
                severity = "HIGH"
                
            findings.append({
                "tool": "xss_scanner",
                "type": f"XSS_{vuln.get('xss_type', 'GENERIC').upper()}",
                "title": f"XSS Vulnerability - {vuln.get('xss_type', 'Generic').replace('_', ' ').title()}",
                "severity": severity,
                "target": ctx.target,
                "url": vuln.get("url", ctx.target),
                "parameter": vuln.get("parameter"),
                "payload": vuln.get("payload"),
                "context": vuln.get("context"),
                "evidence": vuln.get("evidence"),
                "remediation": "Implement proper output encoding based on context. Use Content Security Policy (CSP). Sanitize and validate all user inputs.",
                "cwe": "CWE-79",
                "owasp": "A03:2021 Injection",
            })
            
        # Check for DOM XSS sinks
        for sink in results.get("dom_sinks", []):
            findings.append({
                "tool": "xss_scanner",
                "type": "DOM_XSS_SINK",
                "title": f"Potential DOM XSS Sink Found: {sink.get('sink')}",
                "severity": "MEDIUM",
                "target": ctx.target,
                "sink": sink.get("sink"),
                "source": sink.get("source"),
                "code_snippet": sink.get("code"),
                "cwe": "CWE-79",
            })
            
        # Add summary if vulnerabilities found
        if results.get("summary", {}).get("total_vulnerabilities", 0) > 0:
            findings.append({
                "tool": "xss_scanner",
                "type": "SCAN_SUMMARY",
                "title": "XSS Scan Summary",
                "severity": "INFO",
                "target": ctx.target,
                "details": results.get("summary"),
            })
            
    except ImportError:
        # Fallback to subprocess
        script_path = os.path.join(AI30_PATH, "xss_scanner_pro.py")
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
                            "tool": "xss_scanner",
                            "type": "XSS",
                            "title": f"XSS - {vuln.get('xss_type', 'Generic')}",
                            "severity": "HIGH",
                            "target": ctx.target,
                            "url": vuln.get("url"),
                            "parameter": vuln.get("parameter"),
                            "payload": vuln.get("payload"),
                            "cwe": "CWE-79",
                        })
            except Exception as e:
                findings.append({
                    "tool": "xss_scanner",
                    "type": "ERROR",
                    "title": "XSS Scanner Error",
                    "severity": "INFO",
                    "details": str(e),
                })
    except Exception as e:
        findings.append({
            "tool": "xss_scanner",
            "type": "ERROR",
            "title": "XSS Scanner Error",
            "severity": "INFO",
            "details": str(e),
        })
        
    return findings
