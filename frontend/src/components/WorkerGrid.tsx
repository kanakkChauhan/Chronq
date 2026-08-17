import React from 'react';
import type { Worker } from '../types/chronq';

interface WorkerGridProps {
  workers: Worker[];
  onScaleWorkers?: (targetCount: number) => Promise<void>;
}

export const WorkerGrid: React.FC<WorkerGridProps> = ({ workers, onScaleWorkers }) => {
  const getWorkerStatusBadge = (status: Worker['status']) => {
    switch (status) {
      case 'running':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--color-status-success)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-status-success)] animate-pulse"></span>
            processing
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-chronq-warm)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-chronq-warm)]"></span>
            idle
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-status-error)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-error)]"></span>
            failed
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-chronq-gray)] opacity-60">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-chronq-gray)]"></span>
            offline
          </span>
        );
    }
  };

  const handleDecrement = () => {
    if (onScaleWorkers && workers.length > 1) {
      onScaleWorkers(workers.length - 1);
    }
  };

  const handleIncrement = () => {
    if (onScaleWorkers && workers.length < 16) {
      onScaleWorkers(workers.length + 1);
    }
  };

  return (
    <div className="space-y-3">
      {/* Scaling Controls Bar */}
      {onScaleWorkers && (
        <div className="flex items-center justify-between bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded-md px-4 py-2.5">
          <span className="text-xs font-semibold text-[var(--color-chronq-text)]">
            Worker Capacity Control
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={workers.length <= 1}
              onClick={handleDecrement}
              className="w-7 h-7 flex items-center justify-center font-mono font-bold text-sm rounded bg-white border border-[var(--color-chronq-beige)] text-[var(--color-chronq-text)] hover:bg-[var(--color-chronq-beige)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Remove worker"
            >
              −
            </button>
            <span className="font-mono font-bold text-xs text-[var(--color-chronq-espresso)] min-w-[70px] text-center">
              {workers.length} {workers.length === 1 ? 'worker' : 'workers'}
            </span>
            <button
              type="button"
              disabled={workers.length >= 16}
              onClick={handleIncrement}
              className="w-7 h-7 flex items-center justify-center font-mono font-bold text-sm rounded bg-white border border-[var(--color-chronq-beige)] text-[var(--color-chronq-text)] hover:bg-[var(--color-chronq-beige)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Add worker"
            >
              +
            </button>
          </div>
        </div>
      )}

      {workers.length === 0 ? (
        <div className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded-md p-8 text-center text-xs text-[var(--color-chronq-gray)] font-mono">
          No active worker instances registered with orchestrator.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] border-t-2 border-t-[var(--color-chronq-medium)] rounded-md p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[var(--color-chronq-text)]">
                  {worker.name || worker.id}
                </span>
                {getWorkerStatusBadge(worker.status)}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[var(--color-chronq-gray)]">
                  <span>Current Task:</span>
                  <span className="font-mono text-[var(--color-chronq-text)] truncate max-w-[140px]">
                    {worker.current_job_id || <span className="opacity-50 italic">None (Idle)</span>}
                  </span>
                </div>
                {worker.jobs_completed !== undefined && (
                  <div className="flex justify-between text-[var(--color-chronq-gray)]">
                    <span>Completed:</span>
                    <span className="font-mono font-medium text-[var(--color-chronq-text)]">{worker.jobs_completed}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};