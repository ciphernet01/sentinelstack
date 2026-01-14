import argparse
import sys
from pathlib import Path

# When executed as a script (e.g., `python ./scanners/scanner.py`), Python sets
# sys.path[0] to `./scanners`, which can prevent importing project packages.
# Add the repository root to sys.path to keep imports stable.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scanners.engine import ScanContext, ScanEngine, ToolExecutor, ToolRegistry, dumps_findings
from scanners.presets import PRESETS, resolve_preset_modules

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
    
    args = parser.parse_args()

    ctx = ScanContext(target=args.target, scope=args.scope, assessment_id=args.assessment_id)
    ctx.metadata["authorizationConfirmed"] = str(args.authorization_confirmed).strip().lower() in {"1", "true", "yes"}

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

    engine = ScanEngine(registry=registry, executor=ToolExecutor())

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


