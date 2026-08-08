from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid
import time

class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 1  # Higher number = higher priority
    status: JobStatus = JobStatus.QUEUED
    error: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    
    # NEW: Retry tracking fields
    retries: int = 0
    max_retries: int = 3

    def __lt__(self, other: "Job"):
        # Min-Heap comparator: Higher priority comes first.
        if self.priority != other.priority:
            return self.priority > other.priority
        # Tie-breaker: FIFO (earlier creation time comes first)
        return self.created_at < other.created_at