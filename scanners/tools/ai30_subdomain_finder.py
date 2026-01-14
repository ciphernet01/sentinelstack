from __future__ import annotations

import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

from scanners.engine.registry import register_tool


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _safe_import_ai30_script(script_filename: str):
    ai30_dir = _repo_root() / "AI 30 Days"
    script_path = ai30_dir / script_filename
    if not script_path.exists():
        raise FileNotFoundError(f"AI30 script not found: {script_path}")

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


def _severity_from_risk_score(score: int) -> str:
    if score >= 50:
        return "HIGH"
    if score >= 25:
        return "MEDIUM"
    if score > 0:
        return "LOW"
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "Subdomain Finder Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A05-2021"],
    }


@register_tool("ai30_subdomain_finder")
class AI30SubdomainFinder:
    """Subdomain Finder Pro wrapper (fast mode).

    Runs a lightweight, non-interactive variant of the AI30 script:
    - Uses FAST_WORDLIST only.
    - Suppresses stdout/stderr.
    - Gated behind authorizationConfirmed because it performs active DNS and HTTP probing.

    Notes:
    - Requires dnspython + beautifulsoup4 + requests in the scanner runtime.
    """

    name = "ai30_subdomain_finder"
    supported_scopes = ["WEB", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="Subdomain Finder Pro skipped (authorization not confirmed)",
                    description=(
                        "This tool performs DNS enumeration and HTTP probing of discovered hosts. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable subdomain enumeration.",
                    evidence={"authorizationConfirmed": False},
                )
            ]

        target = str(ctx.target or "").strip()
        if not target:
            return []

        # Accept either a domain (example.com) or a URL.
        domain = target
        if "://" in target:
            parsed = urlparse(target)
            domain = parsed.hostname or ""

        domain = domain.strip().lower().rstrip(".")
        if not domain or "/" in domain:
            return [
                _finding(
                    title="Invalid target domain",
                    description=f"Target '{ctx.target}' is not a valid domain.",
                    severity="INFO",
                    remediation="Provide a domain (example.com) or URL (https://example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        try:
            module = _safe_import_ai30_script("subdomain_finder_pro.py")
            wordlist = list(getattr(module, "FAST_WORDLIST", []))
            probe = getattr(module, "probe", None)
            has_wildcard = getattr(module, "has_wildcard", None)
            risk_score = getattr(module, "risk_score", None)

            if not wordlist or probe is None or has_wildcard is None or risk_score is None:
                raise AttributeError("FAST_WORDLIST/probe/has_wildcard/risk_score not found")

            # Keep it conservative.
            wordlist = wordlist[:40]

            from concurrent.futures import ThreadPoolExecutor, as_completed

            results: List[Dict[str, Any]] = []
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                wildcard = bool(has_wildcard(domain))

                with ThreadPoolExecutor(max_workers=12) as exe:
                    futures = [exe.submit(probe, domain, sub) for sub in wordlist]
                    for fut in as_completed(futures):
                        try:
                            res = fut.result()
                        except Exception:
                            continue
                        if isinstance(res, dict):
                            results.append(res)

            resolved = [r for r in results if isinstance(r, dict) and r.get("resolved")]
            score, level, reasons = risk_score(results)
            severity = _severity_from_risk_score(int(score or 0))

            if not resolved:
                return []

            # Keep evidence bounded.
            top = resolved[:12]
            evidence_hosts: List[Dict[str, Any]] = []
            for r in top:
                http = r.get("http") or {}
                evidence_hosts.append(
                    {
                        "subdomain": r.get("subdomain"),
                        "ips": r.get("ips") or [],
                        "status": http.get("status"),
                        "finalUrl": http.get("final_url"),
                        "title": http.get("title"),
                        "tech": r.get("tech") or [],
                        "notes": r.get("notes") or [],
                    }
                )

            return [
                _finding(
                    title="Subdomain enumeration results",
                    description=(
                        "Automated subdomain enumeration discovered resolvable hosts. Review the list for exposed admin panels, staging systems, and unexpected services."
                    ),
                    severity=severity,
                    remediation=(
                        "- Inventory and approve exposed subdomains; remove or restrict non-production hosts.\n"
                        "- Enforce authentication and network controls on admin/staging systems.\n"
                        "- Ensure consistent TLS/security headers across subdomains."
                    ),
                    evidence={
                        "domain": domain,
                        "wildcardDnsDetected": wildcard,
                        "found": len(resolved),
                        "riskScore": score,
                        "riskLevel": level,
                        "riskReasons": reasons,
                        "sample": evidence_hosts,
                    },
                )
            ]

        except Exception as exc:
            return [
                _finding(
                    title="Subdomain Finder Pro failed",
                    description="Subdomain Finder Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure dnspython, beautifulsoup4, and requests are installed in the scanner runtime.",
                    evidence={"error": str(exc)},
                )
            ]
