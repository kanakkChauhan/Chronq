from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uuid
import time

class JobAttempt(BaseModel):
    attempt: int
    status: str
    error: Optional[str] = None
    timestamp: float = Field(default_factory=time.time)

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    payload: Dict[str, Any] = {}
    status: str = "QUEUED"  # QUEUED, RUNNING, COMPLETED, FAILED, RETRYING
    priority: int = 1       # Integer priority (higher number = higher priority)
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    attempt_history: List[JobAttempt] = []
    created_at: float = Field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None