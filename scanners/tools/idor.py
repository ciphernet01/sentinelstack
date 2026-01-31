"""IDOR Probe - Real Insecure Direct Object Reference detection"""
from __future__ import annotations

import re
from typing import Any, Dict, List
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urljoin

from scanners.engine.registry import register_tool


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "HIGH").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "HIGH"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "IDOR-Probe",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "CWE-639"],
    }


# Patterns that suggest IDOR-vulnerable endpoints
IDOR_PATTERNS = [
    r"/users?/(\d+)",
    r"/accounts?/(\d+)",
    r"/profiles?/(\d+)",
    r"/orders?/(\d+)",
    r"/invoices?/(\d+)",
    r"/documents?/(\d+)",
    r"/files?/(\d+)",
    r"/messages?/(\d+)",
    r"/api/v\d+/\w+/(\d+)",
    r"\?id=(\d+)",
    r"\?user_id=(\d+)",
    r"\?account_id=(\d+)",
]


@register_tool("idor")
class IdorProbe:
    """IDOR Probe - detects potential Insecure Direct Object Reference vulnerabilities"""
    
    name = "idor"
    supported_scopes = ["API", "WEB", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        
        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        
        # Scan for IDOR patterns in common API endpoints
        test_endpoints = [
            "/api/users/1",
            "/api/v1/users/1",
            "/api/accounts/1",
            "/api/orders/1",
            "/api/profile/1",
            "/users/1",
            "/user/1",
            "/account/1",
        ]
        
        for endpoint in test_endpoints:
            url = target.rstrip("/") + endpoint
            
            try:
                # First request with ID 1
                req1 = Request(url, method="GET", headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0",
                    "Accept": "application/json",
                })
                
                with urlopen(req1, timeout=10) as resp1:
                    status1 = resp1.status
                    content1 = resp1.read().decode("utf-8", errors="ignore")
                    len1 = len(content1)
                
                if status1 != 200:
                    continue
                
                # Only do sequential ID testing if authorized
                if authorization_confirmed:
                    # Try ID 2 to see if we get different user's data
                    url2 = url.replace("/1", "/2")
                    req2 = Request(url2, method="GET", headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0",
                        "Accept": "application/json",
                    })
                    
                    try:
                        with urlopen(req2, timeout=10) as resp2:
                            status2 = resp2.status
                            content2 = resp2.read().decode("utf-8", errors="ignore")
                            
                            # If both return 200 with different content, potential IDOR
                            if status2 == 200 and content1 != content2:
                                findings.append(_finding(
                                    title="Potential IDOR - Sequential ID Access",
                                    description=f"Endpoint {endpoint} allows accessing different resources by changing ID.",
                                    severity="HIGH",
                                    remediation="Implement proper authorization checks. Verify user owns the requested resource.",
                                    evidence={
                                        "endpoint": endpoint,
                                        "id1_status": status1,
                                        "id2_status": status2,
                                        "id1_length": len1,
                                        "id2_length": len(content2),
                                    },
                                ))
                    except Exception:
                        pass
                else:
                    # Without authorization, just report the pattern exists
                    if any(re.search(p, endpoint) for p in IDOR_PATTERNS):
                        findings.append(_finding(
                            title="IDOR-Susceptible Endpoint Pattern",
                            description=f"Endpoint {endpoint} uses numeric IDs which may be vulnerable to IDOR.",
                            severity="INFO",
                            remediation="Ensure server-side authorization checks validate user access to resources.",
                            evidence={
                                "endpoint": endpoint,
                                "status": status1,
                                "note": "Enable authorizationConfirmed for active IDOR testing",
                            },
                        ))
                        
            except Exception:
                continue
        
        return findings
