import type { ReactNode } from 'react';

export type TileTone = 'critical' | 'warning' | 'ok' | 'muted';

const toneClasses: Record<TileTone, string> = {
  critical: 'bg-status-critical/15 text-status-critical',
  warning: 'bg-status-warning/15 text-status-warning',
  ok: 'bg-status-ok/15 text-status-ok',
  muted: 'bg-apxm-bg text-apxm-muted',
};

/**
 * Compact labelled status tile for base card headers (BURN / REPAIR / PROD).
 * Layout inspired by jackinabox86's APXM fork (https://github.com/jackinabox86/APXM).
 */
export function BaseStatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: TileTone;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-1.5 py-1 min-w-[3.25rem] ${toneClasses[tone]}`}
    >
      <span className="text-[9px] uppercase tracking-wide opacity-80">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}
