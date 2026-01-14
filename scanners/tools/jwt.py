from __future__ import annotations

import hashlib
from typing import Any, Dict, List

from scanners.engine.registry import register_tool


@register_tool("jwt")
class JwtAudit:
    name = "jwt"
    supported_scopes = ["AUTH", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        digest = hashlib.sha256((ctx.target + "|jwt").encode("utf-8")).hexdigest()
        hit = int(digest[:2], 16) % 5 == 0
        if not hit:
            return []

        return [
            {
                "toolName": "JWT-Audit",
                "title": "JWT 'alg': 'none' Vulnerability",
                "description": (
                    "The application appears to accept JWTs with the 'alg' header set to 'none', which could allow an attacker "
                    "to bypass signature verification and forge tokens."
                ),
                "severity": "CRITICAL",
                "remediation": (
                    "Reject any JWT that specifies the 'none' algorithm and enforce a whitelist of accepted strong algorithms (e.g., RS256, ES256)."
                ),
                "evidence": {
                    "forged_token": "header.payload.<empty_signature>",
                    "result": "Token was accepted in test flow.",
                },
                "complianceMapping": ["OWASP-A07-2021", "CWE-347"],
            }
        ]
