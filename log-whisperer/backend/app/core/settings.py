"""Runtime settings for production-safe configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@dataclass
class RuntimeSettings:
    env: str
    debug: bool
    app_name: str
    app_version: str
    api_prefix: str
    window_size_sec: int
    alert_threshold: int
    critical_threshold: int
    warmup_event_threshold: int
    cors_allowed_origins: list[str]
    require_api_key: bool
    api_key: str | None

    @classmethod
    def load(cls) -> "RuntimeSettings":
        origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001")

        return cls(
            env=os.getenv("LOG_WHISPERER_ENV", "development"),
            debug=_as_bool(os.getenv("LOG_WHISPERER_DEBUG"), default=False),
            app_name=os.getenv("LOG_WHISPERER_APP_NAME", "Log-Whisperer ML API"),
            app_version=os.getenv("LOG_WHISPERER_APP_VERSION", "1.6.0"),
            api_prefix=os.getenv("LOG_WHISPERER_API_PREFIX", "/api/v1"),
            window_size_sec=max(5, _as_int(os.getenv("WINDOW_SIZE_SEC"), 60)),
            alert_threshold=max(0, min(100, _as_int(os.getenv("ALERT_THRESHOLD"), 61))),
            critical_threshold=max(0, min(100, _as_int(os.getenv("CRITICAL_THRESHOLD"), 81))),
            warmup_event_threshold=max(1, _as_int(os.getenv("WARMUP_EVENT_THRESHOLD"), 100)),
            cors_allowed_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
            require_api_key=_as_bool(os.getenv("REQUIRE_API_KEY"), default=False),
            api_key=os.getenv("LOG_WHISPERER_API_KEY"),
        )
