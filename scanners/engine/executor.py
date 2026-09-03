
from __future__ import annotations

import traceback
from dataclasses import dataclass
from typing import Any, Dict, List


VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}
SENSITIVE_KEYS = {
	"authorization",
	"cookie",
	"token",
	"auth_token",
	"access_token",
	"refresh_token",
	"secret",
	"password",
	"passwd",
	"api_key",
	"apikey",
	"access_key",
	"private_key",
	"set_cookie",
	"x_api_key",
	"x_auth_token",
}
MAX_EVIDENCE_STRING_LENGTH = 2000


@dataclass(frozen=True, slots=True)
class ToolExecutionResult:
	tool_name: str
	ok: bool
	findings: List[Dict[str, Any]]
	error_type: str | None = None


class ToolExecutor:
	"""Safe execution wrapper for security tools with fault isolation."""

	def execute(self, tool: Any, ctx: Any) -> ToolExecutionResult:
		tool_name = getattr(tool, "name", None) or getattr(tool, "__tool_name__", None) or tool.__class__.__name__

		try:
			if getattr(tool, "_is_stub", False):
				raise RuntimeError(f"Refusing to execute non-production stub tool: {tool_name}")

			findings = tool.run(ctx)
			if findings is None:
				findings = []
			return ToolExecutionResult(
				tool_name=tool_name,
				ok=True,
				findings=[_normalize_finding(finding, str(tool_name)) for finding in list(findings)],
			)
		except Exception as exc:  # noqa: BLE001
			return ToolExecutionResult(
				tool_name=tool_name,
				ok=False,
				findings=[
					{
						"toolName": str(tool_name),
						"title": f"Tool execution failed: {tool_name}",
						"description": str(exc) or "Tool raised an exception",
						"severity": "INFO",
						"remediation": "Review tool logs and configuration; retry the assessment.",
						"evidence": {
							"errorType": type(exc).__name__,
							"traceback": traceback.format_exc().splitlines(),
						},
						"complianceMapping": [],
					}
				],
				error_type=type(exc).__name__,
			)


def _is_sensitive_key(key: str) -> bool:
	normalized = key.lower().replace("-", "_")
	if normalized in SENSITIVE_KEYS:
		return True
	return (
		normalized.endswith("_token")
		or normalized.endswith("_secret")
		or normalized.endswith("_password")
		or normalized.endswith("_api_key")
	)


def _sanitize_evidence(value: Any, key: str | None = None) -> Any:
	if key and _is_sensitive_key(key):
		return "[REDACTED]"

	if isinstance(value, dict):
		return {str(k): _sanitize_evidence(v, str(k)) for k, v in value.items()}

	if isinstance(value, list):
		return [_sanitize_evidence(item, key) for item in value[:100]]

	if isinstance(value, tuple):
		return [_sanitize_evidence(item, key) for item in list(value)[:100]]

	if isinstance(value, str):
		if len(value) > MAX_EVIDENCE_STRING_LENGTH:
			return value[:MAX_EVIDENCE_STRING_LENGTH] + "...[truncated]"
		return value

	if isinstance(value, (int, float, bool)) or value is None:
		return value

	return str(value)[:MAX_EVIDENCE_STRING_LENGTH]


def _normalize_finding(raw: Any, default_tool_name: str) -> Dict[str, Any]:
	if not isinstance(raw, dict):
		return {
			"toolName": default_tool_name,
			"title": "Tool returned a non-standard finding",
			"description": "The scanner tool returned output that could not be mapped directly to the report schema.",
			"severity": "INFO",
			"remediation": "Review the tool adapter and normalize its finding output.",
			"evidence": {"raw": _sanitize_evidence(raw)},
			"complianceMapping": [],
		}

	severity = str(raw.get("severity") or "INFO").strip().upper()
	if severity not in VALID_SEVERITIES:
		severity = "INFO"

	evidence = raw.get("evidence")
	if not isinstance(evidence, dict):
		evidence = {"rawEvidence": evidence} if evidence is not None else {}

	return {
		"toolName": str(raw.get("toolName") or default_tool_name),
		"title": str(raw.get("title") or "Untitled scanner finding")[:300],
		"description": str(raw.get("description") or "No description provided.")[:4000],
		"severity": severity,
		"remediation": str(raw.get("remediation") or "Review this finding manually and validate impact.")[:4000],
		"evidence": _sanitize_evidence(evidence),
		"complianceMapping": list(raw.get("complianceMapping") or []),
	}


