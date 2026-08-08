from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.engine.worker import worker_loop
from app.engine.queue import job_queue
from app.models.job import Job, JobPriority

class JobRequest(BaseModel):
    type: str
    payload: dict = {}
    priority: JobPriority = JobPriority.MEDIUM

_workers = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Boot up 3 concurrent workers
    for i in range(3):
        task = asyncio.create_task(worker_loop(i))
        _workers.append(task)
    
    yield
    
    # Graceful shutdown
    for task in _workers:
        task.cancel()
    await asyncio.gather(*_workers, return_exceptions=True)

app = FastAPI(title="TaskFlow API", lifespan=lifespan)

@app.post("/api/jobs", response_model=Job)
async def create_job(req: JobRequest):
    job = Job(
        type=req.type,
        payload=req.payload,
        priority=req.priority
    )
    await job_queue.enqueue(job)
    return job

@app.get("/api/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job