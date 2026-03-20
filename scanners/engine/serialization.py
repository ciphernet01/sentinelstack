from __future__ import annotations

import json
from typing import Any, Dict, List


def dumps_findings(findings: List[Dict[str, Any]]) -> str:
    # Deterministic JSON output:
    # - stable key order via sort_keys
    # - stable separators
    # - ensure_ascii keeps output stable for unicode targets
    return json.dumps(findings, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

