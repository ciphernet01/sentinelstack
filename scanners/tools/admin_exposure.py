from __future__ import annotations

from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from scanners.engine.registry import register_tool


@register_tool("admin_exposure_finder")
class AdminExposureFinder:
    """Hidden/admin endpoint discovery.

    This is intentionally conservative and low-noise:
    - Only flags endpoints that return HTTP 200 without authentication.
    - 401/403 are treated as protected.
    - 3xx redirects are informational.

    You can expand this to include fingerprinting, login panel detection,
    or endpoint enumeration with scope-aware rate limits.
    """

    name = "admin_exposure_finder"
    supported_scopes = ["WEB", "API", "FULL"]

    _CANDIDATE_PATHS = [
        "/admin",
        "/administrator",
        "/admin/login",
        "/admin/console",
        "/console",
        "/manage",
        "/internal",
        "/_admin",
        "/_internal",
        "/api/admin",
        "/api/internal",
        "/wp-admin",  # common in the wild; harmless to probe
    ]

    def run(self, ctx) -> List[Dict[str, Any]]:
        base = ctx.target.rstrip("/") + "/"
        findings: List[Dict[str, Any]] = []

        timeout = 8
        headers = {
            "User-Agent": "SentinelStackScanner/1.0",
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        }

        for path in self._CANDIDATE_PATHS:
            url = urljoin(base, path.lstrip("/"))

            try:
                req = Request(url, headers=headers, method="GET")
                with urlopen(req, timeout=timeout) as resp:
                    status = getattr(resp, "status", None) or 0
                    # If the endpoint is openly accessible, flag it.
                    if status == 200:
                        findings.append(
                            {
                                "toolName": "Admin Exposure Finder",
                                "title": "Potentially exposed admin/internal endpoint",
                                "description": (
                                    "An admin/internal route responded with HTTP 200 without authentication. "
                                    "If this endpoint is not intended for public access, it should be protected "
                                    "with strong authentication and authorization controls."
                                ),
                                "severity": "HIGH",
                                "remediation": (
                                    "Restrict access to administrative and internal endpoints using authentication, "
                                    "role-based authorization, network controls (allowlists/VPN), and remove public routing "
                                    "where possible."
                                ),
                                "evidence": {
                                    "url": url,
                                    "status": status,
                                },
                                "complianceMapping": ["OWASP-A01-2021", "CWE-284"],
                            }
                        )
            except HTTPError as exc:
                # Protected endpoints are normal; do not report.
                status = getattr(exc, "code", 0) or 0
                if status in (301, 302, 303, 307, 308):
                    findings.append(
                        {
                            "toolName": "Admin Exposure Finder",
                            "title": "Admin/internal endpoint redirects (review access controls)",
                            "description": (
                                "An admin/internal-looking endpoint redirects. This is often expected (e.g., to a login page), "
                                "but should be reviewed to ensure it is properly protected and not exposing sensitive information."
                            ),
                            "severity": "INFO",
                            "remediation": "Verify redirects lead to authenticated flows and do not leak sensitive data.",
                            "evidence": {
                                "url": url,
                                "status": status,
                                "location": exc.headers.get("Location"),
                            },
                            "complianceMapping": ["OWASP-A01-2021"],
                        }
                    )
                continue
            except URLError:
                continue
            except Exception:
                continue

        return findings
