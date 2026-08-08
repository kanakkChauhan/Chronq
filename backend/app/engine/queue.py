import asyncio
import heapq
from typing import Dict, Optional
from app.models.job import Job

class AsyncPriorityQueue:
    def __init__(self):
        self._heap = []
        self._lookup: Dict[str, Job] = {}
        self._counter = 0  # Tie-breaker for FIFO ordering
        self._lock = asyncio.Lock()

    async def enqueue(self, job: Job):
        async with self._lock:
            self._counter += 1
            # Push a tuple: (negative priority for max-heap behavior, counter, job)
            # Fix: Use job.priority directly as an integer, no .value needed
            priority_score = -job.priority 
            heapq.heappush(self._heap, (priority_score, self._counter, job))
            self._lookup[job.id] = job

    async def dequeue(self) -> Job:
        while True:
            async with self._lock:
                if self._heap:
                    _, _, job = heapq.heappop(self._heap)
                    # Note: We keep it in self._lookup so status checks still work while RUNNING
                    return job
            # If queue is empty, wait a tiny bit and check again without blocking CPU
            await asyncio.sleep(0.1)

    def get_job_status(self, job_id: str) -> Optional[Job]:
        return self._lookup.get(job_id)

job_queue = AsyncPriorityQueue()