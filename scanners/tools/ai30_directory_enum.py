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
        "toolName": "Directory Enumerator Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A05-2021", "CWE-548"],
    }


def _risk_to_severity(risk: int) -> str:
    if risk >= 80:
        return "CRITICAL"
    if risk >= 60:
        return "HIGH"
    if risk >= 40:
        return "MEDIUM"
    if risk >= 20:
        return "LOW"
    return "INFO"


@register_tool("ai30_directory_enum")
class AI30DirectoryEnum:
    """Directory & File Enumerator Pro wrapper (conservative).

    Notes:
    - Gated behind authorizationConfirmed because it performs active directory brute-forcing.
    - Suppresses stdout/stderr to preserve scanner JSON-only stdout contract.
    - Uses smaller wordlist and reduced threads to keep runtime and noise reasonable.
    """

    name = "ai30_directory_enum"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="Directory Enumerator Pro skipped (authorization not confirmed)",
                    description=(
                        "This tool performs active directory and file brute-forcing to discover hidden or sensitive paths. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable directory enumeration.",
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

        # Conservative defaults
        threads = int(os.getenv("SENTINEL_DIRECTORY_ENUM_THREADS", "10") or "10")
        threads = max(2, min(threads, 20))

        try:
            module = _safe_import_ai30_script("directory_enumerator_pro.py")

            # Use reduced wordlist for enterprise scanning (high-signal paths only)
            words = list(module.DEFAULT_WORDS)[:25]  # Top 25 high-value paths
            words.extend([
                ".env.local", ".env.production", "config.json", "credentials.json",
                "database.json", "secrets.json", "admin.php", "phpmyadmin", 
                "adminer.php", "wp-config.php.bak", ".git/config", ".svn/entries"
            ])

            import queue
            import threading

            q = queue.Queue()
            results = []

            for w in set(words):
                q.put(w)

            worker = getattr(module, "worker", None)
            if worker is None:
                raise AttributeError("worker function not found")

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                # Start workers
                for _ in range(threads):
                    t = threading.Thread(target=worker, args=(base_url, q, results), daemon=True)
                    t.start()

                q.join()

            # Filter and convert to findings
            findings: List[Dict[str, Any]] = []
            for r in sorted(results, key=lambda x: x.get("risk", 0), reverse=True)[:50]:
                risk = int(r.get("risk") or 0)
                severity = _risk_to_severity(risk)
                
                # Keep only meaningful findings
                if risk < 20:
                    continue

                findings.append(
                    _finding(
                        title=f"Exposed directory or file detected ({severity})",
                        description=(
                            f"Directory enumeration discovered a potentially sensitive path responding with status {r.get('status')}. "
                            "Validate whether this resource should be publicly accessible."
                        ),
                        severity=severity,
                        remediation=(
                            "Restrict access to sensitive directories via web server configuration; "
                            "remove backup files and configuration files from public web roots; "
                            "enforce deny rules for .env, .git, admin panels, and development artifacts."
                        ),
                        evidence={
                            "url": r.get("url"),
                            "path": r.get("path"),
                            "status": r.get("status"),
                            "size": r.get("size"),
                            "risk": risk,
                        },
                    )
                )

            if not findings and results:
                return [
                    _finding(
                        title="Directory enumeration completed (no high-risk paths)",
                        description=f"Probed {len(results)} paths but none exceeded the risk threshold.",
                        severity="INFO",
                        remediation="Continue periodic directory scans to detect newly exposed paths.",
                        evidence={"probedPaths": len(results)},
                    )
                ]

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="Directory Enumerator Pro failed",
                    description="Directory Enumerator Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies (requests) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
