from __future__ import annotations

import os
import threading
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
DEFAULT_TOOL_TIMEOUT_SECONDS = 900.0


def _tool_timeout_seconds() -> float:
	"""Per-tool soft timeout. Override with SCANNER_TOOL_TIMEOUT_MS (milliseconds)."""
	raw = str(os.environ.get("SCANNER_TOOL_TIMEOUT_MS", "") or "").strip()
	try:
		ms = int(raw) if raw else 0
	except ValueError:
		ms = 0
	if ms <= 0:
		return DEFAULT_TOOL_TIMEOUT_SECONDS
	# Honor the configured value with a small 1s floor to avoid accidental instant timeouts.
	return max(1.0, ms / 1000.0)


@dataclass(frozen=True, slots=True)
class ToolExecutionResult:
	tool_name: str
	ok: bool
	findings: List[Dict[str, Any]]
	error_type: str | None = None


def _timeout_finding(tool_name: str, timeout_s: float) -> Dict[str, Any]:
	return {
		"toolName": str(tool_name),
		"title": f"Tool execution timed out: {tool_name}",
		"description": (
			f"{tool_name} exceeded its per-tool time limit of {int(timeout_s)}s "
			"and was abandoned so the rest of the assessment could continue."
		),
		"severity": "INFO",
		"remediation": (
			"Rerun the assessment, or raise SCANNER_TOOL_TIMEOUT_MS if deeper "
			"coverage from this tool is required."
		),
		"evidence": {"errorType": "ToolTimeout", "timeoutSeconds": int(timeout_s)},
		"complianceMapping": [],
	}


def _unusable_finding(tool_name: str, raw: Any, exc: Exception) -> Dict[str, Any]:
	return {
		"toolName": str(tool_name),
		"title": "Tool returned a non-standard finding",
		"description": "The scanner tool returned output that could not be mapped to the report schema.",
		"severity": "INFO",
		"remediation": "Review the tool adapter and normalize its finding output.",
		"evidence": {
			"errorType": type(exc).__name__,
			"raw": str(raw)[:MAX_EVIDENCE_STRING_LENGTH],
		},
		"complianceMapping": [],
	}


class ToolExecutor:
	"""Safe execution wrapper for security tools with fault isolation.

	- Each tool runs in a worker thread with a soft timeout, so a hung tool
	  cannot consume the entire scan budget: the run continues and the tool is
	  recorded as a timeout exception (visible in the report's Assessment
	  Limitations section).
	- Each raw finding is normalized independently, so one malformed finding
	  can no longer fail the whole tool.
	"""

	def execute(self, tool: Any, ctx: Any) -> ToolExecutionResult:
		tool_name = getattr(tool, "name", None) or getattr(tool, "__tool_name__", None) or tool.__class__.__name__
		timeout_s = _tool_timeout_seconds()

		holder: Dict[str, Any] = {}

		def _run() -> None:
			try:
				if getattr(tool, "_is_stub", False):
					raise RuntimeError(f"Refusing to execute non-production stub tool: {tool_name}")
				holder["findings"] = tool.run(ctx)
			except Exception as exc:  # noqa: BLE001
				holder["error"] = exc
				holder["traceback"] = traceback.format_exc().splitlines()

		worker = threading.Thread(target=_run, name=f"tool-{tool_name}", daemon=True)
		worker.start()
		worker.join(timeout=timeout_s)

		if worker.is_alive():
			return ToolExecutionResult(
				tool_name=str(tool_name),
				ok=False,
				findings=[_timeout_finding(tool_name, timeout_s)],
				error_type="ToolTimeout",
			)

		error = holder.get("error")
		if error is not None:
			trace = holder.get("traceback")
			return ToolExecutionResult(
				tool_name=str(tool_name),
				ok=False,
				findings=[
					{
						"toolName": str(tool_name),
						"title": f"Tool execution failed: {tool_name}",
						"description": str(error) or "Tool raised an exception",
						"severity": "INFO",
						"remediation": "Review tool logs and configuration; retry the assessment.",
						"evidence": {
							"errorType": type(error).__name__,
							"traceback": trace if isinstance(trace, list) else [],
						},
						"complianceMapping": [],
					}
				],
				error_type=type(error).__name__,
			)

		findings = holder.get("findings")
		if findings is None:
			findings = []
		if not isinstance(findings, list):
			findings = [findings]

		normalized: List[Dict[str, Any]] = []
		for raw in list(findings):
			try:
				normalized.append(_normalize_finding(raw, str(tool_name)))
			except Exception as exc:  # noqa: BLE001
				normalized.append(_unusable_finding(str(tool_name), raw, exc))

		return ToolExecutionResult(
			tool_name=str(tool_name),
			ok=True,
			findings=normalized,
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
