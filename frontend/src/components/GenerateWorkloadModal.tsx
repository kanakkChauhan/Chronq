import React, { useState } from 'react';
import type { BatchWorkloadConfig } from '../types/chronq';
import { IconActivity } from './Icons';

interface GenerateWorkloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: BatchWorkloadConfig) => Promise<void>;
}

export const GenerateWorkloadModal: React.FC<GenerateWorkloadModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [count, setCount] = useState<number>(10);
  const [priority, setPriority] = useState<BatchWorkloadConfig['priority']>('mixed');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);

    try {
      await onGenerate({ count, priority, name_prefix: 'demo-task' });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate demo workload.');
    } finally {
      setIsGenerating(false);
    }
  };

  const countOptions = [5, 10, 25];
  const priorityOptions: Array<{ id: BatchWorkloadConfig['priority']; label: string }> = [
    { id: 'mixed', label: 'Mixed' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-chronq-espresso)]/60 backdrop-blur-xs p-4">
      <div className="bg-[var(--color-chronq-cream)] border border-[var(--color-chronq-beige)] rounded-md max-w-sm w-full p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-chronq-beige)] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[var(--color-chronq-light-beige)] rounded text-[var(--color-chronq-medium)]">
              <IconActivity className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[var(--color-chronq-text)]">Generate Demo Workload</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-chronq-gray)] hover:text-[var(--color-chronq-text)] text-xs"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-[var(--color-status-error-bg)] text-[var(--color-status-error)] text-[11px] rounded border border-[var(--color-status-error)]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Job Count Selection */}
          <div>
            <label className="block font-semibold text-[var(--color-chronq-text)] mb-1.5">
              Number of Jobs
            </label>
            <div className="grid grid-cols-3 gap-2">
              {countOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`py-1.5 font-mono font-medium rounded border transition-colors ${
                    count === c
                      ? 'bg-[var(--color-chronq-espresso)] text-[#FAF7F1] border-[var(--color-chronq-espresso)]'
                      : 'bg-white text-[var(--color-chronq-text)] border-[var(--color-chronq-beige)] hover:bg-[var(--color-chronq-light-beige)]'
                  }`}
                >
                  {c} Jobs
                </button>
              ))}
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block font-semibold text-[var(--color-chronq-text)] mb-1.5">
              Job Priority
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {priorityOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={`py-1.5 px-2 text-[11px] font-mono rounded border text-center transition-colors ${
                    priority === p.id
                      ? 'bg-[var(--color-chronq-deep)] text-[#FAF7F1] border-[var(--color-chronq-deep)] font-semibold'
                      : 'bg-white text-[var(--color-chronq-text)] border-[var(--color-chronq-beige)] hover:bg-[var(--color-chronq-light-beige)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded p-2.5 text-[11px] text-[var(--color-chronq-gray)] font-mono">
            Output: <span className="text-[var(--color-chronq-text)] font-semibold">demo-task-01</span> →{' '}
            <span className="text-[var(--color-chronq-text)] font-semibold">demo-task-{count.toString().padStart(2, '0')}</span>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[var(--color-chronq-beige)] rounded text-[var(--color-chronq-text)] hover:bg-[var(--color-chronq-light-beige)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-3.5 py-1.5 bg-[var(--color-chronq-espresso)] text-[#FAF7F1] rounded font-semibold hover:bg-[var(--color-chronq-deep)] transition-colors disabled:opacity-50"
            >
              {isGenerating ? 'Enqueuing...' : 'Generate Workload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};