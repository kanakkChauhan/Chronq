import requests
import random
import time
import concurrent.futures

API_URL = "http://127.0.0.1:8000/api/jobs"
# Priorities: 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
PRIORITIES = [1, 2, 3, 4] 

def submit_job(job_index: int):
    priority = random.choice(PRIORITIES)
    payload = {
        "type": f"stress_test_{job_index}",
        "payload": {},
        "priority": priority
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            print(f"✅ Job {job_index} submitted | Priority: {priority}")
        else:
            print(f"❌ Failed to submit job {job_index}")
    except Exception as e:
        print(f"⚠️ Connection error: {e}")

def run_load_test(total_jobs: int = 50):
    print(f"🚀 Firing {total_jobs} concurrent jobs at the API...\n")
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        executor.map(submit_job, range(total_jobs))
        
    duration = time.time() - start_time
    print(f"\n🏁 Finished submitting {total_jobs} jobs in {duration:.2f} seconds.")

if __name__ == "__main__":
    run_load_test(50)