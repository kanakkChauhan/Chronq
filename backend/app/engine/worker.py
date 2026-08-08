import asyncio
import logging
from datetime import datetime, timezone
from app.models.job import Job, JobStatus
from app.engine.queue import job_queue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_job(job: Job) -> None:
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    
    try:
        # Simulate I/O bound workload
        await asyncio.sleep(2)
        
        job.status = JobStatus.COMPLETED
        
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        logger.error(f"Job {job.id} failed: {job.error}")
    finally:
        job.finished_at = datetime.now(timezone.utc)

async def worker_loop(worker_id: int) -> None:
    logger.info(f"Worker {worker_id} initialized")
    
    while True:
        try:
            job = await job_queue.dequeue()
            await process_job(job)
            job_queue._queue.task_done()
            
        except asyncio.CancelledError:
            logger.info(f"Worker {worker_id} shutting down")
            break
        except Exception as e:
            logger.error(f"Worker {worker_id} error: {e}")
            await asyncio.sleep(1)