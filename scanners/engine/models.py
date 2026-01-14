from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Literal, Mapping, Optional


Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
AssessmentScope = Literal["WEB", "API", "AUTH", "FULL"]


@dataclass(frozen=True, slots=True)
class ScanTarget:
    url: str


@dataclass(frozen=True, slots=True)
class ScanConfig:
    scope: AssessmentScope


@dataclass(frozen=True, slots=True)
class Finding:
    tool_name: str
    title: str
    description: str
    severity: Severity
    remediation: str
    evidence: Mapping[str, Any] = field(default_factory=dict)
    compliance_mapping: List[str] = field(default_factory=list)

    def to_prisma_dict(self) -> Dict[str, Any]:
        # Keep keys aligned with Prisma Finding model
        return {
            "toolName": self.tool_name,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "remediation": self.remediation,
            "evidence": dict(self.evidence),
            "complianceMapping": list(self.compliance_mapping),
        }


@dataclass(frozen=True, slots=True)
class ToolMetadata:
    name: str
    supported_scopes: List[AssessmentScope]


@dataclass(frozen=True, slots=True)
class ToolError:
    tool_name: str
    message: str
    error_type: str
    details: Mapping[str, Any] = field(default_factory=dict)

    def to_finding(self) -> Finding:
        # Represent tool failures as INFO findings so the engine never crashes
        # and the Node worker (which expects an array of findings) can ingest it.
        return Finding(
            tool_name=self.tool_name,
            title=f"Tool execution failed: {self.tool_name}",
            description=self.message,
            severity="INFO",
            remediation="Review tool logs and configuration; retry the assessment.",
            evidence={
                "errorType": self.error_type,
                **dict(self.details),
            },
            compliance_mapping=[],
        )


def severity_rank(severity: Severity) -> int:
    order = {
        "CRITICAL": 0,
        "HIGH": 1,
        "MEDIUM": 2,
        "LOW": 3,
        "INFO": 4,
    }
    return order[severity]


def sort_findings(findings: Iterable[Finding]) -> List[Finding]:
    return sorted(
        list(findings),
        key=lambda f: (severity_rank(f.severity), f.tool_name.lower(), f.title.lower()),
    )
