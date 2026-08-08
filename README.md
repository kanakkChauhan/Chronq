# Chronq

This is a tool that helps us process tasks one, by one. It is made using FastAPI, Redis and some custom Python code that runs in the background.

## What it does

- **Priority Queueing:** It uses Redis to make sure that the important tasks are done first.

- **Concurrent Workers:** It uses Pythons `asyncio` to run tasks at the same time.

- **Live Observability:** We can see what is happening with the tasks in time like how many are being done and how many are failing.

## Tech Stack

- **Backend:** We use FastAPI, Python and Redis (`redis-py`) to make the backend work.

- **Frontend:** The frontend is made with React, Vite and Tailwind CSS.

- **Testing:** We use Pytest and HTTPX to test everything.

## How to Run Locally

1. **Clone the repository:**

   ```bash
   git clone [https://github.com/kanakkChauhan/Chronq.git](https://github.com/kanakkChauhan/Chronq.git)
   cd Chronq