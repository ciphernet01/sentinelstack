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
        "toolName": "ObjectScope Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "CWE-639"],
    }


@register_tool("ai30_objectscope")
class AI30ObjectScope:
    """ObjectScope Pro wrapper (conservative).

    Notes:
    - Gated behind authorizationConfirmed because it performs active object-ID probing.
    - Suppresses stdout/stderr to preserve scanner JSON-only stdout contract.
    - Reduces endpoints/IDs/threads to keep runtime and noise reasonable.
    """

    name = "ai30_objectscope"
    supported_scopes = ["API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="ObjectScope Pro skipped (authorization not confirmed)",
                    description=(
                        "This tool performs active object boundary probing (IDOR-style checks). "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable ObjectScope Pro.",
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

        # Conservative defaults; can be overridden via env if you want.
        threads = int(os.getenv("SENTINEL_OBJECTSCOPE_THREADS", "2") or "2")
        threads = max(1, min(threads, 4))

        try:
            module = _safe_import_ai30_script("objectscope_pro.py")

            # Reduce default probing set before tool instantiation.
            module.OBJECT_ENDPOINTS = [
                "/api/users/{id}",
                "/api/user/{id}",
                "/api/orders/{id}",
                "/api/order/{id}",
                "/user/{id}",
                "/profile/{id}",
            ]
            module.TEST_OBJECT_IDS = ["1", "2", "3", "10", "999"]
            module.HTTP_METHODS = ["GET"]

            ObjectScopePro = getattr(module, "ObjectScopePro", None)
            if ObjectScopePro is None:
                raise AttributeError("ObjectScopePro not found")

            tool = ObjectScopePro(base_url, threads=threads)
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                raw_findings = tool.run() or []

            findings: List[Dict[str, Any]] = []
            for f in raw_findings:
                score = int(f.get("score") or 0)
                severity = str(f.get("severity") or "INFO")
                # Keep only meaningful signals; the AI30 tool emits low-signal 404/hidden entries.
                if score < 30:
                    continue

                url = f.get("url")
                endpoint = f.get("endpoint")
                obj_id = f.get("object_id")
                behavior = f.get("behavior")
                risk = f.get("risk")

                findings.append(
                    _finding(
                        title="Potential IDOR / object access issue",
                        description=(
                            "The application responded unexpectedly to unauthenticated object requests. "
                            "Validate authorization checks for object-level access control."
                        ),
                        severity=severity,
                        remediation=(
                            "Enforce object-level authorization checks on every request; "
                            "avoid predictable identifiers or protect them with access control; "
                            "return 404/403 consistently and log access denials."
                        ),
                        evidence={
                            "url": url,
                            "endpointTemplate": endpoint,
                            "objectId": obj_id,
                            "behavior": behavior,
                            "risk": risk,
                            "score": score,
                            "threads": threads,
                        },
                    )
                )

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="ObjectScope Pro failed",
                    description="ObjectScope Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the scanner runtime has required Python dependencies (requests) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
