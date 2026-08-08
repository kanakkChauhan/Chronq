from contextlib import asynccontextmanager
import asyncio
import logging
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models.job import Job
from app.engine.queue import job_queue
from app.engine.worker import worker_loop, worker_states, engine_config
from app.api.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

worker_tasks = []
start_time = time.time()

class ScaleRequest(BaseModel):
    workers: int

class ToggleRequest(BaseModel):
    enabled: bool

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up TaskFlow engine workers...")
    for i in range(3):
        task = asyncio.create_task(worker_loop(i))
        worker_tasks.append(task)
    yield
    logger.info("Shutting down TaskFlow engine workers...")
    for task in worker_tasks:
        task.cancel()
    await asyncio.gather(*worker_tasks, return_exceptions=True)

app = FastAPI(title="TaskFlow Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/jobs")
async def create_job(job: Job):
    await job_queue.enqueue(job)
    return {"status": "queued", "job_id": job.id}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = await job_queue.get_job_status(job_id) # Added AWAIT
    if not job:
        return {"error": "Job not found"}, 404
    return job

@app.get("/api/observability")
async def get_observability():
    queue_metrics = await job_queue.get_metrics() # Added AWAIT
    active_count = sum(1 for task in worker_tasks if not task.done())
    uptime = max(1.0, time.time() - start_time)
    throughput = round(queue_metrics["completed"] / uptime, 1)

    return {
        "active_workers": active_count,
        "throughput": throughput,
        "simulate_failures": engine_config["simulate_failures"],
        **queue_metrics,
        "workers": worker_states
    }

@app.post("/api/workers/scale")
async def scale_workers(req: ScaleRequest):
    global worker_tasks
    target = req.workers
    if target < 0 or target > 20:
        return {"error": "Worker count must be between 0 and 20"}, 400

    current_active = [t for t in worker_tasks if not t.done()]
    current_count = len(current_active)

    if target > current_count:
        for i in range(current_count, target):
            task = asyncio.create_task(worker_loop(i))
            worker_tasks.append(task)
    elif target < current_count:
        to_cancel = current_active[target:]
        for task in to_cancel:
            task.cancel()
        await asyncio.gather(*to_cancel, return_exceptions=True)

    return {"status": "success", "active_workers": target}

@app.post("/api/simulation/toggle")
async def toggle_simulation(req: ToggleRequest):
    engine_config["simulate_failures"] = req.enabled
    return {"status": "success", "simulate_failures": engine_config["simulate_failures"]}

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)