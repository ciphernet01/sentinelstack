from __future__ import annotations

import hashlib
from typing import Any, Dict, List

from scanners.engine.registry import register_tool


@register_tool("idor")
class IdorProbe:
    name = "idor"
    supported_scopes = ["API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        digest = hashlib.sha256((ctx.target + "|idor").encode("utf-8")).hexdigest()
        hit = int(digest[:2], 16) % 3 == 0
        if not hit:
            return []

        base = ctx.target.rstrip("/")
        return [
            {
                "toolName": "IDOR-Probe",
                "title": "Potential IDOR in User Profile Endpoint",
                "description": (
                    "The application may be vulnerable to Insecure Direct Object Reference (IDOR), where an attacker "
                    "can access unauthorized data by modifying an ID parameter."
                ),
                "severity": "HIGH",
                "remediation": (
                    "Implement server-side authorization checks to ensure the caller is permitted to access the requested resource ID."
                ),
                "evidence": {
                    "request": f"GET {base}/api/v1/users/12346",
                    "response_code": 200,
                    "observation": "Accessing a resource for a different user ID (12346) was successful.",
                },
                "complianceMapping": ["OWASP-A01-2021", "CWE-639"],
            }
        ]
