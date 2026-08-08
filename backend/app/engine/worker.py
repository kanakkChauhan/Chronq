import asyncio
import random
import logging
import time
import json
from app.engine.queue import job_queue
from app.api.websocket import ws_manager
from app.models.job import JobAttempt

logger = logging.getLogger(__name__)

worker_states = {}
engine_config = {"simulate_failures": False}

async def worker_loop(worker_id: int):
    worker_states[worker_id] = {"status": "IDLE", "current_job": None}
    try:
        while True:
            try:
                worker_states[worker_id]["status"] = "IDLE"
                worker_states[worker_id]["current_job"] = None

                job = await job_queue.dequeue()

                worker_states[worker_id]["status"] = "BUSY"
                worker_states[worker_id]["current_job"] = job.id

                job.status = "RUNNING"
                job.started_at = time.time()
                await job_queue.update_job(job) # Sync to Redis

                try:
                    safe_job = json.loads(job.json() if not hasattr(job, "model_dump_json") else job.model_dump_json())
                    await ws_manager.broadcast({"event": "job_updated", "job": safe_job})
                except Exception as ws_err:
                    logger.error(f"WS Broadcast Error (Running): {ws_err}")

                success = False
                current_attempt_num = 1

                while job.retries <= job.max_retries and not success:
                    try:
                        await asyncio.sleep(random.uniform(0.2, 0.5))

                        if engine_config["simulate_failures"]:
                            if random.random() < 0.70:
                                errors = ["External API rate-limit exceeded", "Database connection timeout", "503 Service Unavailable"]
                                raise Exception(random.choice(errors))

                        success = True
                        job.status = "COMPLETED"
                        job.error = None
                        job.completed_at = time.time()

                        job.attempt_history.append(JobAttempt(
                            attempt=current_attempt_num,
                            status="COMPLETED",
                            error=None
                        ))

                        await job_queue.update_job(job) # Final sync to Redis

                    except Exception as e:
                        job.retries += 1
                        err_msg = str(e)
                        job.error = err_msg

                        job.attempt_history.append(JobAttempt(
                            attempt=current_attempt_num,
                            status="FAILED",
                            error=err_msg
                        ))

                        if job.retries > job.max_retries:
                            job.status = "FAILED"
                            job.completed_at = time.time()
                            await job_queue.update_job(job) # Final sync to Redis
                            break
                        else:
                            job.status = "RETRYING"
                            await job_queue.update_job(job) # Sync retry state
                            current_attempt_num += 1
                            try:
                                safe_job = json.loads(job.json() if not hasattr(job, "model_dump_json") else job.model_dump_json())
                                await ws_manager.broadcast({"event": "job_updated", "job": safe_job})
                            except Exception as ws_err:
                                logger.error(f"WS Broadcast Error (Retrying): {ws_err}")

                            await asyncio.sleep(0.5 * job.retries)
                            job.status = "RUNNING"
                            await job_queue.update_job(job) # Sync recovery state

                try:
                    safe_job = json.loads(job.json() if not hasattr(job, "model_dump_json") else job.model_dump_json())
                    await ws_manager.broadcast({"event": "job_updated", "job": safe_job})
                except Exception as ws_err:
                    logger.error(f"WS Broadcast Error (Completed): {ws_err}")

            except Exception as inner_err:
                logger.error(f"Worker {worker_id} encountered an error: {inner_err}")
                await asyncio.sleep(0.5)

    except asyncio.CancelledError:
        worker_states.pop(worker_id, None)
        raise