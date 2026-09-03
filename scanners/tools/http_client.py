from __future__ import annotations

from typing import Any, Dict
from urllib.request import Request


DEFAULT_HEADERS: Dict[str, str] = {
    "User-Agent": "SentinelStackScanner/1.0",
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
}


def headers_from_context(ctx: Any, extra: Dict[str, str] | None = None) -> Dict[str, str]:
    headers = dict(DEFAULT_HEADERS)
    metadata = getattr(ctx, "metadata", {}) or {}

    custom_headers = metadata.get("headers")
    if isinstance(custom_headers, dict):
        for key, value in custom_headers.items():
            if not key or value is None:
                continue
            headers[str(key)] = str(value)

    cookies = metadata.get("cookies")
    if isinstance(cookies, str) and cookies.strip() and "Cookie" not in headers:
        headers["Cookie"] = cookies.strip()

    if extra:
        headers.update(extra)

    return headers


def make_request(ctx: Any, url: str, method: str = "GET", extra_headers: Dict[str, str] | None = None) -> Request:
    return Request(url, headers=headers_from_context(ctx, extra_headers), method=method)
