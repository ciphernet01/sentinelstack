"""JWT Security Analyzer - Real JWT vulnerability detection"""
from __future__ import annotations

import base64
import json
import re
from typing import Any, Dict, List
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from scanners.engine.registry import register_tool


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "JWT-Audit",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A07-2021", "CWE-347"],
    }


def _decode_jwt_part(part: str) -> dict:
    """Decode a JWT part (header or payload) without verification"""
    try:
        padding = 4 - len(part) % 4
        if padding != 4:
            part += "=" * padding
        decoded = base64.urlsafe_b64decode(part)
        return json.loads(decoded)
    except Exception:
        return {}


def _find_jwts_in_response(text: str) -> List[str]:
    """Find JWT tokens in response text"""
    jwt_pattern = r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
    return re.findall(jwt_pattern, text)


@register_tool("jwt")
class JwtAudit:
    """JWT Security Analyzer - checks for JWT vulnerabilities"""
    
    name = "jwt"
    supported_scopes = ["AUTH", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        jwts_found = []
        
        # Try to find JWTs in common endpoints
        endpoints = ["/", "/api"]
        
        for endpoint in endpoints:
            url = target.rstrip("/") + endpoint
            try:
                req = Request(url, method="GET", headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0",
                    "Accept": "application/json, text/html, */*",
                })
                with urlopen(req, timeout=5) as resp:
                    content = resp.read().decode("utf-8", errors="ignore")
                    headers_str = str(resp.headers)
                    
                    # Look for JWTs in response body
                    jwts_found.extend(_find_jwts_in_response(content))
                    
                    # Look for JWTs in headers (e.g., Set-Cookie)
                    jwts_found.extend(_find_jwts_in_response(headers_str))
                    
            except Exception:
                continue
        
        # Analyze found JWTs
        analyzed = set()
        for jwt in jwts_found:
            if jwt in analyzed:
                continue
            analyzed.add(jwt)
            
            parts = jwt.split(".")
            if len(parts) != 3:
                continue
                
            header = _decode_jwt_part(parts[0])
            payload = _decode_jwt_part(parts[1])
            
            # Check for 'none' algorithm vulnerability
            alg = header.get("alg", "").lower()
            if alg == "none":
                findings.append(_finding(
                    title="JWT 'alg': 'none' Vulnerability",
                    description="JWT uses 'none' algorithm, allowing signature bypass and token forgery.",
                    severity="CRITICAL",
                    remediation="Reject JWTs with 'none' algorithm. Whitelist strong algorithms (RS256, ES256).",
                    evidence={"algorithm": alg, "header": header},
                ))
            
            # Check for weak algorithms
            elif alg in ["hs256", "hs384", "hs512"]:
                findings.append(_finding(
                    title="JWT Uses Symmetric Algorithm",
                    description=f"JWT uses {alg.upper()} which may be vulnerable to brute-force if secret is weak.",
                    severity="MEDIUM",
                    remediation="Use asymmetric algorithms (RS256, ES256) for better security.",
                    evidence={"algorithm": alg},
                ))
            
            # Check for sensitive data in payload
            sensitive_keys = ["password", "secret", "credit_card", "ssn", "api_key", "private"]
            for key in payload.keys():
                if any(s in key.lower() for s in sensitive_keys):
                    findings.append(_finding(
                        title="Sensitive Data in JWT Payload",
                        description=f"JWT payload contains potentially sensitive field: {key}",
                        severity="HIGH",
                        remediation="Never store sensitive data in JWT payload. JWTs are encoded, not encrypted.",
                        evidence={"sensitive_field": key},
                    ))
                    break
            
            # Check for missing expiration
            if "exp" not in payload:
                findings.append(_finding(
                    title="JWT Missing Expiration",
                    description="JWT does not have an expiration (exp) claim, making it valid indefinitely.",
                    severity="MEDIUM",
                    remediation="Always include 'exp' claim with reasonable expiration time.",
                    evidence={"claims": list(payload.keys())},
                ))
        
        return findings
