import asyncio
from typing import Dict, Optional
from app.models.job import Job, JobStatus

class TaskQueue:
    def __init__(self):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        # Store jobs for O(1) lookup by ID
        self._jobs: Dict[str, Job] = {}

    async def enqueue(self, job: Job) -> None:
        job.status = JobStatus.QUEUED
        self._jobs[job.id] = job
        
        priority_score = -job.priority.value
        await self._queue.put((priority_score, job))

    async def dequeue(self) -> Job:
        _, job = await self._queue.get()
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def get_queue_size(self) -> int:
        return self._queue.qsize()

job_queue = TaskQueue()