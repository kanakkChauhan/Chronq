import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app

client = TestClient(app)

@patch("app.engine.queue.RedisJobQueue.enqueue", new_callable=AsyncMock)
@patch("app.engine.queue.RedisJobQueue.get_metrics")
def test_create_and_get_job(mock_get_metrics, mock_enqueue):
    mock_get_metrics.return_value = {
        "queued": 1,
        "running": 0,
        "completed": 0,
        "failed": 0,
        "failure_rate": 0.0
    }

    job_payload = {
        "id": "auto-test-job-1",
        "type": "email_notification",
        "priority": 10,
        "max_retries": 2,
        "payload": {"recipient": "test@example.com"}
    }

    response = client.post("/api/jobs", json=job_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert data["job_id"] == "auto-test-job-1"

    obs_response = client.get("/api/observability")
    assert obs_response.status_code == 200
    obs_data = obs_response.json()
    assert obs_data["queued"] == 1