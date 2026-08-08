import asyncio
import time
import httpx

API_URL = "http://localhost:8000/api/jobs"
TOTAL_JOBS = 200
CONCURRENCY = 20

async def submit_job(client: httpx.AsyncClient, job_id: int):
    payload = {
        "id": f"bench-job-{job_id}",
        "type": "benchmark_task",
        "priority": 1,
        "max_retries": 1,
        "payload": {"index": job_id}
    }
    start_time = time.perf_counter()
    try:
        response = await client.post(API_URL, json=payload, timeout=10.0)
        latency = time.perf_counter() - start_time
        return response.status_code == 200, latency
    except Exception:
        return False, time.perf_counter() - start_time

async def run_benchmark():
    print(f"🚀 Starting TaskFlow Load Test: {TOTAL_JOBS} jobs with concurrency {CONCURRENCY}...")
    
    limits = httpx.Limits(max_keepalive_connections=CONCURRENCY, max_connections=CONCURRENCY)
    async with httpx.AsyncClient(limits=limits) as client:
        semaphore = asyncio.Semaphore(CONCURRENCY)
        
        async def bounded_submit(job_id):
            async with semaphore:
                return await submit_job(client, job_id)

        start_wall_time = time.perf_counter()
        results = await asyncio.gather(*(bounded_submit(i) for i in range(TOTAL_JOBS)))
        total_time = time.perf_counter() - start_wall_time

    successes = sum(1 for success, _ in results if success)
    latencies = sorted([latency for _, latency in results])
    
    # Calculate percentiles
    p50 = latencies[int(len(latencies) * 0.50)]
    p95 = latencies[int(len(latencies) * 0.95)]
    p99 = latencies[int(len(latencies) * 0.99)]
    throughput = TOTAL_JOBS / total_time

    print("\n" + "="*40)
    print("📊 TASKFLOW BENCHMARK RESULTS")
    print("="*40)
    print(f"Total Jobs Submitted : {TOTAL_JOBS}")
    print(f"Successful Requests  : {successes}/{TOTAL_JOBS}")
    print(f"Total Time Taken     : {total_time:.4f} seconds")
    print(f"Throughput           : {throughput:.2f} req/sec")
    print(f"Latency P50          : {p50 * 1000:.2f} ms")
    print(f"Latency P95          : {p95 * 1000:.2f} ms")
    print(f"Latency P99          : {p99 * 1000:.2f} ms")
    print("="*40)

if __name__ == "__main__":
    asyncio.run(run_benchmark())