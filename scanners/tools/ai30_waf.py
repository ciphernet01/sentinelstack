"""
WAF Bypass Tester wrapper for AI 30 Days integration
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


@register_tool("waf_bypass", category="evasion", scope=["WEB", "API", "FULL"])
def run_waf_bypass_tester(ctx: ToolContext) -> List[Dict[str, Any]]:
    """
    WAF Detection and Bypass Tester
    
    Features:
    - WAF detection (Cloudflare, AWS WAF, Akamai, Imperva, ModSecurity, etc.)
    - Encoding bypass techniques
    - Case manipulation bypasses
    - HTTP method/parameter pollution
    - Header manipulation techniques
    - Unicode/null byte bypasses
    """
    findings = []
    
    try:
        from waf_bypass_tester_pro import WafBypassTester
        
        tester = WafBypassTester(ctx.target)
        results = tester.run()
        
        # Report detected WAFs
        for waf in results.get("detected_wafs", []):
            findings.append({
                "tool": "waf_bypass",
                "type": "WAF_DETECTED",
                "title": f"WAF Detected: {waf['name']}",
                "severity": "INFO",
                "target": ctx.target,
                "waf_name": waf["name"],
                "confidence": waf.get("confidence", "unknown"),
                "evidence": waf.get("evidence", []),
            })
            
        # Report successful bypasses
        for bypass in results.get("payload_bypasses", []):
            if bypass.get("success"):
                findings.append({
                    "tool": "waf_bypass",
                    "type": "WAF_BYPASS_FOUND",
                    "title": f"WAF Bypass: {bypass.get('technique', 'Unknown')}",
                    "severity": "HIGH",
                    "target": ctx.target,
                    "technique": bypass.get("technique"),
                    "original_payload": bypass.get("original_payload"),
                    "modified_payload": bypass.get("modified_payload"),
                    "remediation": "Review and strengthen WAF rules. Consider multiple layers of input validation.",
                    "cwe": "CWE-693",
                })
                
        # Report header bypasses
        for header_bypass in results.get("header_bypasses", []):
            if header_bypass.get("potential_bypass"):
                findings.append({
                    "tool": "waf_bypass",
                    "type": "HEADER_BYPASS",
                    "title": f"Header Bypass Potential: {header_bypass.get('header')}",
                    "severity": "MEDIUM",
                    "target": ctx.target,
                    "header": header_bypass.get("header"),
                    "value": header_bypass.get("value"),
                    "status_code": header_bypass.get("status_code"),
                    "cwe": "CWE-693",
                })
                
        # Report method bypasses
        for method_bypass in results.get("method_bypasses", []):
            if method_bypass.get("potential_bypass"):
                findings.append({
                    "tool": "waf_bypass",
                    "type": "METHOD_BYPASS",
                    "title": f"HTTP Method Bypass: {method_bypass.get('method')}",
                    "severity": "MEDIUM",
                    "target": ctx.target,
                    "method": method_bypass.get("method"),
                    "status_code": method_bypass.get("status_code"),
                    "cwe": "CWE-650",
                })
                
        # Add summary
        summary = results.get("summary", {})
        findings.append({
            "tool": "waf_bypass",
            "type": "SCAN_SUMMARY",
            "title": "WAF Bypass Test Summary",
            "severity": "INFO",
            "target": ctx.target,
            "wafs_detected": summary.get("wafs_detected", 0),
            "successful_bypasses": summary.get("successful_bypasses", 0),
            "header_bypasses_found": summary.get("header_bypasses_found", 0),
            "method_bypasses_found": summary.get("method_bypasses_found", 0),
        })
            
    except ImportError:
        # Fallback to subprocess
        script_path = os.path.join(AI30_PATH, "waf_bypass_tester_pro.py")
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
                        "tool": "waf_bypass",
                        "type": "SCAN_COMPLETE",
                        "title": "WAF Bypass Testing Complete",
                        "severity": "INFO",
                        "target": ctx.target,
                    })
            except Exception as e:
                findings.append({
                    "tool": "waf_bypass",
                    "type": "ERROR",
                    "title": "WAF Bypass Tester Error",
                    "severity": "INFO",
                    "details": str(e),
                })
    except Exception as e:
        findings.append({
            "tool": "waf_bypass",
            "type": "ERROR",
            "title": "WAF Bypass Tester Error",
            "severity": "INFO",
            "details": str(e),
        })
        
    return findings
