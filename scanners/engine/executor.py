
from __future__ import annotations

import traceback
from dataclasses import dataclass
from typing import Any, Dict, List


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
			findings = tool.run(ctx)
			if findings is None:
				findings = []
			return ToolExecutionResult(tool_name=tool_name, ok=True, findings=list(findings))
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


