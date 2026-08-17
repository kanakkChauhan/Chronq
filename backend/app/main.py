import os
import time
import uuid
import random
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.engine.queue import job_queue
from app.engine.worker import Worker

app = FastAPI(title="ChronQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

worker_tasks: dict[int, asyncio.Task] = {}
workers_dict: dict[int, Worker] = {}
start_time = time.time()
simulate_failures = False

DEFAULT_WORKERS = int(os.getenv("DEFAULT_WORKERS", 2))

def start_worker_instance(worker_id: int):
    worker = Worker(worker_id=worker_id, queue=job_queue)
    worker.simulate_failures = simulate_failures
    workers_dict[worker_id] = worker
    task = asyncio.create_task(worker.run())
    worker_tasks[worker_id] = task
    return worker

@app.on_event("startup")
async def startup_event():
    global start_time
    start_time = time.time()
    for i in range(DEFAULT_WORKERS):
        start_worker_instance(i)

@app.on_event("shutdown")
async def shutdown_event():
    for worker in workers_dict.values():
        worker.stop()
    for task in worker_tasks.values():
        task.cancel()

@app.post("/api/jobs")
async def create_job(job_data: dict):
    if "id" not in job_data:
        job_data["id"] = f"job-{uuid.uuid4().hex[:8]}"
    
    job_data["status"] = "queued"
    job_data["created_at"] = datetime.now(timezone.utc).isoformat()
    job_data.setdefault("priority", 0)
    job_data.setdefault("retries", 0)
    job_data.setdefault("max_retries", 3)
    job_data.setdefault("error", None)
    job_data.setdefault("attempt_history", [])

    await job_queue.enqueue(job_data)
    return {"status": "queued", "job_id": job_data["id"], "job": job_data}

@app.post("/api/jobs/batch")
async def create_jobs_batch(payload: dict):
    count = int(payload.get("count", 5))
    if count < 1 or count > 50:
        raise HTTPException(status_code=400, detail="Batch count must be between 1 and 50.")

    priority_input = str(payload.get("priority", "mixed")).lower()
    name_prefix = payload.get("name_prefix", "demo-task")

    priority_map = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    all_priorities = [0, 1, 2, 3]

    jobs_to_create = []
    for i in range(1, count + 1):
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        job_name = f"{name_prefix}-{i:02d}"

        if priority_input == "mixed":
            assigned_priority = random.choice(all_priorities)
        else:
            assigned_priority = priority_map.get(priority_input, 1)

        job_data = {
            "id": job_id,
            "name": job_name,
            "status": "queued",
            "priority": assigned_priority,
            "retries": 0,
            "max_retries": 3,
            "error": None,
            "attempt_history": [],
            "payload": {"task": job_name, "batch_generated": True},
        }
        jobs_to_create.append(job_data)

    job_ids = await job_queue.enqueue_batch(jobs_to_create)

    return {
        "status": "success",
        "generated_count": len(job_ids),
        "job_ids": job_ids
    }

@app.post("/api/queue/clear")
async def clear_queue():
    cleared_count = await job_queue.clear_queued()
    queue_metrics = job_queue.get_metrics()
    return {
        "status": "success",
        "cleared_count": cleared_count,
        "remaining_queued": queue_metrics.get("queued", 0),
    }

@app.get("/api/observability")
async def get_observability():
    queue_metrics = job_queue.get_metrics()
    active_count = sum(1 for w in workers_dict.values() if w._running)
    uptime = max(1.0, time.time() - start_time)
    throughput = round(queue_metrics["completed"] / uptime, 1)

    worker_states = {}
    for w_id, w_instance in list(workers_dict.items()):
        worker_states[w_id] = {
            "status": getattr(w_instance, "status", "IDLE"),
            "current_job": getattr(w_instance, "current_job", None),
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
        "workers": worker_states,
    }

@app.post("/api/workers/scale")
async def scale_workers(payload: dict):
    target_count = int(payload.get("count", payload.get("workers", len(workers_dict))))
    if target_count < 1:
        raise HTTPException(status_code=400, detail="Worker count must be at least 1.")

    current_count = len(workers_dict)

    if target_count > current_count:
        # Scale up: determine next available worker IDs
        existing_ids = set(workers_dict.keys())
        next_id = 0
        while len(workers_dict) < target_count:
            if next_id not in existing_ids:
                start_worker_instance(next_id)
                existing_ids.add(next_id)
            next_id += 1

    elif target_count < current_count:
        # Scale down: gracefully stop the highest-numbered workers
        num_to_remove = current_count - target_count
        sorted_ids = sorted(workers_dict.keys(), reverse=True)
        for w_id in sorted_ids[:num_to_remove]:
            worker = workers_dict.pop(w_id)
            worker.stop()
            worker_tasks.pop(w_id, None)

    return {
        "status": "success",
        "active_workers": len(workers_dict),
        "workers": {
            w_id: {"status": w.status, "current_job": w.current_job}
            for w_id, w in workers_dict.items()
        }
    }

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
            metrics = job_queue.get_metrics()
            await websocket.send_json({"event": "heartbeat", "metrics": metrics})

            all_jobs = await job_queue.get_all_jobs()
            for job in all_jobs.values():
                await websocket.send_json({"event": "job_updated", "job": job})
    except (WebSocketDisconnect, Exception):
        pass