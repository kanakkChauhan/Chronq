import asyncio
import logging
import random
from app.engine.queue import job_queue
from app.models.job import Job, JobStatus
from app.api.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def execute_task(job: Job):
    """Executes task logic and simulates random failures for testing retries."""
    if job.type == "api_request":
        logger.info(f"[{job.id}] Executing API Request...")
        await asyncio.sleep(1)
        
        # Simulate a 50% random network failure rate for demonstration
        if random.random() < 0.5:
            raise ConnectionError("External API rate-limit exceeded / Timeout")
            
        job.payload["response_code"] = 200
        
    elif job.type == "report_generation":
        logger.info(f"[{job.id}] Generating Heavy Report...")
        await asyncio.sleep(2)
        job.payload["report_url"] = f"/reports/export_{job.id[:8]}.pdf"
        
    elif job.type.startswith("stress_test"):
        await asyncio.sleep(1) 
        
    else:
        logger.info(f"[{job.id}] Processing Standard Data...")
        await asyncio.sleep(1.5)

async def worker_loop(worker_id: int):
    logger.info(f"Worker {worker_id} initialized")
    while True:
        try:
            job = await job_queue.dequeue()
            
            # 1. Update state to RUNNING
            job.status = JobStatus.RUNNING
            await ws_manager.broadcast_job_update(job)
            
            # 2. Try executing the task workload
            await execute_task(job)
            
            # 3. If successful, mark COMPLETED
            job.status = JobStatus.COMPLETED
            await ws_manager.broadcast_job_update(job)
            logger.info(f"Worker {worker_id} completed job {job.id}")
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            # Handle failures and check retry limit
            job.retries += 1
            logger.warning(f"Worker {worker_id} encountered error on job {job.id} (Attempt {job.retries}/{job.max_retries}): {str(e)}")
            
            if job.retries <= job.max_retries:
                # Exponential backoff simulation (e.g., wait 2^retries seconds or short delay for UI)
                job.status = JobStatus.QUEUED
                job.error = f"Retrying: {str(e)}"
                await ws_manager.broadcast_job_update(job)
                
                # Push back into the priority queue for another attempt
                await job_queue.enqueue(job)
                logger.info(f"Re-queued job {job.id} for retry attempt {job.retries}")
            else:
                # Max retries exceeded, permanently fail the job
                job.status = JobStatus.FAILED
                job.error = f"Max retries reached. Last error: {str(e)}"
                await ws_manager.broadcast_job_update(job)
                logger.error(f"Job {job.id} permanently FAILED after {job.max_retries} attempts.")