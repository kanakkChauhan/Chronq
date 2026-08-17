import asyncio
import random
import logging
from typing import Optional
from app.engine.queue import JobQueue

logger = logging.getLogger("chronq.worker")

class Worker:
    def __init__(self, worker_id: int, queue: JobQueue):
        self.worker_id = worker_id
        self.queue = queue
        self.status = "IDLE"
        self.current_job: Optional[str] = None
        self.simulate_failures: bool = False
        self._running = True

    async def run(self):
        while self._running:
            try:
                self.status = "IDLE"
                self.current_job = None

                # Wait for next job with a short timeout to check self._running flag
                try:
                    job_data = await asyncio.wait_for(self.queue.dequeue(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue

                if not job_data:
                    continue

                # If stopped while waiting, re-enqueue and exit
                if not self._running:
                    await self.queue.enqueue(job_data)
                    break

                job_id = job_data["id"]
                self.current_job = job_id
                self.status = "RUNNING"

                # Synchronize queue registry state
                await self.queue.mark_running(job_id, f"worker-{self.worker_id}")
                await self.process_job(job_data)

            except asyncio.CancelledError:
                self._running = False
                break
            except Exception as e:
                logger.exception(f"Worker {self.worker_id} encountered an error: {e}")
                await asyncio.sleep(0.5)
        
        self.status = "OFFLINE"
        self.current_job = None

    async def process_job(self, job_data: dict):
        job_id = job_data["id"]
        process_time = random.uniform(1.5, 3.0)
        await asyncio.sleep(process_time)

        if self.simulate_failures and random.random() < 0.6:
            await self.queue.mark_failed(job_id, error="Simulated worker execution failure")
        else:
            await self.queue.mark_completed(job_id, result={"output": f"Processed by worker-{self.worker_id}"})

    def stop(self):
        """Signals the worker loop to stop gracefully after any in-flight task."""
        self._running = False