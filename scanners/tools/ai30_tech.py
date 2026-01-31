"""
Technology Fingerprinter wrapper for AI 30 Days integration
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


@register_tool("tech_fingerprinter", category="recon", scope=["WEB", "API", "FULL"])
def run_tech_fingerprinter(ctx: ToolContext) -> List[Dict[str, Any]]:
    """
    Technology Fingerprinter for CVE matching
    
    Detects:
    - Web server software (nginx, Apache, IIS, etc.)
    - Programming languages (PHP, Python, Java, etc.)
    - Frameworks (React, Angular, Django, Rails, etc.)
    - CMS platforms (WordPress, Drupal, Joomla, etc.)
    - JavaScript libraries with versions
    - Known vulnerable versions
    """
    findings = []
    
    try:
        from tech_fingerprinter_pro import TechFingerprinter
        
        scanner = TechFingerprinter(ctx.target)
        results = scanner.run()
        
        # Report detected technologies
        for category, techs in results.get("technologies", {}).items():
            for tech in techs:
                version_str = f" v{tech['version']}" if tech.get('version') else ""
                
                findings.append({
                    "tool": "tech_fingerprinter",
                    "type": f"TECHNOLOGY_{category.upper()}",
                    "title": f"Detected: {tech['name']}{version_str}",
                    "severity": "INFO",
                    "target": ctx.target,
                    "technology": tech["name"],
                    "category": category,
                    "version": tech.get("version"),
                    "detection_sources": tech.get("sources", []),
                })
                
        # Report known vulnerabilities
        for vuln in results.get("vulnerabilities", []):
            severity = vuln.get("severity", "MEDIUM")
            
            findings.append({
                "tool": "tech_fingerprinter",
                "type": "VULNERABLE_COMPONENT",
                "title": f"Vulnerable {vuln['technology']} {vuln['detected_version']}",
                "severity": severity,
                "target": ctx.target,
                "technology": vuln["technology"],
                "detected_version": vuln["detected_version"],
                "vulnerable_spec": vuln["vulnerable_spec"],
                "cve": vuln.get("cve"),
                "description": vuln.get("description"),
                "remediation": f"Upgrade {vuln['technology']} to the latest secure version.",
                "cwe": "CWE-1035",
                "owasp": "A06:2021 Vulnerable and Outdated Components",
            })
            
        # Add summary
        summary = results.get("summary", {})
        if summary.get("total_technologies", 0) > 0:
            findings.append({
                "tool": "tech_fingerprinter",
                "type": "SCAN_SUMMARY",
                "title": "Technology Fingerprint Summary",
                "severity": "INFO",
                "target": ctx.target,
                "total_technologies": summary.get("total_technologies"),
                "categories": summary.get("categories"),
                "critical_vulns": summary.get("critical_vulns", 0),
                "high_vulns": summary.get("high_vulns", 0),
            })
            
    except ImportError:
        # Fallback to subprocess
        script_path = os.path.join(AI30_PATH, "tech_fingerprinter_pro.py")
        if os.path.exists(script_path):
            try:
                result = subprocess.run(
                    [sys.executable, script_path, "--target", ctx.target],
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                # Parse output if available
                if result.returncode == 0:
                    findings.append({
                        "tool": "tech_fingerprinter",
                        "type": "SCAN_COMPLETE",
                        "title": "Technology Fingerprinting Complete",
                        "severity": "INFO",
                        "target": ctx.target,
                    })
            except Exception as e:
                findings.append({
                    "tool": "tech_fingerprinter",
                    "type": "ERROR",
                    "title": "Technology Fingerprinter Error",
                    "severity": "INFO",
                    "details": str(e),
                })
    except Exception as e:
        findings.append({
            "tool": "tech_fingerprinter",
            "type": "ERROR",
            "title": "Technology Fingerprinter Error",
            "severity": "INFO",
            "details": str(e),
        })
        
    return findings
