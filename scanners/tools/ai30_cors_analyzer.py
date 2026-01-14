from __future__ import annotations

import io
import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from scanners.engine.registry import register_tool


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _safe_import_ai30_script(script_filename: str):
    """Best-effort import of a script from 'AI 30 Days/'.

    This folder isn't a Python package (space in name), and scripts may depend on
    optional third-party libs. We treat import failures as non-fatal.
    """

    ai30_dir = _repo_root() / "AI 30 Days"
    script_path = ai30_dir / script_filename
    if not script_path.exists():
        raise FileNotFoundError(f"AI30 script not found: {script_path}")

    # Import by filepath to avoid package/name constraints.
    import importlib.util

    module_name = f"ai30_{script_filename.replace('.', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load spec for: {script_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _cors_finding(
    *,
    title: str,
    description: str,
    severity: str,
    remediation: str,
    evidence: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "toolName": "CORS-Analyzer Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "CWE-942"],
    }


def _stdlib_probe_cors(base_url: str, endpoints: List[str], origins: List[str]) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []

    for endpoint in endpoints:
        url = urljoin(base_url.rstrip("/") + "/", endpoint.lstrip("/"))
        for origin in origins:
            try:
                req = Request(url, method="GET", headers={"Origin": origin})
                with urlopen(req, timeout=8) as resp:
                    headers = {k.lower(): v for k, v in resp.headers.items()}
                    status = getattr(resp, "status", 0)

                acao = headers.get("access-control-allow-origin", "").strip()
                acac = headers.get("access-control-allow-credentials", "").strip().lower()

                if not acao:
                    continue

                # Minimal risk logic (mirrors the AI30 tool's key cases).
                if acao == "*" and acac == "true":
                    findings.append(
                        _cors_finding(
                            title="Wildcard origin with credentials enabled",
                            description=(
                                "The server returns 'Access-Control-Allow-Origin: *' together with "
                                "'Access-Control-Allow-Credentials: true', allowing any origin to make authenticated cross-origin requests."
                            ),
                            severity="CRITICAL",
                            remediation=(
                                "Do not combine wildcard ACAO with credentials. Use a strict allowlist for trusted origins and disable credentials when not required."
                            ),
                            evidence={
                                "url": url,
                                "endpoint": endpoint,
                                "originTested": origin,
                                "statusCode": status,
                                "corsHeaders": {
                                    "access-control-allow-origin": acao,
                                    "access-control-allow-credentials": acac,
                                },
                            },
                        )
                    )
                elif acao == origin and acac == "true":
                    findings.append(
                        _cors_finding(
                            title="Origin reflection with credentials enabled",
                            description=(
                                "The server reflects the supplied Origin and allows credentials, which can be exploitable if origin validation is weak or bypassable."
                            ),
                            severity="HIGH",
                            remediation=(
                                "Validate the Origin header against a strict allowlist and avoid reflecting arbitrary origins. Disable credentials unless strictly needed."
                            ),
                            evidence={
                                "url": url,
                                "endpoint": endpoint,
                                "originTested": origin,
                                "statusCode": status,
                                "corsHeaders": {
                                    "access-control-allow-origin": acao,
                                    "access-control-allow-credentials": acac,
                                },
                            },
                        )
                    )
                elif acao == "*":
                    findings.append(
                        _cors_finding(
                            title="Wildcard origin allowed",
                            description=(
                                "The server returns a wildcard ACAO, which can expose responses to untrusted origins (even if credentials are not included)."
                            ),
                            severity="MEDIUM",
                            remediation="Use an allowlist of trusted origins instead of '*'.",
                            evidence={
                                "url": url,
                                "endpoint": endpoint,
                                "originTested": origin,
                                "statusCode": status,
                                "corsHeaders": {"access-control-allow-origin": acao},
                            },
                        )
                    )

            except HTTPError as e:
                # Still may have headers worth evaluating.
                headers = {k.lower(): v for k, v in getattr(e, "headers", {}).items()}
                acao = headers.get("access-control-allow-origin", "").strip()
                if acao:
                    findings.append(
                        _cors_finding(
                            title="CORS headers present on error response",
                            description="CORS headers were observed on a non-2xx response. Review if policies are consistently applied across error paths.",
                            severity="LOW",
                            remediation="Ensure CORS policies are consistent and restrictive on all routes, including error responses.",
                            evidence={
                                "url": url,
                                "endpoint": endpoint,
                                "originTested": origin,
                                "statusCode": int(getattr(e, "code", 0) or 0),
                                "corsHeaders": {"access-control-allow-origin": acao},
                            },
                        )
                    )
            except URLError:
                continue
            except Exception:
                continue

    # De-dup by (title,url,origin)
    dedup: Dict[str, Dict[str, Any]] = {}
    for f in findings:
        key = json.dumps(
            {
                "t": f.get("title"),
                "u": f.get("evidence", {}).get("url"),
                "o": f.get("evidence", {}).get("originTested"),
            },
            sort_keys=True,
        )
        dedup[key] = f
    return list(dedup.values())


@register_tool("ai30_cors_analyzer")
class AI30CorsAnalyzer:
    name = "ai30_cors_analyzer"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        base_url = str(ctx.target or "").strip()
        if not base_url:
            return []

        if not base_url.startswith("http://") and not base_url.startswith("https://"):
            base_url = "https://" + base_url

        parsed = urlparse(base_url)
        if not parsed.scheme or not parsed.netloc:
            return [
                _cors_finding(
                    title="Invalid target URL",
                    description=f"Target '{ctx.target}' is not a valid URL.",
                    severity="INFO",
                    remediation="Provide a fully qualified target URL (e.g., https://example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        endpoints = ["/", "/api", "/api/v1", "/graphql", "/admin", "/dashboard"]
        origins = [
            "https://evil.example",
            "https://attacker.invalid",
            "null",
        ]

        # Try to use the AI30 implementation if available; otherwise fallback.
        try:
            module = _safe_import_ai30_script("cors_analyzer_pro.py")
            analyzer_cls = getattr(module, "EnhancedCORSAnalyzer", None)
            utilities = getattr(module, "EnhancedUtilities", None)

            if analyzer_cls is None:
                raise AttributeError("EnhancedCORSAnalyzer not found")

            # Prefer AI30 origin generation if present.
            if utilities is not None and hasattr(utilities, "generate_origins"):
                try:
                    origins = list(utilities.generate_origins("all"))[:10]
                except Exception:
                    pass

            # Silence any prints from the AI30 tool (stdout must remain JSON-only).
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                analyzer = analyzer_cls(base_url, threads=2)
                raw_findings = analyzer.run_scan(
                    endpoints=endpoints,
                    origins=origins,
                    methods=["GET"],
                    preflight=False,
                    max_tests_per_endpoint=2,
                )

            normalized: List[Dict[str, Any]] = []
            for rf in raw_findings or []:
                analysis = (rf.get("analysis") or {}) if isinstance(rf, dict) else {}
                severity = _normalize_severity(rf.get("severity") if isinstance(rf, dict) else "INFO")
                risk_score = rf.get("risk_score") if isinstance(rf, dict) else None

                normalized.append(
                    _cors_finding(
                        title=f"Insecure CORS Policy ({severity})",
                        description=(
                            "CORS policy appears risky for at least one tested origin. "
                            "Review the observed headers and the analyzer's rationale."
                        ),
                        severity=severity,
                        remediation=(
                            "Use a strict allowlist for 'Access-Control-Allow-Origin', avoid reflecting arbitrary origins, and only enable credentials when required."
                        ),
                        evidence={
                            "url": rf.get("url"),
                            "endpoint": rf.get("endpoint"),
                            "method": rf.get("method"),
                            "originTested": rf.get("origin_tested"),
                            "statusCode": rf.get("status_code"),
                            "riskScore": risk_score,
                            "corsHeaders": rf.get("cors_headers"),
                            "vulnerabilities": analysis.get("vulnerabilities"),
                            "warnings": analysis.get("warnings"),
                            "informational": analysis.get("informational"),
                            "preflightTested": rf.get("preflight_tested"),
                            "preflightStatus": rf.get("preflight_status"),
                        },
                    )
                )

            return normalized

        except Exception as exc:
            # Fallback: stdlib probe (no third-party deps).
            fallback_findings = _stdlib_probe_cors(base_url, endpoints=endpoints, origins=origins)
            if fallback_findings:
                # Attach fallback notice once.
                fallback_findings.append(
                    _cors_finding(
                        title="AI30 CORS analyzer fallback used",
                        description=(
                            "The AI30 CORS analyzer script could not be imported/executed in this environment, so a simplified stdlib probe was used instead."
                        ),
                        severity="INFO",
                        remediation="Install optional Python dependencies (e.g., requests/colorama) if you want to run the full AI30 analyzer.",
                        evidence={"error": str(exc)},
                    )
                )
            return fallback_findings
