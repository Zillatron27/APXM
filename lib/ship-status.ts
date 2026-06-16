/**
 * Ship status display vocabulary.
 *
 * Lifted verbatim from Helm (`src/data/shipStatus.ts`) so APXM and Helm read
 * ship state identically. Helm in turn mirrors Refined PrUn's FLT "Status"
 * column: when a ship is flying we show its current flight-segment phase; when
 * it's parked we show "Stationary".
 *
 * Source of truth for the icon mapping (do not improvise these glyphs):
 *   rPrun-reference/refined-prun-main/src/features/advanced/flt-flight-status-icons.ts
 * Source of truth for the SegmentType enum: `PrunApi.SegmentType` (types/prun-api.ts).
 */

export interface ShipDisplayStatus {
  /** Human-readable phase label, e.g. "In transit". */
  label: string;
  /** Single glyph mirroring Refined PrUn's FLT status icons. */
  icon: string;
}

/** Parked / not in flight — PrUn's "stationary" state (rPrun: ⦁). */
export const STATIONARY: ShipDisplayStatus = { label: 'Stationary', icon: '⦁' };

// PrUn SegmentType → { label, icon }. Icons are rPrun's verbatim; labels are
// the natural-English rendering of each phase.
const SEGMENT_STATUS: Record<string, ShipDisplayStatus> = {
  TAKE_OFF: { label: 'Take off', icon: '↑' },
  DEPARTURE: { label: 'Departure', icon: '↗' },
  TRANSIT: { label: 'In transit', icon: '⟶' },
  CHARGE: { label: 'Charging', icon: '±' },
  JUMP: { label: 'Jump', icon: '➾' },
  FLOAT: { label: 'Float', icon: '↑' },
  APPROACH: { label: 'Approach', icon: '↘' },
  LANDING: { label: 'Landing', icon: '↓' },
  LOCK: { label: 'Lock', icon: '⟴' },
  DECAY: { label: 'Decay', icon: '⟴' },
  JUMP_GATEWAY: { label: 'Gateway jump', icon: '⟴' },
};

/**
 * Map a raw flight-segment type to its display status. Unknown codes (a future
 * SegmentType we haven't enumerated) fall back to a title-cased label with no
 * icon rather than rendering the raw enum — discoverable, not silently wrong.
 */
export function segmentStatus(type: string): ShipDisplayStatus {
  const known = SEGMENT_STATUS[type];
  if (known) return known;
  const label = type
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
  return { label: label || 'Unknown', icon: '' };
}
