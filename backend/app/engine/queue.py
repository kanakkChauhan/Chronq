import os
import json
import logging
from redis.asyncio import Redis
from app.models.job import Job

logger = logging.getLogger(__name__)

class RedisJobQueue:
    def __init__(self):
        redis_host = os.getenv("REDIS_HOST", "127.0.0.1")
        self.redis = Redis(host=redis_host, port=6379, db=0, decode_responses=True)
        self.queue_key = "taskflow:queue"
        self.jobs_key = "taskflow:jobs"
        self.metrics_key = "taskflow:metrics"

    def _to_json(self, job: Job) -> str:
        # Pydantic V1 and V2 compatibility wrapper
        if hasattr(job, "model_dump_json"):
            return job.model_dump_json()
        return job.json()

    async def enqueue(self, job: Job):
        # 1. Save the job payload
        await self.redis.hset(self.jobs_key, job.id, self._to_json(job))
        # 2. Add to Sorted Set using the priority as the rank score
        await self.redis.zadd(self.queue_key, {job.id: job.priority})
        # 3. Update global metrics
        await self.redis.hincrby(self.metrics_key, "queued", 1)

    async def dequeue(self):
        while True:
            # BZPOPMAX: Blocks until a job appears, then pops the highest priority score
            result = await self.redis.bzpopmax(self.queue_key, timeout=1)
            if result:
                _, job_id, _ = result
                job_data = await self.redis.hget(self.jobs_key, job_id)
                if job_data:
                    await self.redis.hincrby(self.metrics_key, "queued", -1)
                    await self.redis.hincrby(self.metrics_key, "running", 1)
                    job_dict = json.loads(job_data)
                    return Job(**job_dict)

    async def update_job(self, job: Job):
        """Workers call this to sync state mutations back into the database"""
        await self.redis.hset(self.jobs_key, job.id, self._to_json(job))

        if job.status == "COMPLETED":
            await self.redis.hincrby(self.metrics_key, "running", -1)
            await self.redis.hincrby(self.metrics_key, "completed", 1)
        elif job.status == "FAILED":
            await self.redis.hincrby(self.metrics_key, "running", -1)
            await self.redis.hincrby(self.metrics_key, "failed", 1)

    async def get_metrics(self):
        metrics = await self.redis.hgetall(self.metrics_key)
        queued = int(metrics.get("queued", 0))
        running = int(metrics.get("running", 0))
        completed = int(metrics.get("completed", 0))
        failed = int(metrics.get("failed", 0))

        total = completed + failed
        failure_rate = round((failed / total * 100), 1) if total > 0 else 0.0

        return {
            "queued": max(0, queued),
            "running": max(0, running),
            "completed": completed,
            "failed": failed,
            "failure_rate": failure_rate
        }

    async def get_job_status(self, job_id: str):
        data = await self.redis.hget(self.jobs_key, job_id)
        return json.loads(data) if data else None

# Initialize the global Redis connection
job_queue = RedisJobQueue()