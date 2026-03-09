"""Shared safe-import for AI 30 Days scripts.

All AI30 scripts run colorama.init(autoreset=True) and os.makedirs() at
top-level on import.  colorama wraps sys.stdout/sys.stderr which injects
ANSI escape codes into the scanner's JSON output contract.

This module provides a single ``safe_import_ai30_script`` that:
- redirects stdout/stderr during ``exec_module`` so top-level prints don't
  leak into the scanner's JSON output.
- restores the *real* (unwrapped) ``sys.stdout`` and ``sys.stderr`` after
  exec_module to neutralise colorama's global wrappers.
"""
from __future__ import annotations

import io
import importlib.util
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


# Capture the *real* stdout/stderr before any colorama munging.
_REAL_STDOUT = sys.__stdout__ or sys.stdout
_REAL_STDERR = sys.__stderr__ or sys.stderr


def safe_import_ai30_script(script_filename: str) -> Any:
    """Import an AI 30 Days script without contaminating stdout.

    - stdout/stderr are redirected to devnull during ``exec_module`` so
      colorama.init, top-level print(), and os.makedirs messages don't leak.
    - After the import, sys.stdout/sys.stderr are restored to the *original*
      unwrapped file descriptors to undo colorama wrapping.
    """
    ai30_dir = _repo_root() / "AI 30 Days"
    script_path = ai30_dir / script_filename
    if not script_path.exists():
        raise FileNotFoundError(f"AI30 script not found: {script_path}")

    module_name = f"ai30_{script_filename.replace('.', '_')}"

    # Return cached module if already imported (avoid re-exec side-effects).
    if module_name in sys.modules:
        return sys.modules[module_name]

    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load spec for: {script_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module

    # Suppress ALL output during module init (colorama, prints, makedirs logs).
    sink = io.StringIO()
    with redirect_stdout(sink), redirect_stderr(sink):
        spec.loader.exec_module(module)

    # Restore real stdout/stderr — undoes colorama.init(autoreset=True) wrapping.
    sys.stdout = _REAL_STDOUT
    sys.stderr = _REAL_STDERR

    return module
