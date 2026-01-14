
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import sys
import time

from .context import ScanContext
from .executor import ToolExecutor
from .registry import ToolRegistry


def _severity_rank(severity: str) -> int:
	order = {
		"CRITICAL": 0,
		"HIGH": 1,
		"MEDIUM": 2,
		"LOW": 3,
		"INFO": 4,
	}
	return order.get(severity, 99)


def _sort_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
	return sorted(
		findings,
		key=lambda f: (
			_severity_rank(str(f.get("severity", "INFO"))),
			str(f.get("toolName", "")).lower(),
			str(f.get("title", "")).lower(),
		),
	)


@dataclass(frozen=True, slots=True)
class ScanEngine:
	"""Core scan engine orchestrating registered tools."""

	registry: ToolRegistry
	executor: ToolExecutor

	def run(self, ctx: ScanContext) -> ScanContext:
		for tool in self.registry.resolve_all():
			supported = getattr(tool, "supported_scopes", ["FULL"])
			if ctx.scope != "FULL" and ctx.scope not in supported:
				continue

			tool_name = getattr(tool, "name", None) or getattr(tool, "__tool_name__", None) or tool.__class__.__name__
			start = time.time()
			print(f"[SCAN] tool_start name={tool_name}", file=sys.stderr, flush=True)

			result = self.executor.execute(tool, ctx)
			duration_ms = int((time.time() - start) * 1000)
			status = "ok" if result.ok else "error"
			print(
				f"[SCAN] tool_end name={tool_name} status={status} findings={len(result.findings)} duration_ms={duration_ms}",
				file=sys.stderr,
				flush=True,
			)
			ctx.findings.extend(result.findings)

		ctx.findings = _sort_findings(ctx.findings)
		return ctx


