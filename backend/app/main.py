import os
import time
import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.engine.queue import job_queue
from app.engine.worker import Worker

app = FastAPI(title="Chronq API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

worker_tasks = []
workers_dict = {}
start_time = time.time()
simulate_failures = False

DEFAULT_WORKERS = int(os.getenv("DEFAULT_WORKERS", 2))

@app.on_event("startup")
async def startup_event():
    global start_time
    start_time = time.time()
    for i in range(DEFAULT_WORKERS):
        worker = Worker(worker_id=i, queue=job_queue)
        workers_dict[i] = worker
        task = asyncio.create_task(worker.run())
        worker_tasks.append(task)

@app.on_event("shutdown")
async def shutdown_event():
    for task in worker_tasks:
        task.cancel()

@app.post("/api/jobs")
async def create_job(job_data: dict):
    if "id" not in job_data:
        job_data["id"] = f"job-{uuid.uuid4().hex[:8]}"
    job_data["status"] = "queued"
    job_data.setdefault("priority", 0)
    job_data.setdefault("retries", 0)
    job_data.setdefault("max_retries", 3)
    job_data.setdefault("error", None)
    job_data.setdefault("attempt_history", [])

    await job_queue.enqueue(job_data)
    return {"status": "queued", "job_id": job_data["id"], "job": job_data}

@app.get("/api/observability")
async def get_observability():
    queue_metrics = job_queue.get_metrics()
    active_count = sum(1 for task in worker_tasks if not task.done())
    uptime = max(1.0, time.time() - start_time)
    throughput = round(queue_metrics["completed"] / uptime, 1)

    worker_states = {}
    for w_id, w_instance in workers_dict.items():
        worker_states[w_id] = {
            "status": getattr(w_instance, "status", "IDLE"),
            "current_job": getattr(w_instance, "current_job", None)
        }

    return {
        "active_workers": active_count,
        "queued": queue_metrics["queued"],
        "running": queue_metrics["running"],
        "completed": queue_metrics["completed"],
        "failed": queue_metrics["failed"],
        "failure_rate": queue_metrics["failure_rate"],
        "throughput": throughput,
        "simulate_failures": simulate_failures,
        "workers": worker_states
    }

@app.post("/api/workers/scale")
async def scale_workers(payload: dict):
    target_count = payload.get("workers", len(worker_tasks))
    current_count = len(worker_tasks)

    if target_count > current_count:
        for i in range(current_count, target_count):
            worker = Worker(worker_id=i, queue=job_queue)
            workers_dict[i] = worker
            task = asyncio.create_task(worker.run())
            worker_tasks.append(task)
    elif target_count < current_count:
        for _ in range(current_count - target_count):
            if worker_tasks:
                task = worker_tasks.pop()
                task.cancel()
                if workers_dict:
                    last_id = max(workers_dict.keys())
                    workers_dict.pop(last_id, None)

    return {"active_workers": len(worker_tasks)}

@app.post("/api/simulation/toggle")
async def toggle_simulation(payload: dict):
    global simulate_failures
    simulate_failures = payload.get("enabled", not simulate_failures)
    for worker in workers_dict.values():
        if hasattr(worker, "simulate_failures"):
            worker.simulate_failures = simulate_failures
    return {"simulate_failures": simulate_failures}

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(0.5)
            # 1. Send live metrics heartbeat
            metrics = job_queue.get_metrics()
            await websocket.send_json({"event": "heartbeat", "metrics": metrics})

            # 2. Broadcast all jobs so the UI list & audit trail update instantly
            all_jobs = await job_queue.get_all_jobs()
            for job in all_jobs.values():
                await websocket.send_json({"event": "job_updated", "job": job})
    except (WebSocketDisconnect, Exception):
        pass