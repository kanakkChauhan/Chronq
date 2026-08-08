import asyncio
from typing import Dict, Optional
from app.models.job import Job, JobStatus

class TaskQueue:
    def __init__(self):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._jobs: Dict[str, Job] = {}
        self._counter = 0  

    async def enqueue(self, job: Job) -> None:
        job.status = JobStatus.QUEUED
        self._jobs[job.id] = job
        
        self._counter += 1
        priority_score = -job.priority.value
        
        await self._queue.put((priority_score, self._counter, job))

    async def dequeue(self) -> Job:
        _, _, job = await self._queue.get()
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def get_queue_size(self) -> int:
        return self._queue.qsize()

job_queue = TaskQueue()