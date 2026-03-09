from __future__ import annotations

import io
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

from scanners.engine.registry import register_tool
from scanners.tools._safe_import import safe_import_ai30_script


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "LogicFlaw Sentinel Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A01-2021", "OWASP-A04-2021"],
    }


def _env_truthy(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


@register_tool("ai30_logicflaw_sentinel")
class AI30LogicFlawSentinel:
    """LogicFlaw Sentinel Pro wrapper (enterprise-safe defaults).

    The upstream tool performs active workflow probing with POST/PUT/DELETE in its scenarios.
    To avoid unintended side effects, this wrapper defaults to SAFE methods only (GET/HEAD/OPTIONS)
    even when authorizationConfirmed is true.

    To allow mutation methods (POST/PUT/PATCH/DELETE), set:
      SENTINEL_LOGICFLAW_ALLOW_MUTATION=true

    Always gated behind authorizationConfirmed.
    """

    name = "ai30_logicflaw_sentinel"
    supported_scopes = ["WEB", "API", "FULL"]

    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="LogicFlaw Sentinel skipped (authorization not confirmed)",
                    description=(
                        "This tool performs active workflow probing to detect business logic flaws (step skipping, replay, race, tampering). "
                        "It is disabled unless scan authorization is explicitly confirmed."
                    ),
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true for the assessment to enable LogicFlaw Sentinel.",
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

        allow_mutation = _env_truthy("SENTINEL_LOGICFLAW_ALLOW_MUTATION", default=False)
        max_workers = int(os.getenv("SENTINEL_LOGICFLAW_MAX_WORKERS", "2") or "2")
        max_workers = max(1, min(max_workers, 4))
        max_workflows = int(os.getenv("SENTINEL_LOGICFLAW_MAX_WORKFLOWS", "3") or "3")
        max_workflows = max(1, min(max_workflows, 10))

        try:
            module = safe_import_ai30_script("logicflaw_sentinel.py")

            LogicFlawSentinelPro = getattr(module, "LogicFlawSentinelPro", None)
            BusinessRiskAssessor = getattr(module, "BusinessRiskAssessor", None)
            if LogicFlawSentinelPro is None or BusinessRiskAssessor is None:
                raise AttributeError("LogicFlawSentinelPro/BusinessRiskAssessor not found")

            # Instantiate tool
            scanner = LogicFlawSentinelPro(
                base_url,
                client_name="Sentinel",
                max_workers=max_workers,
                verify_ssl=True,
            )

            # Default to safe HTTP methods only to avoid side effects.
            # We do this by monkeypatching the underlying HTTP client.
            http_client = getattr(scanner, "http_client", None)
            if http_client is not None:
                original_safe_request = getattr(http_client, "safe_request", None)

                if callable(original_safe_request) and not allow_mutation:
                    def safe_request_limited(*, method: str, url: str, **kwargs):
                        m = (method or "").strip().upper()
                        if m not in {"GET", "HEAD", "OPTIONS"}:
                            # Return a stable "blocked" response shape.
                            return {
                                "status_code": 405,
                                "text": "",
                                "headers": {},
                                "url": url,
                                "blocked": True,
                                "blocked_method": m,
                            }
                        return original_safe_request(method=method, url=url, **kwargs)

                    http_client.safe_request = safe_request_limited  # type: ignore[assignment]

            # Reduce workload: cap workflows.
            try:
                scanner.scenarios = list(getattr(scanner, "scenarios", []) or [])[:max_workflows]
            except Exception:
                pass

            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                raw = scanner.run_comprehensive_tests() or []

            # Normalize results to dicts and compute business severity.
            normalized: List[Dict[str, Any]] = []
            for item in raw:
                if hasattr(item, "to_dict"):
                    d = item.to_dict()
                elif isinstance(item, dict):
                    d = dict(item)
                else:
                    continue

                d = BusinessRiskAssessor.assess_finding(d)
                normalized.append(d)

            # Convert to our platform finding schema.
            findings: List[Dict[str, Any]] = []
            for f in normalized:
                exec_sev = _normalize_severity(f.get("executive_severity") or "INFO")
                business_score = int(f.get("business_score") or 0)

                # Filter low-signal.
                if exec_sev == "INFO" and business_score < 25:
                    continue

                classification = f.get("classification") or []
                if isinstance(classification, str):
                    classification = [classification]

                title_bits = ["Business logic weakness"]
                if classification:
                    title_bits.append("/".join(str(x) for x in classification[:3]))
                title_bits.append(f"{exec_sev} ({business_score})")

                findings.append(
                    _finding(
                        title=" - ".join(title_bits),
                        description=(
                            "Workflow probing detected behavior consistent with business logic flaws (e.g., step skipping, replay, race conditions, or tampering). "
                            "Validate state transitions, idempotency, and authorization across workflow steps."
                        ),
                        severity=exec_sev,
                        remediation=(
                            "Implement server-side workflow state validation; enforce idempotency keys for sensitive actions; "
                            "add anti-replay controls (nonce/timestamp); validate authorization on every step; "
                            "rate-limit sensitive operations; add concurrency controls (optimistic locking) for state changes."
                        ),
                        evidence={
                            "workflow": f.get("workflow"),
                            "step": f.get("step"),
                            "url": f.get("url"),
                            "method": f.get("method"),
                            "classification": classification,
                            "scores": {
                                "technical": f.get("technical_score"),
                                "business": business_score,
                            },
                            "vulnerabilityIds": f.get("vulnerability_ids"),
                            "businessImpacts": f.get("business_impacts"),
                            "complianceViolations": f.get("compliance_violations"),
                            "remediationTimeline": f.get("remediation_timeline"),
                            "riskOwner": f.get("risk_owner"),
                            "evidence": f.get("evidence"),
                            "config": {
                                "maxWorkers": max_workers,
                                "maxWorkflows": max_workflows,
                                "allowMutation": allow_mutation,
                            },
                        },
                    )
                )

            if not findings and normalized:
                return [
                    _finding(
                        title="LogicFlaw Sentinel completed (no significant issues)",
                        description="LogicFlaw Sentinel ran workflow probes but did not produce significant findings above the reporting threshold.",
                        severity="INFO",
                        remediation="Consider allowing mutation methods in a staging environment (SENTINEL_LOGICFLAW_ALLOW_MUTATION=true) for deeper coverage.",
                        evidence={
                            "totalRawFindings": len(normalized),
                            "allowMutation": allow_mutation,
                        },
                    )
                ]

            return findings

        except Exception as exc:
            return [
                _finding(
                    title="LogicFlaw Sentinel failed",
                    description="LogicFlaw Sentinel Pro could not be executed in the current environment.",
                    severity="INFO",
                    remediation="Ensure the AI30 script exists and the scanner runtime has required Python dependencies (requests) and retry.",
                    evidence={"error": str(exc)},
                )
            ]
