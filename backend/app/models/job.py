from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import uuid
from datetime import datetime, timezone

class JobStatus(str, Enum):
    """The absolute state machine for a task."""
    PENDING = "PENDING"          # Created, but not yet evaluated
    QUEUED = "QUEUED"            # Waiting in the priority queue
    RUNNING = "RUNNING"          # Picked up by a worker
    COMPLETED = "COMPLETED"      # Successfully finished
    FAILED = "FAILED"            # Crashed (might be retried)
    DEAD_LETTER = "DEAD_LETTER"  # Out of retries, permanently abandoned

class JobPriority(int, Enum):
    """Integer-based priority for the scheduler (higher integer = process first)."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class Job(BaseModel):
    """The core data structure traveling through our distributed system."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # e.g., "code_lint", "data_process"
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: JobPriority = JobPriority.MEDIUM
    status: JobStatus = JobStatus.PENDING
    
    # Telemetry & Observability
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    
    # Fault Tolerance
    retries: int = 0
    max_retries: int = 3
    error: Optional[str] = None