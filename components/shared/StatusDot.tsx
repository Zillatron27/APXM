import type { ConnectionStatus } from '../../hooks/useConnectionStatus';

interface StatusDotProps {
  status: ConnectionStatus;
}

const statusConfig: Record<ConnectionStatus, { color: string; pulse: boolean; label: string }> = {
  live: { color: 'bg-status-ok', pulse: false, label: 'Live' },
  fio: { color: 'bg-status-warning', pulse: false, label: 'FIO' },
  connecting: { color: 'bg-status-critical', pulse: true, label: 'Connecting' },
};

export function StatusDot({ status }: StatusDotProps) {
  const { color, pulse, label } = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 ${color} ${pulse ? 'animate-pulse' : ''}`}
        aria-label={label}
      />
      <span className="text-xs text-apxm-muted">{label}</span>
    </div>
  );
}
