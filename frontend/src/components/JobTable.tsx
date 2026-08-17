import React from 'react';
import type { Job } from '../types/chronq';

interface JobTableProps {
  jobs: Job[];
  onRetry: (jobId: string) => void;
  onSimulateFailure?: (jobId: string) => void;
}

export const JobTable: React.FC<JobTableProps> = ({ jobs, onRetry, onSimulateFailure }) => {
  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--color-status-success-bg)] text-[var(--color-status-success)] border border-[var(--color-status-success)]/20">
            completed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)] border border-[var(--color-status-warning)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-warning)] animate-ping"></span>
            running
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--color-status-error-bg)] text-[var(--color-status-error)] border border-[var(--color-status-error)]/20">
            failed
          </span>
        );
      case 'queued':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--color-chronq-beige)]/40 text-[var(--color-chronq-gray)] border border-[var(--color-chronq-beige)]">
            queued
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: Job['priority']) => {
    switch (priority) {
      case 'critical':
        return <span className="font-bold text-[var(--color-status-error)] text-xs">CRITICAL</span>;
      case 'high':
        return <span className="font-semibold text-[var(--color-status-warning)] text-xs">HIGH</span>;
      case 'medium':
        return <span className="font-medium text-[var(--color-chronq-warm)] text-xs">MED</span>;
      case 'low':
      default:
        return <span className="text-[var(--color-chronq-gray)] text-xs">LOW</span>;
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded-md p-10 text-center">
        <p className="text-sm text-[var(--color-chronq-gray)] font-mono">No active or historical jobs found in queue.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded-md overflow-hidden shadow-xs">
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--color-chronq-beige)]/40 border-b border-[var(--color-chronq-beige)] text-[var(--color-chronq-gray)] font-mono uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Job ID</th>
              <th className="py-3 px-4">Name / Type</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Worker</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-chronq-beige)]/60 font-sans">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-[var(--color-chronq-cream)]/70 transition-colors">
                <td className="py-3 px-4 font-mono font-medium text-[var(--color-chronq-text)]">{job.id}</td>
                <td className="py-3 px-4 font-medium text-[var(--color-chronq-text)]">{job.name}</td>
                <td className="py-3 px-4">{getPriorityBadge(job.priority)}</td>
                <td className="py-3 px-4">{getStatusBadge(job.status)}</td>
                <td className="py-3 px-4 font-mono text-[var(--color-chronq-gray)]">
                  {job.worker_id || <span className="italic text-[11px] opacity-60">unassigned</span>}
                </td>
                <td className="py-3 px-4 text-[var(--color-chronq-gray)] whitespace-nowrap">
                  {new Date(job.created_at).toLocaleTimeString()}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    {job.status === 'failed' && (
                      <button
                        onClick={() => onRetry(job.id)}
                        className="px-2.5 py-1 bg-[var(--color-chronq-beige)] text-[var(--color-chronq-text)] text-[11px] font-semibold rounded hover:bg-[var(--color-chronq-warm)] hover:text-white transition-colors"
                      >
                        Retry
                      </button>
                    )}
                    {job.status === 'running' && onSimulateFailure && (
                      <button
                        onClick={() => onSimulateFailure(job.id)}
                        className="px-2 py-1 bg-transparent text-[var(--color-status-error)] border border-[var(--color-status-error)]/30 hover:bg-[var(--color-status-error-bg)] text-[10px] font-mono rounded transition-colors"
                      >
                        Simulate Fail
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="sm:hidden divide-y divide-[var(--color-chronq-beige)]">
        {jobs.map((job) => (
          <div key={job.id} className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-xs text-[var(--color-chronq-text)]">{job.id}</span>
              {getStatusBadge(job.status)}
            </div>
            <div className="text-sm font-medium text-[var(--color-chronq-text)]">{job.name}</div>
            <div className="flex items-center justify-between text-xs text-[var(--color-chronq-gray)]">
              <div>Priority: {getPriorityBadge(job.priority)}</div>
              <div>Worker: {job.worker_id || 'unassigned'}</div>
            </div>
            {job.status === 'failed' && (
              <button
                onClick={() => onRetry(job.id)}
                className="w-full mt-2 py-1.5 bg-[var(--color-chronq-beige)] text-center text-xs font-semibold rounded"
              >
                Retry Job
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};