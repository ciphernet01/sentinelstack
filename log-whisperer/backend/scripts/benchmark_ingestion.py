import argparse
import os
import sys
import time
from datetime import datetime, timedelta, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.ingest.service import IngestionService


def _apache_line(ts: datetime, idx: int) -> str:
    status = 500 if idx % 17 == 0 else 200
    return (
        f'10.0.0.{(idx % 250) + 1} - - [{ts.strftime("%d/%b/%Y:%H:%M:%S")}] '
        f'"GET /api/item/{idx % 120} HTTP/1.1" {status} {300 + (idx % 900)} "-" "benchmark/1.0"'
    )


def generate_lines(total: int) -> str:
    start = datetime.now(timezone.utc) - timedelta(seconds=total)
    lines = []
    for index in range(total):
        lines.append(_apache_line(start + timedelta(seconds=index % 60), index))
    return "\n".join(lines)


def run(total_lines: int, rounds: int) -> None:
    lines_blob = generate_lines(total_lines)
    service = IngestionService(window_size_sec=30)

    total_ingested = 0
    total_elapsed = 0.0

    for _ in range(rounds):
        started = time.perf_counter()
        result = service.ingest_file(lines_blob, format_hint="apache", service_name="benchmark-service")
        elapsed = time.perf_counter() - started
        total_elapsed += elapsed
        total_ingested += result.get("parsed", 0)

    avg_lines_per_sec = total_ingested / total_elapsed if total_elapsed > 0 else 0.0
    per_round = total_lines / (total_elapsed / rounds) if rounds > 0 and total_elapsed > 0 else 0.0

    print("--- Log-Whisperer Ingestion Benchmark ---")
    print(f"total_lines_per_round: {total_lines}")
    print(f"rounds: {rounds}")
    print(f"total_parsed: {total_ingested}")
    print(f"total_elapsed_sec: {total_elapsed:.4f}")
    print(f"avg_lines_per_sec: {avg_lines_per_sec:.2f}")
    print(f"per_round_lines_per_sec: {per_round:.2f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark log ingestion throughput")
    parser.add_argument("--lines", type=int, default=50000)
    parser.add_argument("--rounds", type=int, default=3)
    args = parser.parse_args()

    run(total_lines=max(1000, args.lines), rounds=max(1, args.rounds))
