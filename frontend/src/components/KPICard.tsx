import React from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  statusIndicator?: 'success' | 'warning' | 'error' | 'neutral';
  icon?: React.ReactNode;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  subValue,
  statusIndicator = 'neutral',
  icon,
}) => {
  const getStatusColor = () => {
    switch (statusIndicator) {
      case 'success':
        return 'text-[var(--color-status-success)]';
      case 'warning':
        return 'text-[var(--color-status-warning)]';
      case 'error':
        return 'text-[var(--color-status-error)]';
      default:
        return 'text-[var(--color-chronq-warm)]';
    }
  };

  return (
    <div className="bg-[var(--color-chronq-light-beige)] border border-[var(--color-chronq-beige)] rounded-md p-5 flex flex-col justify-between shadow-xs transition-colors">
      <div className="flex items-center justify-between text-[var(--color-chronq-gray)] mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
        {icon && <span className={getStatusColor()}>{icon}</span>}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--color-chronq-text)] tracking-tight">
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-[var(--color-chronq-gray)] mt-1.5 font-medium flex items-center gap-1.5">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};