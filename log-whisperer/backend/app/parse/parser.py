from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from dateutil import parser as dt_parser

from app.core.schemas import LogLevel, NormalizedLogEvent

APACHE_NGINX_RE = re.compile(
	r'^(?P<host>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<method>[A-Z]+) (?P<path>\S+) (?P<proto>[^"]+)" (?P<status>\d{3}) (?P<size>\S+)(?: "(?P<ref>[^"]*)" "(?P<agent>[^"]*)")?$'
)
SYSLOG_RE = re.compile(
	r"^(?P<month>[A-Z][a-z]{2})\s+(?P<day>\d{1,2})\s(?P<time>\d{2}:\d{2}:\d{2})\s(?P<host>\S+)\s(?P<service>[\w\-./]+)(?:\[(?P<pid>\d+)\])?:\s(?P<message>.*)$"
)
SPRING_BOOT_RE = re.compile(
	r"^(?P<time>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{3})?)\s+(?P<level>TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\d+\s+---\s+\[(?P<thread>[^\]]+)\]\s+(?P<logger>[^\s]+)\s*:\s*(?P<message>.*)$"
)
GENERIC_TS_RE = re.compile(
	r"^(?P<time>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)\s+(?P<level>TRACE|DEBUG|INFO|WARN|ERROR|FATAL)?\s*(?P<message>.*)$"
)


def _normalize_level(value: str | None, default: LogLevel = "INFO") -> LogLevel:
	if not value:
		return default
	level = value.upper()
	if level in {"TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"}:
		return level  # type: ignore[return-value]
	return default


def _parse_timestamp(value: str | None, default_now: bool = True) -> datetime:
	if not value:
		return datetime.now(timezone.utc)
	try:
		parsed = dt_parser.parse(value)
		if parsed.tzinfo is None:
			return parsed.replace(tzinfo=timezone.utc)
		return parsed.astimezone(timezone.utc)
	except (ValueError, TypeError):
		if default_now:
			return datetime.now(timezone.utc)
		raise


def _event_from_json(raw_line: str, payload: dict) -> NormalizedLogEvent:
	timestamp = _parse_timestamp(
		payload.get("timestamp")
		or payload.get("time")
		or payload.get("@timestamp")
		or payload.get("ts")
	)
	service = payload.get("service") or payload.get("app") or payload.get("serviceName") or "unknown-service"
	level = _normalize_level(payload.get("level") or payload.get("severity") or payload.get("logLevel"))
	message = str(payload.get("message") or payload.get("msg") or payload.get("event") or raw_line)
	template = str(payload.get("template") or "json_event")
	return NormalizedLogEvent(
		timestamp=timestamp,
		service=str(service),
		level=level,
		message=message,
		template=template,
		trace_id=payload.get("trace_id") or payload.get("traceId") or payload.get("request_id"),
		host=payload.get("host") or payload.get("hostname"),
		raw=raw_line,
		source_format="json",
	)


def parse_log_line(line: str, source_hint: str = "unknown") -> NormalizedLogEvent:
	raw_line = line.strip()
	if not raw_line:
		raise ValueError("Empty log line")

	if raw_line.startswith("{") and raw_line.endswith("}"):
		try:
			payload = json.loads(raw_line)
			if isinstance(payload, dict):
				return _event_from_json(raw_line, payload)
		except json.JSONDecodeError:
			pass

	apache_match = APACHE_NGINX_RE.match(raw_line)
	if apache_match:
		status_code = int(apache_match.group("status"))
		level: LogLevel = "ERROR" if status_code >= 500 else "WARN" if status_code >= 400 else "INFO"
		service_name = "nginx" if "nginx" in source_hint.lower() else "apache"
		return NormalizedLogEvent(
			timestamp=_parse_timestamp(apache_match.group("time")),
			service=service_name,
			level=level,
			message=f'{apache_match.group("method")} {apache_match.group("path")} -> {status_code}',
			template="http_access",
			host=apache_match.group("host"),
			raw=raw_line,
			source_format="apache_nginx",
		)

	syslog_match = SYSLOG_RE.match(raw_line)
	if syslog_match:
		current_year = datetime.now(timezone.utc).year
		timestamp = _parse_timestamp(
			f'{current_year} {syslog_match.group("month")} {syslog_match.group("day")} {syslog_match.group("time")}'
		)
		message = syslog_match.group("message")
		level = "ERROR" if re.search(r"\b(error|failed|fatal|panic)\b", message, re.IGNORECASE) else "INFO"
		return NormalizedLogEvent(
			timestamp=timestamp,
			service=syslog_match.group("service"),
			level=_normalize_level(level),
			message=message,
			template="syslog_event",
			host=syslog_match.group("host"),
			raw=raw_line,
			source_format="syslog",
		)

	spring_match = SPRING_BOOT_RE.match(raw_line)
	if spring_match:
		logger = spring_match.group("logger")
		return NormalizedLogEvent(
			timestamp=_parse_timestamp(spring_match.group("time")),
			service=logger.split(".")[0] if "." in logger else "spring-service",
			level=_normalize_level(spring_match.group("level")),
			message=spring_match.group("message"),
			template="spring_log",
			raw=raw_line,
			source_format="spring_boot",
		)

	generic_match = GENERIC_TS_RE.match(raw_line)
	if generic_match:
		return NormalizedLogEvent(
			timestamp=_parse_timestamp(generic_match.group("time")),
			service="generic-service",
			level=_normalize_level(generic_match.group("level")),
			message=generic_match.group("message"),
			template="generic_ts_log",
			raw=raw_line,
			source_format="plain",
		)

	level = "ERROR" if re.search(r"\b(error|exception|fatal|panic|timeout)\b", raw_line, re.IGNORECASE) else "INFO"
	return NormalizedLogEvent(
		timestamp=datetime.now(timezone.utc),
		service="unknown-service",
		level=_normalize_level(level),
		message=raw_line,
		template="plain_text",
		raw=raw_line,
		source_format="plain",
	)


def parse_many_lines(lines: list[str], source_hint: str = "unknown") -> tuple[list[NormalizedLogEvent], list[str]]:
	parsed_events: list[NormalizedLogEvent] = []
	failed_lines: list[str] = []
	for line in lines:
		if not line.strip():
			continue
		try:
			parsed_events.append(parse_log_line(line, source_hint=source_hint))
		except Exception:
			failed_lines.append(line[:300])
	return parsed_events, failed_lines
