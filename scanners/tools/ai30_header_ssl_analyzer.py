from __future__ import annotations

import socket
import ssl
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from scanners.engine.registry import register_tool


REQUIRED_HEADERS: Dict[str, str] = {
    "strict-transport-security": "HSTS missing (protects against downgrade attacks)",
    "x-frame-options": "Prevents clickjacking",
    "x-content-type-options": "Prevents MIME sniffing",
    "content-security-policy": "CSP missing (major XSS risk)",
    "referrer-policy": "Referrer privacy not enforced",
    "permissions-policy": "Controls browser API permissions",
    "cache-control": "Missing cache protections",
}

COOKIE_FLAGS = ["httponly", "secure", "samesite"]


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _make_finding(
    *,
    title: str,
    description: str,
    severity: str,
    remediation: str,
    evidence: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "toolName": "Header & SSL Analyzer Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A05-2021", "CWE-693"],
    }


def _fetch_headers(url: str) -> Tuple[int, Dict[str, str]]:
    req = Request(url, method="GET")
    with urlopen(req, timeout=10) as resp:
        status = int(getattr(resp, "status", 0) or 0)
        headers = {k.lower(): v for k, v in resp.headers.items()}
        return status, headers


def _parse_set_cookie_flags(headers: Dict[str, str]) -> List[str]:
    # urllib flattens multi-headers; handle best-effort
    raw = headers.get("set-cookie")
    if not raw:
        return []

    cookie_issues: List[str] = []
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    for cookie in parts:
        lower = cookie.lower()
        for flag in COOKIE_FLAGS:
            if flag not in lower:
                cookie_issues.append(f"Set-Cookie missing '{flag}' flag")
                break
    return cookie_issues


def _decode_cert_dates(hostname: str) -> Dict[str, Any]:
    # Best-effort without third-party deps.
    pem = ssl.get_server_certificate((hostname, 443))

    # ssl._ssl._test_decode_cert expects a file path.
    import tempfile

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pem") as f:
        f.write(pem.encode("utf-8"))
        cert_path = f.name

    decoded = ssl._ssl._test_decode_cert(cert_path)  # type: ignore[attr-defined]
    not_before = decoded.get("notBefore")
    not_after = decoded.get("notAfter")

    return {
        "notBefore": not_before,
        "notAfter": not_after,
        "subject": decoded.get("subject"),
        "issuer": decoded.get("issuer"),
    }


def _score(missing_headers: List[Tuple[str, str]], cookie_issues: List[str], cert: Dict[str, Any]) -> Tuple[int, str, List[str]]:
    score = 0
    reasons: List[str] = []

    score += len(missing_headers) * 10
    for h, d in missing_headers:
        reasons.append(f"Missing header: {h} ({d})")

    score += len(cookie_issues) * 5
    reasons.extend(cookie_issues)

    # Expiry check
    not_after = cert.get("notAfter")
    if isinstance(not_after, str) and not_after:
        try:
            expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
            if expiry < datetime.utcnow():
                score += 30
                reasons.append("SSL certificate expired")
        except Exception:
            pass

    if score >= 70:
        level = "HIGH"
    elif score >= 40:
        level = "MEDIUM"
    elif score > 0:
        level = "LOW"
    else:
        level = "INFO"

    return score, level, reasons


@register_tool("ai30_header_ssl_analyzer")
class AI30HeaderSslAnalyzer:
    name = "ai30_header_ssl_analyzer"
    supported_scopes = ["WEB", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        parsed = urlparse(target)
        if not parsed.scheme or not parsed.netloc:
            return [
                _make_finding(
                    title="Invalid target URL",
                    description=f"Target '{ctx.target}' is not a valid URL.",
                    severity="INFO",
                    remediation="Provide a fully qualified target URL (e.g., https://example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        findings: List[Dict[str, Any]] = []

        # Headers
        try:
            status, headers = _fetch_headers(target)
            missing: List[Tuple[str, str]] = []
            for h, desc in REQUIRED_HEADERS.items():
                if h not in headers:
                    missing.append((h, desc))

            cookie_issues = _parse_set_cookie_flags(headers)

            # SSL
            cert_info: Dict[str, Any] = {}
            try:
                if parsed.scheme == "https":
                    cert_info = _decode_cert_dates(parsed.hostname or "")
            except Exception as e:
                cert_info = {"error": str(e)}

            score, level, reasons = _score(missing, cookie_issues, cert_info)

            if level != "INFO":
                findings.append(
                    _make_finding(
                        title=f"Missing security headers / weak cookie flags ({level})",
                        description=(
                            "One or more recommended security headers or cookie flags were missing. "
                            "This can increase risk of XSS, clickjacking, MIME sniffing, data leakage, or session compromise."
                        ),
                        severity=level,
                        remediation=(
                            "Enable missing security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.), "
                            "set cookie flags (Secure/HttpOnly/SameSite), and ensure HTTPS is enforced."
                        ),
                        evidence={
                            "url": target,
                            "status": status,
                            "missingHeaders": [{"header": h, "reason": d} for h, d in missing],
                            "cookieIssues": cookie_issues,
                            "ssl": cert_info,
                            "risk": {"score": score, "level": level, "reasons": reasons},
                        },
                    )
                )

        except Exception as exc:
            findings.append(
                _make_finding(
                    title="Header/SSL analysis failed",
                    description="Unable to fetch headers and/or inspect SSL certificate for the target.",
                    severity="INFO",
                    remediation="Verify the target is reachable and supports HTTPS; retry the scan.",
                    evidence={"error": str(exc), "target": target},
                )
            )

        return findings
