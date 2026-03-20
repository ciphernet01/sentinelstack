from __future__ import annotations

import argparse
import json
import time
from urllib import error, parse, request


def http_get(url: str) -> dict:
    req = request.Request(url, method="GET")
    with request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


def http_post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    with request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


def run_demo(base_url: str, lines_per_second: int, duration_seconds: int) -> int:
    print("=== Log-Whisperer Demo ===")
    print(f"Base URL: {base_url}")

    try:
        health = http_get(f"{base_url}/health")
    except Exception as exc:
        print(f"[FAIL] Backend not reachable: {exc}")
        return 1

    print(f"[OK] Health: {health}")

    print("\n1) Simulating log stream...")
    stream_result = http_post_json(
        f"{base_url}/stream_logs",
        {
            "lines_per_second": lines_per_second,
            "duration_seconds": duration_seconds,
            "service": "simulator",
        },
    )
    print(f"[OK] Stream started: {stream_result}")

    time.sleep(2)

    print("\n2) Fetching anomaly feed...")
    anomalies = http_get(f"{base_url}/anomalies?limit=10")
    total_anomalies = anomalies.get("total", 0)
    print(f"[OK] Anomalies detected: {total_anomalies}")
    if total_anomalies:
        top = anomalies.get("items", [])[0]
        print(
            "     Top anomaly -> "
            f"service={top.get('service')} score={top.get('score', top.get('anomaly_score'))} msg={top.get('message')}"
        )

    print("\n3) Fetching crash report...")
    report = http_get(f"{base_url}/crash_report")

    print("\n=== Crash Report Summary ===")
    print(f"First anomaly timestamp: {report.get('first_anomaly_timestamp')}")
    print(f"Root cause: {report.get('root_cause')}")
    print(f"Confidence score: {report.get('confidence_score')}")
    print(f"Confidence explanation: {report.get('confidence_score_explanation') or report.get('confidence_explanation')}")

    crash_prediction = report.get("crash_prediction", {})
    if crash_prediction:
        print(
            "Crash probability (next 5 min): "
            f"{crash_prediction.get('probability_score', crash_prediction.get('probability'))}"
        )

    causal_chain = report.get("causal_chain") or []
    if causal_chain:
        print(f"Causal chain: {causal_chain[0]}")

    timeline = report.get("readable", {}).get("timeline") or report.get("timeline") or []
    print(f"Timeline entries: {len(timeline)}")

    highlight = report.get("first_anomaly_highlight")
    if highlight:
        print(
            "First anomaly highlight -> "
            f"[{highlight.get('timestamp')}] {highlight.get('service')} {highlight.get('level')}"
        )

    if not report.get("root_cause"):
        print("[WARN] Crash report is empty. Try increasing duration or rerunning demo.")
        return 2

    print("\n[PASS] Demo flow complete.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Log-Whisperer crash demo flow")
    parser.add_argument("--base-url", default="http://127.0.0.1:8091", help="Prototype API base URL")
    parser.add_argument("--lps", type=int, default=10000, help="Lines per second for stream simulation")
    parser.add_argument("--duration", type=int, default=2, help="Simulation duration in seconds")
    args = parser.parse_args()

    try:
        return run_demo(args.base_url.rstrip("/"), args.lps, args.duration)
    except error.HTTPError as exc:
        print(f"[FAIL] HTTP error: {exc.code} {exc.reason}")
        try:
            detail = exc.read().decode("utf-8")
            print(detail)
        except Exception:
            pass
        return 1
    except Exception as exc:
        print(f"[FAIL] Unexpected error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
