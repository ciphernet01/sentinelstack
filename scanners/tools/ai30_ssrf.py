"""
SSRF Scanner wrapper for AI 30 Days integration
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


@register_tool("ssrf_scanner", category="injection", scope=["WEB", "API", "FULL"])
def run_ssrf_scanner(ctx: ToolContext) -> List[Dict[str, Any]]:
    """
    Deep SSRF (Server-Side Request Forgery) Scanner
    
    Detects:
    - Internal network access
    - Cloud metadata endpoint access (AWS, GCP, Azure)
    - Protocol smuggling (file://, gopher://, dict://)
    - DNS rebinding vulnerabilities
    - URL parser confusion bypasses
    - Blind SSRF indicators
    """
    findings = []
    
    try:
        from ssrf_scanner_pro import SSRFScanner
        
        scanner = SSRFScanner(ctx.target)
        results = scanner.run()
        
        for finding in results.get("findings", []):
            findings.append({
                "tool": "ssrf_scanner",
                "type": finding.get("type", "SSRF"),
                "title": finding.get("title", "SSRF Vulnerability"),
                "severity": finding.get("severity", "HIGH"),
                "target": ctx.target,
                "parameter": finding.get("parameter"),
                "payload": finding.get("payload"),
                "evidence": finding.get("evidence"),
                "indicators": finding.get("indicators"),
                "remediation": "Implement allowlists for external URLs. Use URL parsing carefully. Block access to internal IPs and cloud metadata endpoints.",
                "cwe": "CWE-918",
                "owasp": "A10:2021 Server-Side Request Forgery",
            })
            
        # Add summary
        if results.get("summary", {}).get("total_vulnerabilities", 0) > 0:
            findings.append({
                "tool": "ssrf_scanner",
                "type": "SCAN_SUMMARY",
                "title": "SSRF Scan Summary",
                "severity": "INFO",
                "target": ctx.target,
                "details": results.get("summary"),
            })
            
    except ImportError:
        # Fallback to subprocess
        script_path = os.path.join(AI30_PATH, "ssrf_scanner_pro.py")
        if os.path.exists(script_path):
            try:
                result = subprocess.run(
                    [sys.executable, script_path, "--target", ctx.target],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                if result.returncode == 0:
                    findings.append({
                        "tool": "ssrf_scanner",
                        "type": "SCAN_COMPLETE",
                        "title": "SSRF Scan Complete",
                        "severity": "INFO",
                        "target": ctx.target,
                    })
            except Exception as e:
                findings.append({
                    "tool": "ssrf_scanner",
                    "type": "ERROR",
                    "title": "SSRF Scanner Error",
                    "severity": "INFO",
                    "details": str(e),
                })
    except Exception as e:
        findings.append({
            "tool": "ssrf_scanner",
            "type": "ERROR",
            "title": "SSRF Scanner Error",
            "severity": "INFO",
            "details": str(e),
        })
        
    return findings
