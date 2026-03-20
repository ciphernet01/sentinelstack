from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional


AssessmentScope = Literal["WEB", "API", "AUTH", "FULL"]


@dataclass(slots=True)
class ScanContext:
	"""Scan-wide context passed through the engine and tools.

	Notes:
	- This is intentionally explicit (no globals).
	- Tools may append findings, but should not print to stdout/stderr.
	"""

	target: str
	scope: AssessmentScope
	assessment_id: str
	findings: List[Dict[str, Any]] = field(default_factory=list)
	metadata: Dict[str, Any] = field(default_factory=dict)



