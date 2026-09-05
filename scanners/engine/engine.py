
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

import json
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


def _dedupe_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
	"""Drop exact-duplicate findings (same tool, title, severity and evidence).

	Tools that scan overlapping endpoints can emit identical records; the
	report and risk score should not count the same observation twice.
	"""
	seen: set[str] = set()
	deduped: List[Dict[str, Any]] = []
	for finding in findings:
		try:
			key = json.dumps(
				[
					finding.get("toolName"),
					finding.get("title"),
					finding.get("severity"),
					finding.get("evidence"),
				],
				sort_keys=True,
				default=str,
			)[:2000]
		except Exception:
			key = repr(finding)[:2000]
		if key in seen:
			continue
		seen.add(key)
		deduped.append(finding)
	return deduped



def _safe_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
	return {
		"authorizationConfirmed": bool(metadata.get("authorizationConfirmed")),
		"assessmentProfile": metadata.get("assessmentProfile") if isinstance(metadata.get("assessmentProfile"), dict) else {},
		"engagement": metadata.get("engagement") if isinstance(metadata.get("engagement"), dict) else {},
		"hasCookies": bool(metadata.get("cookies")),
		"hasHeaders": bool(metadata.get("headers")),
		"hasWordlist": bool(metadata.get("wordlist")),
	}


@dataclass(frozen=True, slots=True)
class ScanEngine:
	"""Core scan engine orchestrating registered tools."""

	registry: ToolRegistry
	executor: ToolExecutor
	on_tool_complete: Optional[Callable[[List[Dict[str, Any]], str], None]] = None

	def run(self, ctx: ScanContext) -> ScanContext:
		tool_runs: List[Dict[str, Any]] = []
		started_at = time.time()

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
			tool_runs.append(
				{
					"name": tool_name,
					"status": status,
					"findings": len(result.findings),
					"durationMs": duration_ms,
					"errorType": result.error_type,
				}
			)
			ctx.findings.extend(result.findings)
			
			# Callback to save findings incrementally (for timeout recovery)
			if self.on_tool_complete:
				try:
					self.on_tool_complete(ctx.findings, ctx.assessment_id)
				except Exception:
					pass  # Best effort

		total_duration_ms = int((time.time() - started_at) * 1000)
		ctx.findings.append(
			{
				"toolName": "scanner",
				"title": "Assessment execution manifest",
				"description": "Scanner execution metadata recording the tools that ran, their status, runtime, and engagement context.",
				"severity": "INFO",
				"remediation": "Use this manifest to verify scanner coverage, troubleshoot failed tools, and support report auditability.",
				"evidence": {
					"target": ctx.target,
					"scope": ctx.scope,
					"assessmentId": ctx.assessment_id,
					"durationMs": total_duration_ms,
					"toolsRequested": len(tool_runs),
					"toolsSucceeded": len([run for run in tool_runs if run["status"] == "ok"]),
					"toolsFailed": len([run for run in tool_runs if run["status"] != "ok"]),
				"deduplicatedFindings": deduplicated_count,
					"toolRuns": tool_runs,
					"metadata": _safe_metadata(ctx.metadata or {}),
				},
				"complianceMapping": [],
			}
		)
		deduped = _dedupe_findings(ctx.findings)
		deduplicated_count = max(0, len(ctx.findings) - len(deduped))
		ctx.findings = deduped

		ctx.findings = _sort_findings(ctx.findings)
		return ctx


