import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job, Worker, SystemMetrics, ConnectionStatus, JobPriority, BatchWorkloadConfig } from '../types/chronq';

const API_BASE = window.location.origin.includes('localhost')
  ? 'http://localhost:8000'
  : window.location.origin;

const WS_BASE = window.location.origin.includes('localhost')
  ? 'ws://localhost:8000/api/ws'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;

interface BackendWorkerInfo {
  status?: string;
  current_job?: string | null;
}

export function useChronQ() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    active_workers: 0,
    queued_jobs: 0,
    processing_jobs: 0,
    completed_jobs: 0,
    failed_jobs: 0,
    throughput_per_minute: 0,
    failure_rate: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(false);

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/observability`);
      if (!res.ok) throw new Error(`Observability fetch failed: ${res.status}`);
      const data = await res.json();

      if (isMountedRef.current) {
        setMetrics({
          active_workers: data.active_workers ?? 0,
          queued_jobs: data.queued ?? 0,
          processing_jobs: data.running ?? 0,
          completed_jobs: data.completed ?? 0,
          failed_jobs: data.failed ?? 0,
          throughput_per_minute: data.throughput ?? 0,
          failure_rate: data.failure_rate ?? 0,
        });

        if (data.workers && typeof data.workers === 'object') {
          const parsedWorkers: Worker[] = Object.entries(data.workers as Record<string, BackendWorkerInfo>).map(
            ([id, info]) => ({
              id: `worker-${id}`,
              name: `Worker #${id}`,
              status: (info.status?.toLowerCase() || 'idle') as Worker['status'],
              current_job_id: info.current_job ?? null,
            })
          );
          setWorkers(parsedWorkers);
        }
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('[ChronQ] Error fetching telemetry:', err);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus('connecting');
    const ws = new WebSocket(WS_BASE);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        setLastUpdated(new Date());

        if (msg.event === 'heartbeat' && msg.metrics) {
          setMetrics((prev) => ({
            ...prev,
            queued_jobs: msg.metrics.queued ?? prev.queued_jobs,
            processing_jobs: msg.metrics.running ?? prev.processing_jobs,
            completed_jobs: msg.metrics.completed ?? prev.completed_jobs,
            failed_jobs: msg.metrics.failed ?? prev.failed_jobs,
            failure_rate: msg.metrics.failure_rate ?? prev.failure_rate,
          }));
        }

        if (msg.event === 'job_updated' && msg.job) {
          const priorityVal = msg.job.priority;
          const priorityLabel: JobPriority =
            priorityVal === 3 ? 'critical' : priorityVal === 2 ? 'high' : priorityVal === 1 ? 'medium' : 'low';

          const updatedJob: Job = {
            id: msg.job.id,
            name: msg.job.name || msg.job.id,
            priority: priorityLabel,
            status: (msg.job.status || 'queued') as Job['status'],
            worker_id: msg.job.worker_id ?? null,
            created_at: msg.job.created_at || new Date().toISOString(),
            started_at: msg.job.started_at ?? null,
            completed_at: msg.job.completed_at ?? null,
            error: msg.job.error ?? null,
            attempts: msg.job.retries ?? 0,
            max_retries: msg.job.max_retries ?? 3,
            payload: msg.job.payload ?? null,
          };

          setJobs((prevJobs) => {
            const index = prevJobs.findIndex((j) => j.id === updatedJob.id);
            if (index >= 0) {
              const updated = [...prevJobs];
              updated[index] = updatedJob;
              return updated;
            }
            return [updatedJob, ...prevJobs];
          });
        }
      } catch (err) {
        console.error('[ChronQ] WebSocket parse error:', err);
      }
    };

    ws.onerror = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('disconnected');
      wsRef.current = null;
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setConnectionStatus('reconnecting');
          connectWebSocket();
        }
      }, 2500);
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialData();
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchInitialData, connectWebSocket]);

  const createJob = async (jobData: {
    name: string;
    priority: string;
    payload?: Record<string, unknown> | null;
    max_retries?: number;
  }) => {
    const priorityMap: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

    const payload = {
      name: jobData.name,
      priority: priorityMap[jobData.priority] ?? 1,
      max_retries: jobData.max_retries ?? 3,
      payload: jobData.payload || {},
    };

    const res = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (data.job) {
      const newJob: Job = {
        id: data.job.id,
        name: data.job.name || data.job.id,
        priority: (jobData.priority as JobPriority) || 'medium',
        status: (data.job.status || 'queued') as Job['status'],
        created_at: data.job.created_at || new Date().toISOString(),
        worker_id: null,
      };
      setJobs((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);
    }
  };

  const generateWorkload = async (config: BatchWorkloadConfig) => {
    const res = await fetch(`${API_BASE}/api/jobs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: config.count,
        priority: config.priority,
        name_prefix: config.name_prefix || 'demo-task',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Workload generation failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    // Immediately fetch fresh state to hydrate all created jobs without waiting for individual WS ticks
    await fetchInitialData();
    return data;
  };

  const scaleWorkers = async (count: number) => {
    if (count < 1) return;
    const res = await fetch(`${API_BASE}/api/workers/scale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Scaling workers failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (data.workers) {
      const parsedWorkers: Worker[] = Object.entries(data.workers as Record<string, BackendWorkerInfo>).map(
        ([id, info]) => ({
          id: `worker-${id}`,
          name: `Worker #${id}`,
          status: (info.status?.toLowerCase() || 'idle') as Worker['status'],
          current_job_id: info.current_job ?? null,
        })
      );
      setWorkers(parsedWorkers);
      setMetrics((prev) => ({ ...prev, active_workers: data.active_workers }));
    }
    return data;
  };

  const clearQueue = async () => {
    const res = await fetch(`${API_BASE}/api/queue/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Clear queue failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    setJobs((prevJobs) => prevJobs.filter((job) => job.status !== 'queued'));
    setMetrics((prev) => ({
      ...prev,
      queued_jobs: 0,
    }));
    return data;
  };

  const toggleSimulation = async (enabled?: boolean) => {
    await fetch(`${API_BASE}/api/simulation/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  };

  return {
    jobs,
    workers,
    metrics,
    connectionStatus,
    lastUpdated,
    createJob,
    generateWorkload,
    scaleWorkers,
    clearQueue,
    toggleSimulation,
    refreshData: fetchInitialData,
  };
}