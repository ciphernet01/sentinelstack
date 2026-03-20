from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, Awaitable, Callable
from dataclasses import dataclass
from uuid import uuid4


@dataclass
class IngestionStats:
    queued_lines: int = 0
    processed_lines: int = 0


class AsyncLogIngestion:
    """High-throughput async ingestion with queue-backed batch consumers."""

    def __init__(self, queue_maxsize: int = 200_000, batch_size: int = 500):
        self.queue: asyncio.Queue[str] = asyncio.Queue(maxsize=queue_maxsize)
        self.batch_size = batch_size
        self._workers: list[asyncio.Task] = []
        self.stats = IngestionStats()

    async def start_workers(
        self,
        worker_count: int,
        process_batch: Callable[[list[str]], Awaitable[None]],
    ) -> None:
        if self._workers:
            return
        for _ in range(worker_count):
            task = asyncio.create_task(self._worker_loop(process_batch))
            self._workers.append(task)

    async def stop_workers(self) -> None:
        for task in self._workers:
            task.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    async def push_lines(self, lines: list[str]) -> int:
        accepted = 0
        for line in lines:
            if not line:
                continue
            await self.queue.put(line)
            accepted += 1
        self.stats.queued_lines += accepted
        return accepted

    async def simulate_stream(
        self,
        template_lines: list[str],
        lines_per_second: int,
        duration_seconds: int,
    ) -> str:
        """Stream lines into the queue while preserving async responsiveness."""
        stream_id = str(uuid4())
        if not template_lines:
            return stream_id

        total_target = lines_per_second * duration_seconds
        chunk_size = max(1, lines_per_second // 10)

        for start in range(0, total_target, chunk_size):
            chunk: list[str] = []
            for i in range(chunk_size):
                idx = (start + i) % len(template_lines)
                chunk.append(template_lines[idx])
            await self.push_lines(chunk)
            await asyncio.sleep(0.1)

        return stream_id

    async def _worker_loop(
        self,
        process_batch: Callable[[list[str]], Awaitable[None]],
    ) -> None:
        while True:
            first = await self.queue.get()
            batch = [first]

            for _ in range(self.batch_size - 1):
                try:
                    batch.append(self.queue.get_nowait())
                except asyncio.QueueEmpty:
                    break

            await process_batch(batch)
            self.stats.processed_lines += len(batch)

            for _ in batch:
                self.queue.task_done()


async def simulate_lines(lines: list[str], lines_per_second: int) -> AsyncGenerator[str, None]:
    """Reusable async generator for external streaming integrations."""
    if not lines:
        return

    delay = 1.0 / max(1, lines_per_second)
    for line in lines:
        yield line
        if delay > 0:
            await asyncio.sleep(delay)
