# Chronq

A small task queue system built with FastAPI, Redis, and React.

I built Chronq to understand how background job processing works instead of using an existing task queue library. Jobs are added to Redis, assigned a priority, and picked up by background workers for processing.

The frontend shows the current state of the queue and job execution in real time.

## What it does

* Adds jobs to a Redis-backed queue
* Processes jobs using background workers
* Supports job priorities
* Retries failed jobs
* Keeps track of job attempts and errors
* Tracks queued, running, completed, and failed jobs
* Sends job updates to the frontend over WebSockets
* Includes a small observability dashboard

## How it works

```text
Client
  |
  v
FastAPI
  |
  v
Redis
  |
  v
Worker(s)
  |
  v
Job execution
  |
  +----> Completed
  |
  +----> Retry
  |
  +----> Failed
```

Redis is used for both the queue and job state. Jobs are stored in a Sorted Set so that workers can pick the highest-priority job first.

## Tech Stack

* **Backend:** Python, FastAPI
* **Queue:** Redis
* **Workers:** Python asyncio
* **Frontend:** React, TypeScript, Vite
* **Real-time updates:** WebSockets
* **Testing:** Pytest
* **Deployment:** Docker / Docker Compose

## Project Structure

```text
Chronq/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── engine/
│   │   ├── models/
│   │   └── main.py
│   ├── tests/
│   ├── benchmarks/
│   ├── scripts/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Running it

### With Docker

```bash
git clone https://github.com/kanakkChauhan/Chronq.git
cd Chronq
docker compose up --build
```

Frontend:

`http://localhost:5173`

Backend:

`http://localhost:8000`

### Running the tests

```bash
cd backend
PYTHONPATH=. pytest -v
```

## Example Job

```json
{
  "id": "example-job-1",
  "type": "email_notification",
  "priority": 10,
  "max_retries": 2,
  "payload": {
    "recipient": "user@example.com"
  }
}
```

A job starts in the queue, gets picked up by a worker, and moves through the different states depending on whether processing succeeds or fails.

## Why I built it

The main goal was to learn what actually happens inside a task queue — priority handling, worker execution, retries, shared state, and communicating job status back to a frontend.

It also gave me a chance to work with Redis, asyncio, WebSockets, Docker, and testing in the same project.
