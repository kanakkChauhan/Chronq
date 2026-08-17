import asyncio
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

class JobQueue:
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock: asyncio.Lock = asyncio.Lock()
        self._metrics = {
            "queued": 0,
            "running": 0,
            "completed": 0,
            "failed": 0,
            "failure_rate": 0.0,
        }

    def _recalculate_failure_rate(self):
        total_finished = self._metrics["completed"] + self._metrics["failed"]
        if total_finished > 0:
            self._metrics["failure_rate"] = round((self._metrics["failed"] / total_finished) * 100, 1)
        else:
            self._metrics["failure_rate"] = 0.0

    async def enqueue(self, job_data: Dict[str, Any]):
        async with self._lock:
            job_id = job_data["id"]
            job_data.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            job_data.setdefault("status", "queued")
            job_data.setdefault("worker_id", None)
            job_data.setdefault("started_at", None)
            job_data.setdefault("completed_at", None)
            job_data.setdefault("failed_at", None)
            job_data.setdefault("retries", 0)
            job_data.setdefault("max_retries", 3)
            job_data.setdefault("error", None)

            self._jobs[job_id] = job_data
            self._queue.put_nowait(job_data)
            self._metrics["queued"] = self._queue.qsize()

    async def enqueue_batch(self, jobs_list: List[Dict[str, Any]]) -> List[str]:
        job_ids = []
        async with self._lock:
            now_iso = datetime.now(timezone.utc).isoformat()
            for job_data in jobs_list:
                job_id = job_data["id"]
                job_data.setdefault("created_at", now_iso)
                job_data.setdefault("status", "queued")
                job_data.setdefault("worker_id", None)
                job_data.setdefault("started_at", None)
                job_data.setdefault("completed_at", None)
                job_data.setdefault("failed_at", None)
                job_data.setdefault("retries", 0)
                job_data.setdefault("max_retries", 3)
                job_data.setdefault("error", None)

                self._jobs[job_id] = job_data
                self._queue.put_nowait(job_data)
                job_ids.append(job_id)

            self._metrics["queued"] = self._queue.qsize()
        return job_ids

    async def dequeue(self) -> Optional[Dict[str, Any]]:
        job_data = await self._queue.get()
        async with self._lock:
            self._metrics["queued"] = self._queue.qsize()
        return job_data

    async def mark_running(self, job_id: str, worker_id: str):
        async with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id]["status"] = "running"
                self._jobs[job_id]["worker_id"] = worker_id
                self._jobs[job_id]["started_at"] = datetime.now(timezone.utc).isoformat()
                self._metrics["running"] = sum(1 for j in self._jobs.values() if j.get("status") == "running")
                self._metrics["queued"] = self._queue.qsize()

    async def mark_completed(self, job_id: str, result: Optional[Dict[str, Any]] = None):
        async with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id]["status"] = "completed"
                self._jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
                if result is not None:
                    self._jobs[job_id]["result"] = result
                self._metrics["completed"] += 1
                self._metrics["running"] = sum(1 for j in self._jobs.values() if j.get("status") == "running")
                self._recalculate_failure_rate()

    async def mark_failed(self, job_id: str, error: str):
        async with self._lock:
            if job_id not in self._jobs:
                return

            job = self._jobs[job_id]
            job["retries"] = job.get("retries", 0) + 1
            job["error"] = error
            job["failed_at"] = datetime.now(timezone.utc).isoformat()

            if job["retries"] <= job.get("max_retries", 3):
                job["status"] = "queued"
                job["worker_id"] = None
                self._queue.put_nowait(job)
                self._metrics["queued"] = self._queue.qsize()
            else:
                job["status"] = "failed"
                self._metrics["failed"] += 1
                self._recalculate_failure_rate()

            self._metrics["running"] = sum(1 for j in self._jobs.values() if j.get("status") == "running")

    async def clear_queued(self) -> int:
        async with self._lock:
            cleared_count = 0

            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                    self._queue.task_done()
                except (asyncio.QueueEmpty, ValueError):
                    break

            for job_id, job in list(self._jobs.items()):
                if job.get("status") == "queued":
                    job["status"] = "cancelled"
                    job["error"] = "Queue cleared by operator"
                    job["completed_at"] = datetime.now(timezone.utc).isoformat()
                    cleared_count += 1

            self._metrics["queued"] = 0
            self._metrics["running"] = sum(1 for j in self._jobs.values() if j.get("status") == "running")
            return cleared_count

    async def get_all_jobs(self) -> Dict[str, Dict[str, Any]]:
        async with self._lock:
            return dict(self._jobs)

    def get_metrics(self) -> Dict[str, Any]:
        return {
            "queued": self._metrics["queued"],
            "running": self._metrics["running"],
            "completed": self._metrics["completed"],
            "failed": self._metrics["failed"],
            "failure_rate": self._metrics["failure_rate"],
        }

job_queue = JobQueue()
RedisJobQueue = JobQueue