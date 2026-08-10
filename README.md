# Chronq

**Redis-backed Task Queue & Worker Orchestrator**

Chronq is a task queue system built with **FastAPI, Redis, Python asyncio, React, and WebSockets**. Jobs can be queued with different priorities, processed by background workers, retried when they fail, and monitored through a real-time dashboard.

**Live Demo:** https://chronq.vercel.app/

## Features

* Redis-backed priority queue
* Priority-based job scheduling
* Concurrent asynchronous workers
* Configurable retry handling
* Job attempt history and error tracking
* Queued, running, completed, and failed job states
* Real-time job updates through WebSockets
* Worker fleet monitoring
* Queue and throughput metrics
* Failure simulation for testing retry behavior
* Automated API tests with Pytest
* Docker and Docker Compose support

## Architecture

```text
                    ┌──────────────┐
                    │    React     │
                    │  Dashboard   │
                    └──────┬───────┘
                           │
                    REST / WebSocket
                           │
                           ▼
                    ┌──────────────┐
                    │   FastAPI    │
                    │     API      │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Redis     │
                    │              │
                    │ Priority     │
                    │ Queue + Job  │
                    │ State        │
                    └──────┬───────┘
                           │
                    Highest Priority
                           │
                           ▼
                ┌─────────────────────┐
                │   Async Workers     │
                │                     │
                │ Worker 1  Worker 2  │
                │ Worker 3  ...       │
                └──────────┬──────────┘
                           │
                           ▼
                     Job Execution
                           │
                  ┌────────┼────────┐
                  ▼        ▼        ▼
             Completed   Retry    Failed
```

## How It Works

1. A client submits a job through the FastAPI API.
2. The job is stored in Redis and added to a priority-sorted queue.
3. Background workers wait for available jobs.
4. Workers dequeue the highest-priority available job.
5. The job state is updated as it moves through its lifecycle.
6. Failed jobs can be retried according to their configured retry limit.
7. Attempt history and errors are persisted with the job state.
8. Job updates are broadcast to connected frontend clients through WebSockets.
9. The React dashboard displays worker status and queue metrics in real time.

## Priority Queue

Chronq uses a Redis **Sorted Set** to implement priority scheduling.

Jobs are assigned a priority from **1–10**, with higher-priority jobs receiving higher scores. Workers use Redis priority operations to retrieve the highest-priority available job.

For example:

```text
Priority 10  → Critical Alert
Priority 7   → Payment Processing
Priority 3   → API Request
Priority 1   → Report Generation
```

This allows urgent workloads to be processed ahead of lower-priority jobs when multiple jobs are waiting in the queue.

## Retry & Failure Handling

Jobs can define a maximum retry count.

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

A failed job records its error and attempt number before being retried.

The lifecycle can look like:

```text
QUEUED
  ↓
RUNNING
  ↓
FAILED
  ↓
RETRYING
  ↓
RUNNING
  ↓
COMPLETED
```

If the job exceeds its retry limit, it moves to `FAILED`.

The dashboard exposes the attempt history so individual failures can be inspected.

## Real-Time Monitoring

The React dashboard receives job lifecycle updates through WebSockets and displays:

* Active workers
* Worker status
* Queued jobs
* Running jobs
* Completed jobs
* Failed jobs
* Failure rate
* Throughput
* Job priority
* Retry attempts
* Failure messages

A failure simulation mode is also included to demonstrate retry and failure-handling behavior.

## Tech Stack

| Layer                   | Technology              |
| ----------------------- | ----------------------- |
| Backend                 | Python, FastAPI         |
| Queue & State           | Redis                   |
| Workers                 | Python asyncio          |
| Frontend                | React, TypeScript, Vite |
| Styling                 | Tailwind CSS            |
| Real-time Communication | WebSockets              |
| Testing                 | Pytest, HTTPX           |
| Deployment              | Vercel, Render          |
| Containers              | Docker, Docker Compose  |

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

## Running Locally

### Using Docker

```bash
git clone https://github.com/kanakkChauhan/Chronq.git
cd Chronq
docker compose up --build
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000
```

### Running Tests

```bash
cd backend
PYTHONPATH=. pytest -v
```

## Example API Job

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

## Why Chronq?

I built Chronq to get a better understanding of what happens inside a task queue instead of relying on an existing task queue library.

The project focuses on:

* Priority scheduling
* Asynchronous worker execution
* Shared state management with Redis
* Retry and failure handling
* Real-time system monitoring
* API testing
* Containerized development and deployment

It brings these pieces together into a small working system where jobs move from an API into a shared queue, are processed by workers, and have their progress exposed through a real-time frontend.
