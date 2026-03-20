from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _healthy_line(timestamp: datetime, service: str, index: int) -> str:
    return (
        f"{timestamp.isoformat()} INFO request completed service={service} "
        f"route=/v1/resource latency_ms={45 + (index % 30)}"
    )


def _error_burst_line(timestamp: datetime, service: str, index: int, lines: int) -> str:
    if index > int(lines * 0.65):
        code = 500 + (index % 4)
        return f"{timestamp.isoformat()} ERROR upstream timeout service={service} status={code}"
    return f"{timestamp.isoformat()} INFO heartbeat ok service={service}"


def _crash_like_line(timestamp: datetime, service: str, index: int, lines: int) -> str:
    if index < int(lines * 0.5):
        return f"{timestamp.isoformat()} INFO heartbeat ok service={service}"
    if index < int(lines * 0.8):
        return f"{timestamp.isoformat()} WARN retrying db call service={service} attempt={index % 5 + 1}"
    if index % 3 == 0:
        return f"{timestamp.isoformat()} ERROR db timeout exception service={service}"
    return f"{timestamp.isoformat()} FATAL panic connection pool exhausted service={service}"


def generate_stream_lines(profile: str, lines: int, service: str = "api-gateway") -> list[str]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    start = now - timedelta(seconds=lines)

    generated: list[str] = []
    for index in range(lines):
        timestamp = start + timedelta(seconds=index)
        if profile == "error_burst":
            generated.append(_error_burst_line(timestamp, service, index, lines))
        elif profile == "crash_like":
            generated.append(_crash_like_line(timestamp, service, index, lines))
        else:
            generated.append(_healthy_line(timestamp, service, index))
    return generated
