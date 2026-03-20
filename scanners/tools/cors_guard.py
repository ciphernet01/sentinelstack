# CORS misconfiguration detection tool

from __future__ import annotations

import requests
from typing import Any, Dict, List
from urllib.parse import urlparse

from scanners.engine.registry import register_tool


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


@register_tool("cors_guard")
class CorsGuard:
    """CORS misconfiguration scanner - performs actual HTTP requests to test CORS policies"""
    
    name = "cors_guard"
    supported_scopes = ["WEB", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        target = str(ctx.target or "").strip()
        if not target:
            return []
        
        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target
        
        findings: List[Dict[str, Any]] = []
        
        try:
            # Test with a malicious origin
            parsed = urlparse(target)
            test_origins = [
                "https://evil.com",
                "https://attacker.example.com",
                f"https://sub.{parsed.netloc}",  # Subdomain
                "null",  # null origin attack
            ]
            
            for test_origin in test_origins:
                try:
                    headers = {
                        "Origin": test_origin,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }
                    
                    resp = requests.get(target, headers=headers, timeout=10, verify=False, allow_redirects=True)
                    
                    acao = resp.headers.get("Access-Control-Allow-Origin", "")
                    acac = resp.headers.get("Access-Control-Allow-Credentials", "").lower()
                    
                    # Check for insecure CORS configurations
                    if acao == "*":
                        findings.append({
                            "toolName": "CORS-Guard",
                            "title": "Wildcard CORS Policy",
                            "description": "The server allows requests from any origin (*). This is insecure if the API handles sensitive data.",
                            "severity": "MEDIUM",
                            "remediation": "Configure 'Access-Control-Allow-Origin' to a strict whitelist of trusted domains.",
                            "evidence": {
                                "header": f"Access-Control-Allow-Origin: {acao}",
                                "tested_url": target,
                                "test_origin": test_origin,
                            },
                            "complianceMapping": ["OWASP-A01-2021", "CWE-942"],
                        })
                        break  # Don't duplicate findings
                    
                    elif acao == test_origin:
                        severity = "HIGH" if acac == "true" else "MEDIUM"
                        findings.append({
                            "toolName": "CORS-Guard",
                            "title": "Reflected Origin in CORS Policy",
                            "description": f"The server reflects the Origin header back in Access-Control-Allow-Origin. This allows {test_origin} to make cross-origin requests.",
                            "severity": severity,
                            "remediation": "Validate Origin against an allowlist instead of reflecting it. Never allow arbitrary origins.",
                            "evidence": {
                                "header": f"Access-Control-Allow-Origin: {acao}",
                                "credentials_allowed": acac == "true",
                                "tested_url": target,
                                "test_origin": test_origin,
                            },
                            "complianceMapping": ["OWASP-A01-2021", "CWE-942"],
                        })
                        
                    elif acao == "null" and test_origin == "null":
                        findings.append({
                            "toolName": "CORS-Guard",
                            "title": "Null Origin Allowed in CORS",
                            "description": "The server allows the 'null' origin, which can be exploited via sandboxed iframes or local files.",
                            "severity": "HIGH",
                            "remediation": "Never allow 'null' as a valid origin. Use explicit domain allowlists.",
                            "evidence": {
                                "header": f"Access-Control-Allow-Origin: {acao}",
                                "tested_url": target,
                            },
                            "complianceMapping": ["OWASP-A01-2021", "CWE-942"],
                        })
                        
                except requests.RequestException:
                    continue
                    
        except Exception as e:
            # Don't report scanner errors as findings
            pass
        
        return findings

