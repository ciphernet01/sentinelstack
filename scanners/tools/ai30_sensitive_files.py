from __future__ import annotations

import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse

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


def _severity_for_score(score: int) -> str:
    if score >= 90:
        return "CRITICAL"
    if score >= 80:
        return "HIGH"
    if score >= 60:
        return "MEDIUM"
    if score >= 30:
        return "LOW"
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "Sensitive File Detector Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A05-2021"],
    }


def _remediation_for_tags(tags: List[str]) -> str:
    recs: List[str] = []
    if "env_file" in tags:
        recs.append("Remove .env files from public web roots; rotate exposed secrets immediately.")
    if "git_exposed" in tags:
        recs.append("Block public access to .git and remove repository metadata from web roots.")
    if "backup_file" in tags:
        recs.append("Remove backup archives/dumps from web roots; store them in protected storage.")
    if "db_dump" in tags:
        recs.append("Remove database dumps from public paths; rotate credentials and validate no data exposure occurred.")
    if "log_exposed" in tags:
        recs.append("Restrict access to logs; ensure error logs are not served publicly.")
    if not recs:
        recs.append("Restrict access to sensitive files; enforce deny rules at the web server/CDN/WAF layer.")

    return "\n".join(f"- {r}" for r in recs)


@register_tool("ai30_sensitive_files")
class AI30SensitiveFiles:
    """Sensitive File & Backup Detector Pro wrapper (conservative).

    Uses the AI30 script's probing logic but runs in a non-interactive, low-noise mode:
    - Suppresses stdout/stderr to preserve stdout JSON contract.
    - Probes a small, high-signal set of common sensitive paths.
    - Gated behind authorizationConfirmed because it performs active path probing.

    Note: We intentionally avoid returning file contents/snippets in findings evidence.
    """

    name = "ai30_sensitive_files"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="Sensitive File Detector Pro skipped (authorization not confirmed)",
                    description=(
                        "This tool performs active path probing for exposed backups, configuration files, and repository leaks. "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable sensitive file discovery.",
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

        # High-signal, low-noise set of candidates.
        candidate_paths = [
            "/.env",
            "/.env.example",
            "/.git/HEAD",
            "/.git/config",
            "/backup.zip",
            "/site.zip",
            "/db.sql",
            "/dump.sql",
            "/database.sql",
            "/phpinfo.php",
            "/wp-config.php",
            "/config.json",
            "/credentials.json",
            "/server-status",
            "/logs/error.log",
            "/debug.log",
            "/local.settings.json",
        ]

        try:
            module = _safe_import_ai30_script("sensitive_file_detector_pro.py")
            probe_url = getattr(module, "probe_url", None)
            infer_tags_from_path = getattr(module, "infer_tags_from_path", None)
            compute_score_for_tags = getattr(module, "compute_score_for_tags", None)
            if probe_url is None or infer_tags_from_path is None or compute_score_for_tags is None:
                raise AttributeError("probe_url/infer_tags_from_path/compute_score_for_tags not found")

            import requests

            session = requests.Session()

            findings: List[Dict[str, Any]] = []
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                for path in candidate_paths:
                    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
                    res = probe_url(session, url, allow_get_snippet=False)
                    if not res:
                        continue

                    status = res.get("status")
                    if status not in (200, 301, 302, 403):
                        continue

                    tags = list(infer_tags_from_path(path))
                    score = int(compute_score_for_tags(tags) or 0)
                    severity = _severity_for_score(score)

                    findings.append(
                        _finding(
                            title="Potential sensitive file exposure",
                            description=(
                                "An automated probe detected a potentially sensitive path responding with an interesting status code. "
                                "Validate whether the resource is publicly accessible and contains sensitive content."
                            ),
                            severity=severity,
                            remediation=_remediation_for_tags(tags),
                            evidence={
                                "url": res.get("url"),
                                "path": path,
                                "status": status,
                                "contentType": res.get("content_type"),
                                "contentLength": res.get("content_length"),
                                "tags": tags,
                                "score": score,
                            },
                        )
                    )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="Sensitive File Detector Pro failed",
                    description="Sensitive File Detector Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies (requests) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
