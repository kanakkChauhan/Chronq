from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models.job import Job
from app.engine.queue import job_queue
from app.engine.worker import worker_loop
from app.api.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track active background worker tasks
worker_tasks = []

class ScaleRequest(BaseModel):
    workers: int

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch initial 3 workers
    logger.info("Starting up TaskFlow engine workers...")
    for i in range(3):
        task = asyncio.create_task(worker_loop(i))
        worker_tasks.append(task)
    yield
    # Shutdown: Cancel all workers gracefully
    logger.info("Shutting down TaskFlow engine workers...")
    for task in worker_tasks:
        task.cancel()
    await asyncio.gather(*worker_tasks, return_exceptions=True)

app = FastAPI(title="TaskFlow Engine", lifespan=lifespan)

# Configure CORS for Vite Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/jobs")
async def create_job(job: Job):
    """Enqueues a new job into the priority min-heap queue."""
    await job_queue.enqueue(job)
    logger.info(f"Received and enqueued job {job.id} of type {job.type} with priority {job.priority}")
    return {"status": "queued", "job_id": job.id}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Retrieves the current state of a specific job."""
    job = job_queue.get_job_status(job_id)
    if not job:
        return {"error": "Job not found"}, 404
    return job

@app.get("/api/workers")
async def get_worker_count():
    """Returns the current number of active worker threads."""
    active_count = sum(1 for task in worker_tasks if not task.done())
    return {"active_workers": active_count}

@app.post("/api/workers/scale")
async def scale_workers(req: ScaleRequest):
    """Dynamically scales the worker pool up or down."""
    global worker_tasks
    target = req.workers
    
    if target < 0 or target > 20:
        return {"error": "Worker count must be between 0 and 20"}, 400

    current_active = [t for t in worker_tasks if not t.done()]
    current_count = len(current_active)

    if target > current_count:
        # Scale UP: launch new worker loops
        for i in range(current_count, target):
            task = asyncio.create_task(worker_loop(i))
            worker_tasks.append(task)
        logger.info(f"Scaled worker pool UP from {current_count} to {target}")
        
    elif target < current_count:
        # Scale DOWN: cancel excess workers
        to_cancel = current_active[target:]
        for task in to_cancel:
            task.cancel()
        await asyncio.gather(*to_cancel, return_exceptions=True)
        logger.info(f"Scaled worker pool DOWN from {current_count} to {target}")

    return {"status": "success", "active_workers": target}

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time frontend event broadcasting."""
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)