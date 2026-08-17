import React, { useState } from 'react';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (jobData: { name: string; priority: string; payload?: any; max_retries?: number }) => Promise<void>;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('medium');
  const [payloadStr, setPayloadStr] = useState('{\n  "task": "process_telemetry"\n}');
  const [maxRetries, setMaxRetries] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let parsedPayload = null;
      if (payloadStr.trim()) {
        parsedPayload = JSON.parse(payloadStr);
      }
      await onSubmit({ name, priority, payload: parsedPayload, max_retries: maxRetries });
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid job configuration or JSON payload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-chronq-espresso)]/60 backdrop-blur-xs p-4">
      <div className="bg-[var(--color-chronq-cream)] border border-[var(--color-chronq-beige)] rounded-md max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-chronq-beige)] pb-3">
          <h3 className="font-bold text-base text-[var(--color-chronq-text)]">Dispatch New Queue Job</h3>
          <button onClick={onClose} className="text-[var(--color-chronq-gray)] hover:text-[var(--color-chronq-text)] text-sm">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-[var(--color-status-error-bg)] text-[var(--color-status-error)] text-xs rounded border border-[var(--color-status-error)]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[var(--color-chronq-text)] mb-1">Job Name / Identifier</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. sync_database_records"
              className="w-full px-3 py-2 border border-[var(--color-chronq-beige)] rounded bg-white font-mono focus:outline-none focus:border-[var(--color-chronq-warm)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--color-chronq-text)] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-chronq-beige)] rounded bg-white font-mono focus:outline-none focus:border-[var(--color-chronq-warm)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[var(--color-chronq-text)] mb-1">Max Retries</label>
              <input
                type="number"
                min="0"
                max="10"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-[var(--color-chronq-beige)] rounded bg-white font-mono focus:outline-none focus:border-[var(--color-chronq-warm)]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--color-chronq-text)] mb-1">JSON Payload</label>
            <textarea
              rows={4}
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-chronq-beige)] rounded bg-white font-mono text-[11px] focus:outline-none focus:border-[var(--color-chronq-warm)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[var(--color-chronq-beige)] rounded text-[var(--color-chronq-gray)] hover:bg-[var(--color-chronq-light-beige)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[var(--color-chronq-espresso)] text-white rounded font-semibold hover:bg-[var(--color-chronq-deep)] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};