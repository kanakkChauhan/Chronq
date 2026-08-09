import os
import json
from redis import Redis

class RedisJobQueue:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            # 1. Automatically ensure Upstash URLs use rediss:// (TLS/SSL required)
            if "upstash.io" in redis_url and redis_url.startswith("redis://"):
                redis_url = redis_url.replace("redis://", "rediss://", 1)

            # 2. Configure keepalives and SSL handshake resilience for Render containers
            kwargs = {
                "decode_responses": True,
                "socket_keepalive": True,
                "health_check_interval": 10,
                "retry_on_timeout": True,
            }
            if redis_url.startswith("rediss://"):
                kwargs["ssl_cert_reqs"] = "none"

            self.redis = Redis.from_url(redis_url, **kwargs)
        else:
            redis_host = os.getenv("REDIS_HOST", "127.0.0.1")
            self.redis = Redis(host=redis_host, port=6379, db=0, decode_responses=True)

        self.queue_key = "taskflow:queue"
        self.jobs_key = "taskflow:jobs"
        self.metrics_key = "taskflow:metrics"

    async def enqueue(self, job: dict):
        job_id = job["id"]
        priority = job.get("priority", 0)
        job["status"] = "queued"
        job.setdefault("attempt_history", [])

        self.redis.hset(self.jobs_key, job_id, json.dumps(job))
        self.redis.zadd(self.queue_key, {job_id: priority})
        self.redis.hincrby(self.metrics_key, "queued", 1)
        return job

    async def dequeue(self):
        res = self.redis.zpopmax(self.queue_key, count=1)
        if not res:
            return None

        job_id, _ = res[0]
        raw = self.redis.hget(self.jobs_key, job_id)
        if not raw:
            return None

        job = json.loads(raw)
        job["status"] = "running"

        self.redis.hset(self.jobs_key, job_id, json.dumps(job))
        self.redis.hincrby(self.metrics_key, "queued", -1)
        self.redis.hincrby(self.metrics_key, "running", 1)
        return job

    async def get_job(self, job_id: str):
        raw = self.redis.hget(self.jobs_key, job_id)
        return json.loads(raw) if raw else None

    async def update_job(self, job: dict):
        self.redis.hset(self.jobs_key, job["id"], json.dumps(job))
        return job

    async def complete_job(self, job_id: str):
        raw = self.redis.hget(self.jobs_key, job_id)
        if raw:
            job = json.loads(raw)
            job["status"] = "completed"

            # Record audit trail entry
            attempt_num = job.get("retries", 0) + 1
            job.setdefault("attempt_history", []).append({
                "attempt": attempt_num,
                "status": "COMPLETED",
                "error": None
            })

            self.redis.hset(self.jobs_key, job_id, json.dumps(job))
            self.redis.hincrby(self.metrics_key, "running", -1)
            self.redis.hincrby(self.metrics_key, "completed", 1)
            return job
        return None

    async def fail_job(self, job_id: str, error: str = None):
        raw = self.redis.hget(self.jobs_key, job_id)
        if raw:
            job = json.loads(raw)
            job["status"] = "failed"
            if error:
                job["error"] = error

            # Record audit trail entry
            attempt_num = job.get("retries", 0) + 1
            job.setdefault("attempt_history", []).append({
                "attempt": attempt_num,
                "status": "FAILED",
                "error": error or "Execution failed"
            })

            self.redis.hset(self.jobs_key, job_id, json.dumps(job))
            self.redis.hincrby(self.metrics_key, "running", -1)
            self.redis.hincrby(self.metrics_key, "failed", 1)
            return job
        return None

    async def retry_job(self, job_id: str, error: str = None):
        raw = self.redis.hget(self.jobs_key, job_id)
        if raw:
            job = json.loads(raw)
            job["status"] = "retrying"
            job["retries"] = job.get("retries", 0) + 1
            if error:
                job["error"] = error

            # Record audit trail entry for the failed attempt before retrying
            attempt_num = job["retries"]
            job.setdefault("attempt_history", []).append({
                "attempt": attempt_num,
                "status": "FAILED",
                "error": error or "Simulated Worker Failure"
            })

            self.redis.hset(self.jobs_key, job_id, json.dumps(job))
            self.redis.zadd(self.queue_key, {job_id: job.get("priority", 0)})
            return job
        return None

    async def get_all_jobs(self):
        all_raw = self.redis.hgetall(self.jobs_key)
        return {jid: json.loads(val) for jid, val in all_raw.items()}

    def get_metrics(self):
        metrics = self.redis.hgetall(self.metrics_key)
        queued = self.redis.zcard(self.queue_key)
        running = int(metrics.get("running", 0))
        completed = int(metrics.get("completed", 0))
        failed = int(metrics.get("failed", 0))

        total_finished = completed + failed
        failure_rate = round((failed / total_finished * 100), 1) if total_finished > 0 else 0.0

        return {
            "queued": queued,
            "running": running,
            "completed": completed,
            "failed": failed,
            "failure_rate": failure_rate
        }

job_queue = RedisJobQueue()