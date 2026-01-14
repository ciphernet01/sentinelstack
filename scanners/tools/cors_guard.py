# CORS misconfiguration detection tool

from __future__ import annotations

import hashlib
from typing import Any, Dict, List

from scanners.engine.registry import register_tool


@register_tool("cors_guard")
class CorsGuard:
    name = "cors_guard"
    supported_scopes = ["WEB", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        # Deterministic placeholder logic; replace with real HTTP probing.
        digest = hashlib.sha256((ctx.target + "|cors_guard").encode("utf-8")).hexdigest()
        hit = int(digest[:2], 16) % 2 == 0
        if not hit:
            return []

        return [
            {
                "toolName": "CORS-Analyzer",
                "title": "Insecure CORS Policy",
                "description": (
                    "The server's Cross-Origin Resource Sharing (CORS) policy appears overly permissive, potentially "
                    "allowing malicious websites to make requests to this domain."
                ),
                "severity": "MEDIUM",
                "remediation": (
                    "Configure 'Access-Control-Allow-Origin' to a strict whitelist of trusted domains instead of using a wildcard ('*')."
                ),
                "evidence": {
                    "header": "Access-Control-Allow-Origin: *",
                    "vulnerable_endpoint": f"{ctx.target.rstrip('/')}/api/user-data",
                },
                "complianceMapping": ["OWASP-A01-2021", "CWE-942"],
            }
        ]
