import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Worker:
    def __init__(self, worker_id: int, queue):
        self.worker_id = worker_id
        self.queue = queue
        self.status = "IDLE"
        self.current_job = None
        self.simulate_failures = False

    async def run(self):
        logger.info(f"Worker {self.worker_id} started.")
        while True:
            try:
                job = await self.queue.dequeue()
                if job:
                    self.status = "BUSY"
                    self.current_job = job["id"]
                    logger.info(f"Worker {self.worker_id} processing job {job['id']} ({job['type']})")

                    # Simulate work
                    await asyncio.sleep(2)

                    # Check failure simulation or retries
                    if self.simulate_failures and job.get("retries", 0) < job.get("max_retries", 3):
                        logger.warning(f"Worker {self.worker_id} failing job {job['id']} for retry simulation.")
                        await self.queue.retry_job(job["id"], error="Simulated Worker Failure")
                    else:
                        await self.queue.complete_job(job["id"])
                        logger.info(f"Worker {self.worker_id} completed job {job['id']}")

                    self.status = "IDLE"
                    self.current_job = None
                else:
                    await asyncio.sleep(1)
            except asyncio.CancelledError:
                logger.info(f"Worker {self.worker_id} shutting down.")
                break
            except Exception as e:
                logger.error(f"Worker {self.worker_id} encountered an error: {e}")
                self.status = "IDLE"
                self.current_job = None
                await asyncio.sleep(1)