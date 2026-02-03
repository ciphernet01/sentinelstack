"""
PRO SUITE - PLACEHOLDER SCANNERS
=================================
⚠️ WARNING: These tools are STUBS and return EMPTY results.

These are placeholder classes for future scanner implementations.
They are registered to show available scanner categories in the UI,
but they do NOT perform actual security scanning.

DO NOT rely on these for real security assessments.

For actual working scanners, use the implemented tools in:
- ai30_*.py files (wrap AI 30 Days scripts)
- admin_exposure.py, cors_guard.py, jwt.py, idor.py, ssl_analyzer.py
"""
from __future__ import annotations

from typing import Any, Dict, List

from scanners.engine.registry import register_tool


class _StubTool:
    """A placeholder tool that returns no findings.

    ⚠️ THIS IS A STUB - It always returns empty results.
    Replace `run()` bodies with your real implementations as you port them in.
    Keep the output schema consistent with Prisma FindingCreateManyInput.
    """

    supported_scopes = ["FULL"]
    _is_stub = True  # Mark as stub for filtering in UI if needed

    def run(self, ctx) -> List[Dict[str, Any]]:
        # STUB: Always returns empty - no actual scanning performed
        return []


# Day 1–5: Broken Access Control
@register_tool("broken_access_control_pro")
class BrokenAccessControlPro(_StubTool):
    name = "broken_access_control_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("authorization_bypass_pro")
class AuthorizationBypassPro(_StubTool):
    name = "authorization_bypass_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("access_matrix_analyzer")
class AccessMatrixAnalyzer(_StubTool):
    name = "access_matrix_analyzer"
    supported_scopes = ["API", "FULL"]


@register_tool("privilege_boundary_tester")
class PrivilegeBoundaryTester(_StubTool):
    name = "privilege_boundary_tester"
    supported_scopes = ["WEB", "API", "FULL"]


# Admin Exposure Finder has a real implementation in scanners.tools.admin_exposure


# Day 6–10: Authentication & Session Security
@register_tool("authaudit_pro")
class AuthAuditPro(_StubTool):
    name = "authaudit_pro"
    supported_scopes = ["AUTH", "FULL"]


@register_tool("sessionguard_pro")
class SessionGuardPro(_StubTool):
    name = "sessionguard_pro"
    supported_scopes = ["AUTH", "FULL"]


@register_tool("session_entropy_analyzer")
class SessionEntropyAnalyzer(_StubTool):
    name = "session_entropy_analyzer"
    supported_scopes = ["AUTH", "FULL"]


@register_tool("logout_validation_pro")
class LogoutValidationPro(_StubTool):
    name = "logout_validation_pro"
    supported_scopes = ["AUTH", "FULL"]


@register_tool("multi_session_detector")
class MultiSessionDetector(_StubTool):
    name = "multi_session_detector"
    supported_scopes = ["AUTH", "FULL"]


# Day 11–15: API & Abuse Controls
@register_tool("rateguard_pro")
class RateGuardPro(_StubTool):
    name = "rateguard_pro"
    supported_scopes = ["API", "FULL"]


@register_tool("replayattack_pro")
class ReplayAttackPro(_StubTool):
    name = "replayattack_pro"
    supported_scopes = ["API", "FULL"]


@register_tool("cors_security_analyzer_pro")
class CorsSecurityAnalyzerPro(_StubTool):
    name = "cors_security_analyzer_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("header_security_pro")
class HeaderSecurityPro(_StubTool):
    name = "header_security_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("uploadguard_pro")
class UploadGuardPro(_StubTool):
    name = "uploadguard_pro"
    supported_scopes = ["WEB", "API", "FULL"]


# Day 16–20: Tokens, JWT & Identity
@register_tool("authaudit_pro_enterprise")
class AuthAuditProEnterprise(_StubTool):
    name = "authaudit_pro_enterprise"
    supported_scopes = ["AUTH", "FULL"]


@register_tool("tokenscope_pro")
class TokenScopePro(_StubTool):
    name = "tokenscope_pro"
    supported_scopes = ["AUTH", "API", "FULL"]


@register_tool("authz_pro_enterprise")
class AuthzProEnterprise(_StubTool):
    name = "authz_pro_enterprise"
    supported_scopes = ["API", "FULL"]


@register_tool("tokenlifecycle_pro")
class TokenLifecyclePro(_StubTool):
    name = "tokenlifecycle_pro"
    supported_scopes = ["AUTH", "API", "FULL"]


@register_tool("jwtinspector_pro")
class JWTInspectorPro(_StubTool):
    name = "jwtinspector_pro"
    supported_scopes = ["AUTH", "API", "FULL"]


# Day 21–25: Logic & Application Flaws
@register_tool("logicflaw_pro")
class LogicFlawPro(_StubTool):
    name = "logicflaw_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("parameter_tampering_pro")
class ParameterTamperingPro(_StubTool):
    name = "parameter_tampering_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("session_fixation_pro")
class SessionFixationPro(_StubTool):
    name = "session_fixation_pro"
    supported_scopes = ["AUTH", "FULL"]


@register_tool("clientside_exposure_pro")
class ClientSideExposurePro(_StubTool):
    name = "clientside_exposure_pro"
    supported_scopes = ["WEB", "FULL"]


@register_tool("attack_surface_mapper")
class AttackSurfaceMapper(_StubTool):
    name = "attack_surface_mapper"
    supported_scopes = ["WEB", "API", "FULL"]


# Day 26–30: Enterprise & Platform Tools
@register_tool("privilege_escalation_guard_pro")
class PrivilegeEscalationGuardPro(_StubTool):
    name = "privilege_escalation_guard_pro"
    supported_scopes = ["WEB", "API", "FULL"]


@register_tool("attacklens_pro")
class AttackLensPro(_StubTool):
    name = "attacklens_pro"
    supported_scopes = ["FULL"]


@register_tool("risk_scoring_pro")
class RiskScoringPro(_StubTool):
    name = "risk_scoring_pro"
    supported_scopes = ["FULL"]
