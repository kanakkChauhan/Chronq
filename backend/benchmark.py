import time
import statistics
import requests
import sys

BASE_URL = "http://localhost:8000"

def set_workers(count):
    res = requests.post(f"{BASE_URL}/api/workers/scale", json={"workers": count})
    if res.status_code != 200:
        print(f"Error scaling workers: {res.text}")
        sys.exit(1)
    time.sleep(0.5)

def run_benchmark(num_jobs=20, worker_count=1):
    print(f"\n----------------------------------------------")
    print(f" BENCHMARK: {worker_count} Workers | {num_jobs} Jobs")
    print(f"----------------------------------------------")
    
    set_workers(worker_count)
    
    job_ids = []
    start_time = time.time()
    
    # Enqueue batch
    for i in range(num_jobs):
        priority = (i % 3) + 1
        res = requests.post(f"{BASE_URL}/api/jobs", json={
            "type": "benchmark_job",
            "payload": {"index": i},
            "priority": priority
        })
        if res.status_code == 200:
            job_ids.append(res.json()["job_id"])
            
    print(f"-> Submitted {len(job_ids)} jobs. Processing...")

    poll_start = time.time()
    
    # Poll observability endpoint until queue is empty and nothing is running
    while True:
        try:
            res = requests.get(f"{BASE_URL}/api/observability", timeout=2)
            if res.status_code == 200:
                data = res.json()
                queued = data.get("queued", 0)
                running = data.get("running", 0)
                if queued == 0 and running == 0:
                    break
        except Exception:
            pass
        print(".", end="", flush=True)
        time.sleep(0.5)
        
    total_duration = time.time() - poll_start
    print(f" Done in {total_duration:.2f}s!")
    
    # Fetch final states of all jobs
    completed_jobs = []
    for jid in job_ids:
        r = requests.get(f"{BASE_URL}/api/jobs/{jid}")
        if r.status_code == 200:
            completed_jobs.append(r.json())
    
    successes = sum(1 for j in completed_jobs if j["status"] == "COMPLETED")
    failures = sum(1 for j in completed_jobs if j["status"] == "FAILED")
    total_retries = sum(j["retries"] for j in completed_jobs)
    
    throughput = len(job_ids) / total_duration if total_duration > 0 else 0
    success_rate = (successes / len(job_ids)) * 100
    retry_rate = (total_retries / len(job_ids)) * 100
    
    queue_wait_times = []
    execution_times = []
    total_latencies = []
    
    for j in completed_jobs:
        if j.get("started_at") and j.get("completed_at"):
            qw = j["started_at"] - j["created_at"]
            ex = j["completed_at"] - j["started_at"]
            tot = j["completed_at"] - j["created_at"]
            
            queue_wait_times.append(qw)
            execution_times.append(ex)
            total_latencies.append(tot)
            
    p50 = statistics.median(total_latencies) if total_latencies else 0
    p95 = statistics.quantiles(total_latencies, n=20)[18] if len(total_latencies) >= 20 else p50
    p99 = statistics.quantiles(total_latencies, n=100)[98] if len(total_latencies) >= 100 else p95
    
    avg_queue_wait = statistics.mean(queue_wait_times) if queue_wait_times else 0
    avg_exec = statistics.mean(execution_times) if execution_times else 0

    print(f"  • Throughput:      {throughput:.2f} jobs/sec")
    print(f"  • Success Rate:    {success_rate:.1f}%")
    print(f"  • P50 Latency:     {p50*1000:.2f} ms")
    print(f"  • P99 Latency:     {p99*1000:.2f} ms")
    
    return {
        "workers": worker_count,
        "throughput": throughput,
        "success_rate": success_rate,
        "p50": p50 * 1000,
        "p99": p99 * 1000
    }

if __name__ == "__main__":
    print("Starting TaskFlow Performance Benchmark Suite...")
    try:
        requests.get(f"{BASE_URL}/api/workers")
    except Exception:
        print("Error: Backend server is not running on port 8000.")
        sys.exit(1)
        
    results = []
    for count in [1, 2, 4, 8]:
        res = run_benchmark(num_jobs=20, worker_count=count)
        results.append(res)
        time.sleep(0.5)
        
    print(f"\n==============================================")
    print(" COMPARATIVE SCALING BENCHMARK TABLE")
    print("==============================================")
    print(f"{'Workers':<10} | {'Throughput':<15} | {'Success Rate':<15} | {'P50 Latency':<12} | {'P99 Latency':<12}")
    print("-" * 75)
    for r in results:
        print(f"{r['workers']:<10} | {r['throughput']:<15.2f} | {r['success_rate']:<14.1f}% | {r['p50']:<9.2f} ms | {r['p99']:<9.2f} ms")
    print("==============================================")