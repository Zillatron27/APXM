import { formatEta } from '../../lib/fleet-utils';
import { useGameState } from '../../stores/gameState';
import type { ShipDetail } from '../views/hooks';

interface ShipRowProps {
  ship: ShipDetail;
}

/**
 * Dense fleet row, mirroring the base-card density: ship name + route on the
 * left, current flight phase (glyph + label) + ETA on the right, ledger-aligned.
 * The whole row drills into the ship detail sheet (same flyover primitive as
 * the base status tiles). Light press feedback only — the keycap bevel is
 * reserved for discrete tiles/buttons, not full-width list rows.
 */
export function ShipRow({ ship }: ShipRowProps) {
  const setDetailView = useGameState((s) => s.setDetailView);

  const route = ship.stationary
    ? ship.location
    : `${ship.location} → ${ship.destination}`;

  return (
    <button
      onClick={() => setDetailView({ type: 'ship', shipId: ship.id, shipName: ship.name })}
      aria-label={`${ship.name} — ${ship.phase.label}. Open detail.`}
      className="w-full min-h-touch flex items-center justify-between gap-2 px-3 py-2 text-left bg-apxm-surface border border-apxm-accent hover:bg-apxm-accent/30 active:bg-apxm-accent/50 transition-colors motion-reduce:transition-none"
    >
      {/* Identity + route */}
      <div className="min-w-0">
        <span className="font-semibold text-apxm-text truncate block">{ship.name}</span>
        <span className="text-xs text-apxm-muted truncate block">{route}</span>
      </div>

      {/* Phase + ETA — fixed-width right column (ledger alignment) */}
      <div className="shrink-0 text-right">
        <span className="flex items-center justify-end gap-1 text-xs text-apxm-text/70">
          <span aria-hidden className="text-apxm-text">{ship.phase.icon}</span>
          {ship.phase.label}
        </span>
        {ship.etaMs !== null && (
          <span className="block text-xs font-mono text-apxm-text/70 mt-0.5">
            {formatEta(ship.etaMs)}
          </span>
        )}
      </div>
    </button>
  );
}
