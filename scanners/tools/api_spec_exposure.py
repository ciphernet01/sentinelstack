from __future__ import annotations

import json
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import urlopen

from scanners.engine.registry import register_tool
from scanners.tools.http_client import make_request


SPEC_PATHS = [
    "/openapi.json",
    "/swagger.json",
    "/api-docs",
    "/api/docs",
    "/v2/api-docs",
    "/v3/api-docs",
    "/swagger/v1/swagger.json",
    "/swagger-ui",
    "/swagger-ui.html",
    "/docs",
    "/redoc",
]

SENSITIVE_WORDS = [
    "admin",
    "internal",
    "password",
    "token",
    "secret",
    "apikey",
    "api_key",
    "reset",
    "impersonate",
    "billing",
    "payment",
]


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "API Specification Exposure",
        "title": title,
        "description": description,
        "severity": severity,
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-API3-2023", "OWASP-API5-2023", "CWE-200"],
    }


def _parse_json_spec(body: bytes) -> Dict[str, Any] | None:
    try:
        parsed = json.loads(body.decode("utf-8", errors="ignore"))
    except Exception:
        return None

    if not isinstance(parsed, dict):
        return None

    if "openapi" in parsed or "swagger" in parsed or "paths" in parsed:
        return parsed

    return None


def _score_spec(spec: Dict[str, Any]) -> Dict[str, Any]:
    paths = spec.get("paths") if isinstance(spec.get("paths"), dict) else {}
    components = spec.get("components") if isinstance(spec.get("components"), dict) else {}
    definitions = spec.get("definitions") if isinstance(spec.get("definitions"), dict) else {}
    security = spec.get("security")

    path_names = sorted(str(path) for path in paths.keys())[:200]
    joined_paths = " ".join(path_names).lower()
    sensitive_matches = sorted({word for word in SENSITIVE_WORDS if word in joined_paths})

    score = 35
    reasons = ["Public API specification is reachable."]
    if len(path_names) >= 25:
        score += 10
        reasons.append("Large endpoint inventory disclosed.")
    if sensitive_matches:
        score += 20
        reasons.append("Sensitive endpoint names are disclosed.")
    if security in (None, [], {}):
        score += 10
        reasons.append("No global security requirement is declared in the specification.")
    if components.get("securitySchemes") or spec.get("securityDefinitions"):
        score += 5
        reasons.append("Authentication scheme details are disclosed.")

    severity = "HIGH" if score >= 65 else "MEDIUM"

    return {
        "score": min(score, 100),
        "severity": severity,
        "reasons": reasons,
        "pathCount": len(paths),
        "samplePaths": path_names[:25],
        "sensitiveMatches": sensitive_matches,
        "schemaCount": len(components.get("schemas", {})) if isinstance(components.get("schemas"), dict) else len(definitions),
    }


@register_tool("api_spec_exposure")
class ApiSpecExposure:
    name = "api_spec_exposure"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        base = str(ctx.target or "").strip()
        if not base:
            return []

        if not base.startswith("http://") and not base.startswith("https://"):
            base = "https://" + base

        findings: List[Dict[str, Any]] = []
        seen = set()

        for path in SPEC_PATHS:
            url = urljoin(base.rstrip("/") + "/", path.lstrip("/"))
            try:
                req = make_request(ctx, url)
                with urlopen(req, timeout=8) as resp:
                    status = int(getattr(resp, "status", 0) or 0)
                    content_type = (resp.headers.get("Content-Type") or "").lower()
                    body = resp.read(512_000)
            except HTTPError as exc:
                if exc.code in (401, 403):
                    continue
                if exc.code not in (200,):
                    continue
                body = exc.read(512_000)
                status = int(exc.code)
                content_type = (exc.headers.get("Content-Type") or "").lower()
            except (URLError, TimeoutError, ValueError):
                continue
            except Exception:
                continue

            if status != 200:
                continue

            spec = _parse_json_spec(body)
            if spec:
                marker = ("json", url)
                if marker in seen:
                    continue
                seen.add(marker)
                scored = _score_spec(spec)
                findings.append(
                    _finding(
                        title="Unauthenticated API specification exposed",
                        description=(
                            "An OpenAPI/Swagger specification is publicly reachable. This can disclose hidden endpoints, "
                            "object models, authentication schemes, and sensitive administrative operations to attackers."
                        ),
                        severity=scored["severity"],
                        remediation=(
                            "Restrict API specifications and interactive documentation to authenticated users, private networks, "
                            "or non-production environments. Remove sensitive internal/admin routes from public specs."
                        ),
                        evidence={
                            "url": url,
                            "status": status,
                            "contentType": content_type,
                            "risk": scored,
                        },
                    )
                )
                continue

            text = body[:100_000].decode("utf-8", errors="ignore").lower()
            if "swagger-ui" in text or "openapi" in text or "redoc" in text:
                marker = ("html", url)
                if marker in seen:
                    continue
                seen.add(marker)
                findings.append(
                    _finding(
                        title="Unauthenticated interactive API documentation exposed",
                        description=(
                            "Interactive API documentation appears publicly reachable. This may allow unauthenticated users "
                            "to discover and exercise sensitive API operations."
                        ),
                        severity="MEDIUM",
                        remediation="Require authentication for interactive API documentation and disable it in production unless explicitly needed.",
                        evidence={
                            "url": url,
                            "status": status,
                            "contentType": content_type,
                            "indicators": ["swagger-ui/openapi/redoc"],
                        },
                    )
                )

        return findings
