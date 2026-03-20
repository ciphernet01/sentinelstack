from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Iterable

from .models import ParsedLog


class LogParser:
    """Parse heterogeneous log formats into a unified ParsedLog schema."""

    _regex_patterns = [
        re.compile(
            r"^(?P<timestamp>\S+)\s+(?P<service>[\w\-\.]+)\s+(?P<level>DEBUG|INFO|WARN|ERROR|FATAL)\s+(?P<message>.*?)(?:\s+trace_id=(?P<trace_id>[\w\-]+))?$",
            re.IGNORECASE,
        ),
        re.compile(
            r"^\[(?P<timestamp>[^\]]+)\]\s+\[(?P<service>[^\]]+)\]\s+\[(?P<level>[^\]]+)\]\s+(?P<message>.*)$",
            re.IGNORECASE,
        ),
        re.compile(
            r"^(?P<timestamp>\S+)\s+\[(?P<level>DEBUG|INFO|WARN|ERROR|FATAL)\]\s+(?P<service>[\w\-\.]+):\s+(?P<message>.*)$",
            re.IGNORECASE,
        ),
    ]

    def parse_line(self, line: str, default_service: str = "unknown-service") -> ParsedLog | None:
        line = line.strip()
        if not line:
            return None

        as_json = self._parse_json(line, default_service)
        if as_json:
            return as_json

        for pattern in self._regex_patterns:
            match = pattern.match(line)
            if not match:
                continue

            data = match.groupdict()
            return ParsedLog(
                timestamp=self._normalize_timestamp(data.get("timestamp")),
                service=(data.get("service") or default_service).strip(),
                level=self._normalize_level(data.get("level")),
                message=(data.get("message") or "").strip(),
                trace_id=(data.get("trace_id") or None),
                raw=line,
            )

        return ParsedLog(
            timestamp=datetime.now(UTC),
            service=default_service,
            level="INFO",
            message=line,
            raw=line,
        )

    def parse_batch(self, lines: Iterable[str], default_service: str = "unknown-service") -> list[ParsedLog]:
        parsed: list[ParsedLog] = []
        for line in lines:
            item = self.parse_line(line, default_service=default_service)
            if item is not None:
                parsed.append(item)
        return parsed

    def _parse_json(self, line: str, default_service: str) -> ParsedLog | None:
        if not (line.startswith("{") and line.endswith("}")):
            return None
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return None

        message = payload.get("message") or payload.get("msg")
        if not message:
            return None

        return ParsedLog(
            timestamp=self._normalize_timestamp(payload.get("timestamp") or payload.get("time")),
            service=str(payload.get("service") or default_service),
            level=self._normalize_level(payload.get("level") or payload.get("severity")),
            message=str(message),
            trace_id=payload.get("trace_id") or payload.get("traceId"),
            raw=line,
        )

    @staticmethod
    def _normalize_level(level: str | None) -> str:
        if not level:
            return "INFO"
        normalized = level.upper()
        if normalized == "WARNING":
            return "WARN"
        if normalized not in {"DEBUG", "INFO", "WARN", "ERROR", "FATAL"}:
            return "INFO"
        return normalized

    @staticmethod
    def _normalize_timestamp(value: str | None) -> datetime:
        if not value:
            return datetime.now(UTC)

        text = str(value).strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=UTC)
            return parsed.astimezone(UTC)
        except ValueError:
            pass

        for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%b/%Y:%H:%M:%S %z", "%Y-%m-%dT%H:%M:%S"):
            try:
                parsed = datetime.strptime(text, fmt)
                if parsed.tzinfo is None:
                    return parsed.replace(tzinfo=UTC)
                return parsed.astimezone(UTC)
            except ValueError:
                continue

        return datetime.now(UTC)
