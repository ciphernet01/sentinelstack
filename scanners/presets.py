from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class ToolPreset:
    """Defines which Python tool modules get loaded for a scan.

    The scanner loads modules (e.g., `scanners.tools.jwt`) and the registry
    registers all `@register_tool` tool classes inside them.
    """

    name: str
    module_paths: List[str]


DEFAULT_TOOL_MODULES: List[str] = [
    "scanners.tools.cors",
    "scanners.tools.idor",
    "scanners.tools.jwt",
]

# "Deep" and "enterprise" can be expanded over time as you integrate new tools.
PRESETS: Dict[str, ToolPreset] = {
    "default": ToolPreset(name="default", module_paths=DEFAULT_TOOL_MODULES),
    # Backwards-compatible aliases: older code stored scope into toolPreset.
    "web": ToolPreset(name="web", module_paths=DEFAULT_TOOL_MODULES),
    "api": ToolPreset(name="api", module_paths=DEFAULT_TOOL_MODULES),
    "auth": ToolPreset(name="auth", module_paths=DEFAULT_TOOL_MODULES),
    "full": ToolPreset(name="full", module_paths=DEFAULT_TOOL_MODULES),
    "deep": ToolPreset(
        name="deep",
        module_paths=[
            *DEFAULT_TOOL_MODULES,
            "scanners.tools.admin_exposure",
            "scanners.tools.ai30_cors_analyzer",
            "scanners.tools.ai30_header_ssl_analyzer",
            # Deep injection scanners
            "scanners.tools.ai30_sqli",
            "scanners.tools.ai30_xss",
            "scanners.tools.ai30_secrets",
            "scanners.tools.ai30_ssrf",
            # Recon & evasion
            "scanners.tools.ai30_tech",
            "scanners.tools.ai30_waf",
        ],
    ),
    "access-control": ToolPreset(
        name="access-control",
        module_paths=[
            *DEFAULT_TOOL_MODULES,
            # Higher-signal authz checks (still conservative defaults)
            "scanners.tools.ai30_broken_access_control",
            "scanners.tools.ai30_authzscope",
        ],
    ),
    "access_control": ToolPreset(
        name="access_control",
        module_paths=[
            *DEFAULT_TOOL_MODULES,
            "scanners.tools.ai30_broken_access_control",
            "scanners.tools.ai30_authzscope",
        ],
    ),
    "enterprise": ToolPreset(
        name="enterprise",
        module_paths=[
            *DEFAULT_TOOL_MODULES,
            "scanners.tools.admin_exposure",
            "scanners.tools.ai30_cors_analyzer",
            "scanners.tools.ai30_header_ssl_analyzer",
            "scanners.tools.ai30_rateguard",
            "scanners.tools.ai30_tokenscope",
            "scanners.tools.ai30_broken_access_control",
            "scanners.tools.ai30_sensitive_files",
            "scanners.tools.ai30_sessionguard",
            "scanners.tools.ai30_subdomain_finder",
            "scanners.tools.ai30_attack_surface",
            "scanners.tools.ai30_authzscope",
            "scanners.tools.ai30_tokenlifecycle",
            "scanners.tools.ai30_objectscope",
            "scanners.tools.ai30_log_analyzer",
            "scanners.tools.ai30_threat_intel",
            "scanners.tools.ai30_api_enum",
            "scanners.tools.ai30_directory_enum",
            "scanners.tools.ai30_authshield",
            "scanners.tools.ai30_logicflaw_sentinel",
            "scanners.tools.pro_suite",
            # Deep injection & recon tools
            "scanners.tools.ai30_sqli",
            "scanners.tools.ai30_xss",
            "scanners.tools.ai30_secrets",
            "scanners.tools.ai30_ssrf",
            "scanners.tools.ai30_tech",
            "scanners.tools.ai30_waf",
        ],
    ),
}


def _normalize_preset_key(preset: str | None) -> str:
    key = (preset or "default").strip().lower()

    # Normalize common separators
    key = key.replace("_", "-").replace(" ", "-")
    while "--" in key:
        key = key.replace("--", "-")

    # Access control quickscan aliases
    if key in {"access-control", "access-control-quickscan", "access-control-quickscan-(idor)", "access-control-quickscan-idor"}:
        return "access-control"
    if "access" in key and "control" in key:
        return "access-control"
    if "idor" in key:
        return "access-control"

    return key


def resolve_preset_modules(preset: str | None) -> List[str]:
    key = _normalize_preset_key(preset)
    return PRESETS.get(key, PRESETS["default"]).module_paths
