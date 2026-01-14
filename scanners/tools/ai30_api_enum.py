from __future__ import annotations

import io
import os
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


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "API Endpoint Enumerator Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "OWASP-A05-2021"],
    }


@register_tool("ai30_api_enum")
class AI30ApiEnum:
    """API Endpoint Enumerator Pro wrapper (conservative).

    Notes:
    - Gated behind authorizationConfirmed because it performs active crawling and endpoint probing.
    - Suppresses stdout/stderr to preserve scanner JSON-only stdout contract.
    - Caps threads and crawl depth to keep runtime and load reasonable.
    """

    name = "ai30_api_enum"
    supported_scopes = ["API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="API Endpoint Enumerator Pro skipped (authorization not confirmed)",
                    description=(
                        "This tool performs active website crawling and endpoint probing to discover undocumented API routes. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable API endpoint enumeration.",
                    evidence={"authorizationConfirmed": False},
                )
            ]

        base_url = str(ctx.target or "").strip()
        if not base_url:
            return []

        if not base_url.startswith("http://") and not base_url.startswith("https://"):
            base_url = "https://" + base_url

        parsed = urlparse(base_url)
        if not parsed.scheme or not parsed.netloc:
            return [
                _finding(
                    title="Invalid target URL",
                    description=f"Target '{ctx.target}' is not a valid URL.",
                    severity="INFO",
                    remediation="Provide a fully qualified target URL (e.g., https://example.com).",
                    evidence={"target": ctx.target},
                )
            ]

        # Conservative tuning
        threads = int(os.getenv("SENTINEL_API_ENUM_THREADS", "8") or "8")
        threads = max(2, min(threads, 15))
        max_findings = int(os.getenv("SENTINEL_API_ENUM_MAX_FINDINGS", "30") or "30")
        max_findings = max(5, min(max_findings, 100))
        max_seconds = int(os.getenv("SENTINEL_API_ENUM_MAX_SECONDS", "20") or "20")
        max_seconds = max(5, min(max_seconds, 120))

        try:
            module = _safe_import_ai30_script("api_enum_pro.py")

            # Override for reduced crawling/probing
            module.THREADS = threads

            APIEnumerator = getattr(module, "APIEnumerator", None)
            if APIEnumerator is None:
                raise AttributeError("APIEnumerator not found")

            tool = APIEnumerator(base_url, threads=threads)

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                # Seed initial crawl (start page)
                tool.to_crawl.put(tool.base + "/")

                import threading
                import time

                crawl_threads = []
                for _ in range(min(threads, 4)):
                    t = threading.Thread(target=tool.crawl_worker, daemon=True)
                    t.start()
                    crawl_threads.append(t)

                probe_threads = []
                for _ in range(threads):
                    t = threading.Thread(target=tool.probe_worker, daemon=True)
                    t.start()
                    probe_threads.append(t)

                # Time-bound execution to avoid indefinite hangs.
                end_time = time.time() + float(max_seconds)
                while time.time() < end_time:
                    # If both queues are empty, we're effectively done.
                    if tool.to_crawl.empty() and tool.to_probe.empty():
                        break
                    time.sleep(0.25)

                tool.stop_flag = True
                # Give worker threads a moment to exit gracefully.
                for t in crawl_threads + probe_threads:
                    t.join(timeout=2)

            # Process discovered endpoints
            findings: List[Dict[str, Any]] = []
            sorted_discoveries = sorted(
                tool.discovery.items(),
                key=lambda kv: kv[1].get("risk_score", 0),
                reverse=True
            )[:max_findings]

            for url, info in sorted_discoveries:
                score = int(info.get("risk_score") or 0)
                reasons = info.get("risk_reasons") or []
                
                # Filter low-signal findings
                if score < 30:
                    continue

                level = "HIGH" if score >= 70 else ("MEDIUM" if score >= 40 else "LOW")
                
                findings.append(
                    _finding(
                        title=f"API endpoint discovered with {level} risk ({score})",
                        description=(
                            "Automated crawling and probing discovered an API endpoint with potential security concerns. "
                            "Review for authentication, authorization, rate limiting, and data exposure risks."
                        ),
                        severity=level,
                        remediation=(
                            "Validate authorization on all endpoints; enforce rate limiting; "
                            "restrict CORS policies; disable verbose error messages; "
                            "ensure sensitive endpoints require authentication."
                        ),
                        evidence={
                            "url": url,
                            "risk": {"score": score, "reasons": reasons},
                            "results": info.get("results", []),
                        },
                    )
                )

            if not findings and tool.discovery:
                return [
                    _finding(
                        title="API endpoint enumeration completed (no high-risk endpoints)",
                        description=f"Discovered {len(tool.discovery)} endpoints but none exceeded the risk threshold.",
                        severity="INFO",
                        remediation="Continue periodic endpoint scans to detect newly exposed APIs.",
                        evidence={"discoveredEndpoints": len(tool.discovery)},
                    )
                ]

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="API Endpoint Enumerator Pro failed",
                    description="API Endpoint Enumerator Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies (requests, beautifulsoup4) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
