export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkerStatus = 'idle' | 'running' | 'processing' | 'failed' | 'offline';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface Job {
  id: string;
  name: string;
  type?: string;
  priority: JobPriority;
  status: JobStatus;
  worker_id?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  attempts?: number;
  max_retries?: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  current_job_id?: string | null;
  last_heartbeat?: string;
  jobs_completed?: number;
  jobs_failed?: number;
  uptime_seconds?: number;
}

export interface SystemMetrics {
  active_workers: number;
  queued_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  throughput_per_minute?: number;
  failure_rate?: number;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp?: string;
}

export interface BatchWorkloadConfig {
  count: number;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'mixed';
  name_prefix?: string;
}