import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

# When executed as a script (e.g., `python ./scanners/scanner.py`), Python sets
# sys.path[0] to `./scanners`, which can prevent importing project packages.
# Add the repository root to sys.path to keep imports stable.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scanners.engine import ScanContext, ScanEngine, ToolExecutor, ToolRegistry, dumps_findings
from scanners.presets import PRESETS, resolve_preset_modules


def get_findings_backup_path(assessment_id: str) -> Path:
    """Get path for incremental findings backup file."""
    tmp_dir = Path(tempfile.gettempdir()) / "sentinel_scanner"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    return tmp_dir / f"findings_{assessment_id}.json"


def save_findings_incrementally(findings: list, assessment_id: str) -> None:
    """Save current findings to backup file for recovery on timeout."""
    try:
        backup_path = get_findings_backup_path(assessment_id)
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(findings, f)
    except Exception:
        pass  # Best effort - don't fail the scan if backup fails

def main():
    """CLI entrypoint used by the Node worker.

    Contract:
    - stdout: a single JSON array of findings
    - stderr: optional debug logs
    - exit code: 0 on success
    """
    parser = argparse.ArgumentParser(description="Sentinel Stack - Unified Security Scanner")
    parser.add_argument("--target", required=True, help="The target URL to scan.")
    parser.add_argument("--scope", required=True, choices=["WEB", "API", "AUTH", "FULL"], help="The scope of the assessment.")
    parser.add_argument(
        "--preset",
        required=False,
        default="default",
        help="Tool preset to run (default, deep, enterprise).",
    )
    parser.add_argument(
        "--assessment_id",
        required=False,
        default="unknown",
        help="Assessment identifier (passed from the backend worker).",
    )
    parser.add_argument(
        "--authorization_confirmed",
        required=False,
        default="false",
        help="Whether scan authorization was confirmed (true/false).",
    )
    
    # Optional scan configuration arguments
    parser.add_argument(
        "--cookies",
        required=False,
        default="",
        help="Cookies to include in requests (format: 'key=value; key2=value2').",
    )
    parser.add_argument(
        "--headers",
        required=False,
        default="",
        help="Custom headers as JSON object (e.g., '{\"Authorization\": \"Bearer token\"}').",
    )
    parser.add_argument(
        "--wordlist",
        required=False,
        default="",
        help="Path to custom wordlist file for directory enumeration.",
    )
    parser.add_argument(
        "--scan_options",
        required=False,
        default="{}",
        help="Additional scan options as JSON object.",
    )
    
    args = parser.parse_args()

    ctx = ScanContext(target=args.target, scope=args.scope, assessment_id=args.assessment_id)
    ctx.metadata["authorizationConfirmed"] = str(args.authorization_confirmed).strip().lower() in {"1", "true", "yes"}
    
    # Parse and store scan options in metadata for tools to use
    ctx.metadata["cookies"] = args.cookies.strip() if args.cookies else None
    ctx.metadata["wordlist"] = args.wordlist.strip() if args.wordlist else None
    
    # Parse custom headers
    if args.headers and args.headers.strip():
        try:
            ctx.metadata["headers"] = json.loads(args.headers)
        except json.JSONDecodeError:
            ctx.metadata["headers"] = None
    else:
        ctx.metadata["headers"] = None
    
    # Parse additional scan options
    if args.scan_options and args.scan_options.strip():
        try:
            extra_opts = json.loads(args.scan_options)
            if isinstance(extra_opts, dict):
                for k, v in extra_opts.items():
                    ctx.metadata[k] = v
        except json.JSONDecodeError:
            pass

    preset_key = str(args.preset).strip().lower()
    module_paths = resolve_preset_modules(preset_key)
    if preset_key not in PRESETS:
        ctx.findings.append(
            {
                "toolName": "preset",
                "title": "Unknown tool preset; falling back to default",
                "description": f"Preset '{preset_key}' is not defined. Using the default tool set.",
                "severity": "INFO",
                "remediation": "Use one of the configured presets (default, deep, enterprise) or add a new preset in scanners/presets.py.",
                "evidence": {"preset": preset_key, "available": sorted(PRESETS.keys())},
                "complianceMapping": [],
            }
        )

    registry = ToolRegistry()
    try:
        registry.load_from_modules(module_paths)
    except Exception as exc:  # noqa: BLE001
        # Registry/module load failure should not crash the scan.
        ctx.findings.append(
            {
                "toolName": "registry",
                "title": "Tool registry load failed",
                "description": str(exc) or "Failed to load tool modules",
                "severity": "INFO",
                "remediation": "Verify tool modules are installed and importable.",
                "evidence": {"modules": module_paths, "preset": preset_key},
                "complianceMapping": [],
            }
        )

    # Create engine with incremental backup callback for timeout recovery
    engine = ScanEngine(
        registry=registry,
        executor=ToolExecutor(),
        on_tool_complete=lambda findings, aid: save_findings_incrementally(findings, aid),
    )

    # Debug logs go to stderr only.
    print(
        f"--- Starting scan: scope={ctx.scope} preset={preset_key} target={ctx.target} assessment_id={ctx.assessment_id} ---",
        file=sys.stderr,
    )

    engine.run(ctx)
    print(dumps_findings(ctx.findings))
    raise SystemExit(0)

if __name__ == "__main__":
    main()


