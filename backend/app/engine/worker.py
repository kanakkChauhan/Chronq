import asyncio
import logging
import random
from app.engine.queue import job_queue
from app.models.job import Job, JobStatus
from app.api.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def execute_task(job: Job):
    """Routes the job to the correct execution logic based on its type."""
    if job.type == "api_request":
        logger.info(f"[{job.id}] Executing API Request...")
        await asyncio.sleep(1)  
        job.payload["response_code"] = 200
        
    elif job.type == "report_generation":
        logger.info(f"[{job.id}] Generating Heavy Report...")
        await asyncio.sleep(4)  
        job.payload["report_url"] = f"/reports/export_{job.id[:8]}.pdf"
        
    elif job.type.startswith("stress_test"):
        await asyncio.sleep(1.5) 
        
    else:
        logger.info(f"[{job.id}] Processing Standard Data...")
        await asyncio.sleep(2)  

async def worker_loop(worker_id: int):
    logger.info(f"Worker {worker_id} initialized")
    while True:
        try:
            job = await job_queue.dequeue()
            
            job.status = JobStatus.RUNNING
            await ws_manager.broadcast_job_update(job)
            
            await execute_task(job)
            
            job.status = JobStatus.COMPLETED
            await ws_manager.broadcast_job_update(job)
            
            logger.info(f"Worker {worker_id} completed job {job.id}")
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Worker {worker_id} failed on job {job.id}: {str(e)}")
            job.status = JobStatus.FAILED
            job.error = str(e)
            await ws_manager.broadcast_job_update(job)