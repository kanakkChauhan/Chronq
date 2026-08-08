from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.models.job import Job
from app.engine.queue import job_queue
from app.engine.worker import worker_loop
from app.api.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track active background workers
worker_tasks = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch 3 concurrent background workers
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

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time frontend event broadcasting."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive listening for client messages if needed
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)