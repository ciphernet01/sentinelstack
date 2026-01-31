"""
Secret Scanner wrapper for AI 30 Days integration
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


@register_tool("secret_scanner", category="exposure", scope=["WEB", "API", "FULL"])
def run_secret_scanner(ctx: ToolContext) -> List[Dict[str, Any]]:
    """
    Deep Secret/Credential Scanner
    
    Detects exposed:
    - AWS Access Keys & Secret Keys
    - GCP API Keys & Service Account Keys
    - Azure Client Secrets & Connection Strings
    - GitHub/GitLab/Bitbucket Tokens
    - Stripe/Slack/Twilio API Keys
    - Private Keys (RSA, SSH, PGP)
    - JWTs with sensitive claims
    - Database Connection Strings
    - And 30+ more secret patterns
    """
    findings = []
    
    try:
        from secret_scanner_pro import SecretScanner
        
        scanner = SecretScanner(ctx.target)
        results = scanner.run()
        
        for secret in results.get("secrets_found", []):
            # Determine severity based on secret type
            severity = "CRITICAL"
            if secret.get("type") in ["jwt", "base64_data"]:
                severity = "HIGH"
            elif secret.get("type") in ["api_endpoint", "internal_url"]:
                severity = "MEDIUM"
                
            findings.append({
                "tool": "secret_scanner",
                "type": f"EXPOSED_SECRET_{secret.get('type', 'GENERIC').upper()}",
                "title": f"Exposed {secret.get('type', 'Secret').replace('_', ' ').title()}",
                "severity": severity,
                "target": ctx.target,
                "url": secret.get("url", ctx.target),
                "secret_type": secret.get("type"),
                "pattern_matched": secret.get("pattern"),
                "location": secret.get("location"),
                # Redacted value for safety
                "value_preview": secret.get("value", "")[:20] + "..." if secret.get("value") else None,
                "remediation": "Immediately rotate the exposed credential. Remove from source code and use environment variables or secret management systems.",
                "cwe": "CWE-798",
                "owasp": "A07:2021 Identification and Authentication Failures",
            })
            
        # Check sensitive paths
        for path in results.get("sensitive_paths", []):
            findings.append({
                "tool": "secret_scanner",
                "type": "SENSITIVE_PATH_EXPOSED",
                "title": f"Sensitive Path Accessible: {path.get('path')}",
                "severity": "HIGH",
                "target": ctx.target,
                "url": path.get("url"),
                "path": path.get("path"),
                "status_code": path.get("status_code"),
                "cwe": "CWE-538",
            })
            
        # Add summary
        if results.get("summary", {}).get("total_secrets", 0) > 0:
            findings.append({
                "tool": "secret_scanner",
                "type": "SCAN_SUMMARY",
                "title": "Secret Scan Summary",
                "severity": "INFO",
                "target": ctx.target,
                "details": results.get("summary"),
            })
            
    except ImportError:
        # Fallback to subprocess
        script_path = os.path.join(AI30_PATH, "secret_scanner_pro.py")
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
                    for secret in data.get("secrets_found", []):
                        findings.append({
                            "tool": "secret_scanner",
                            "type": "EXPOSED_SECRET",
                            "title": f"Exposed {secret.get('type', 'Secret')}",
                            "severity": "CRITICAL",
                            "target": ctx.target,
                            "secret_type": secret.get("type"),
                            "cwe": "CWE-798",
                        })
            except Exception as e:
                findings.append({
                    "tool": "secret_scanner",
                    "type": "ERROR",
                    "title": "Secret Scanner Error",
                    "severity": "INFO",
                    "details": str(e),
                })
    except Exception as e:
        findings.append({
            "tool": "secret_scanner",
            "type": "ERROR",
            "title": "Secret Scanner Error",
            "severity": "INFO",
            "details": str(e),
        })
        
    return findings
