from __future__ import annotations


class FixSuggester:
    """Pattern-based remediation with an LLM-style explanation stub."""

    FIX_MAP = {
        "dependency unavailable": "Check upstream service health and retry policies; verify service discovery and DNS.",
        "latency escalation": "Inspect p95 latency, increase timeout budgets, and scale hot path handlers.",
        "memory pressure": "Capture heap profile, roll back recent memory-heavy changes, and increase memory limits.",
        "database": "Review slow queries, connection pool size, and lock contention metrics.",
        "throttling": "Tune rate limits, add queue backpressure, and smooth burst traffic with buffering.",
        "authorization": "Validate token scopes, rotated secrets, and policy bindings.",
        "disk": "Purge old artifacts, increase volume capacity, and validate log rotation policy.",
    }

    def suggest_fix(self, root_cause: str) -> str:
        lowered = root_cause.lower()
        for pattern, fix in self.FIX_MAP.items():
            if pattern in lowered:
                return fix
        return "Collect correlated metrics (CPU, memory, dependency latency), verify recent deploys, and run rollback canary if needed."

    def generate_explanation(self, root_cause: str) -> str:
        """Mock LLM response for human-readable incident context."""
        return (
            "LLM Stub: The incident appears driven by '"
            f"{root_cause}'. Prioritize containment first, then validate the suggested fix "
            "with staged rollout and post-incident regression checks."
        )
