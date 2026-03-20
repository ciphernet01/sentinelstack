"""CORS Analyzer - Real CORS misconfiguration detection"""
from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from scanners.engine.registry import register_tool


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "MEDIUM").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "MEDIUM"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "CORS-Analyzer",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "CWE-942"],
    }


TEST_ORIGINS = ["https://evil.com", "null"]


@register_tool("cors")
class CorsAnalyzer:
    """CORS Misconfiguration Analyzer - performs real CORS security checks"""
    
    name = "cors"
    supported_scopes = ["WEB", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        endpoints = ["/", "/api"]
        seen = set()  # Dedupe findings
        
        for endpoint in endpoints:
            url = target.rstrip("/") + endpoint
            
            for origin in TEST_ORIGINS:
                try:
                    req = Request(url, method="GET", headers={"Origin": origin})
                    with urlopen(req, timeout=5) as resp:
                        headers = {k.lower(): v for k, v in resp.headers.items()}
                        
                        acao = headers.get("access-control-allow-origin", "").strip()
                        acac = headers.get("access-control-allow-credentials", "").strip().lower()
                        
                        if not acao:
                            continue
                        
                        if acao == "*" and acac == "true":
                            key = "wildcard_creds"
                            if key not in seen:
                                seen.add(key)
                                findings.append(_finding(
                                    title="Wildcard CORS with Credentials",
                                    description="Server returns ACAO: * with credentials, allowing any origin authenticated access.",
                                    severity="CRITICAL",
                                    remediation="Never use wildcard with credentials. Whitelist trusted domains.",
                                    evidence={"url": url, "origin": origin, "acao": acao, "acac": acac},
                                ))
                        elif acao == origin and acac == "true":
                            key = "reflect_creds"
                            if key not in seen:
                                seen.add(key)
                                findings.append(_finding(
                                    title="CORS Origin Reflection with Credentials",
                                    description="Server reflects Origin with credentials, allowing any origin to access authenticated resources.",
                                    severity="HIGH",
                                    remediation="Validate Origin against a whitelist.",
                                    evidence={"url": url, "origin": origin, "acao": acao, "acac": acac},
                                ))
                        elif acao == "null" and acac == "true":
                            key = "null_creds"
                            if key not in seen:
                                seen.add(key)
                                findings.append(_finding(
                                    title="Null Origin Accepted with Credentials",
                                    description="Server accepts 'null' origin with credentials, exploitable via sandboxed iframes.",
                                    severity="HIGH",
                                    remediation="Never accept 'null' as valid origin.",
                                    evidence={"url": url, "origin": origin, "acao": acao, "acac": acac},
                                ))
                        elif acao == "*":
                            key = "wildcard"
                            if key not in seen:
                                seen.add(key)
                                findings.append(_finding(
                                    title="Permissive CORS Policy",
                                    description="Server uses ACAO: * allowing any website to read responses.",
                                    severity="MEDIUM",
                                    remediation="Restrict to specific trusted origins.",
                                    evidence={"url": url, "origin": origin, "acao": acao},
                                ))
                except Exception:
                    continue
        
        return findings
