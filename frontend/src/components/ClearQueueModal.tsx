import React from 'react';
import { IconAlertTriangle } from './Icons';

interface ClearQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  queuedCount: number;
  isClearing: boolean;
}

export const ClearQueueModal: React.FC<ClearQueueModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  queuedCount,
  isClearing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-chronq-espresso)]/60 backdrop-blur-xs p-4">
      <div className="bg-[var(--color-chronq-cream)] border border-[var(--color-chronq-beige)] rounded-md max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-[var(--color-status-error)]">
          <div className="p-2 bg-[var(--color-status-error-bg)] rounded-md">
            <IconAlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-[var(--color-chronq-text)]">
            Clear all queued jobs?
          </h3>
        </div>

        <p className="text-xs text-[var(--color-chronq-gray)] leading-relaxed">
          This will remove <strong className="text-[var(--color-chronq-text)]">{queuedCount}</strong> pending{' '}
          {queuedCount === 1 ? 'job' : 'jobs'} currently waiting in the queue.
        </p>

        <div className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded p-3 text-[11px] text-[var(--color-chronq-gray)] space-y-1">
          <p className="font-semibold text-[var(--color-chronq-text)]">Safety Guarantee:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Currently running jobs will not be interrupted.</li>
            <li>Completed and failed job history remains intact.</li>
            <li>Worker fleet registrations will not be altered.</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={isClearing}
            onClick={onClose}
            className="px-4 py-2 border border-[var(--color-chronq-beige)] rounded text-xs font-semibold text-[var(--color-chronq-text)] hover:bg-[var(--color-chronq-light-beige)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isClearing}
            onClick={onConfirm}
            className="px-4 py-2 bg-[var(--color-status-error)] text-[var(--color-chronq-cream)] rounded text-xs font-semibold hover:bg-[#863329] transition-colors disabled:opacity-50"
          >
            {isClearing ? 'Clearing Queue...' : 'Clear Queue'}
          </button>
        </div>
      </div>
    </div>
  );
};