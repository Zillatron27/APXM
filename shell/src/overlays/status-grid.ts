/**
 * Status Grid Positioning System
 *
 * 2×3 grid positioned top-right of a star or planet centre.
 * Each overlay type claims a slot index; getSlotOffset() returns
 * the world-space offset from the element centre for that slot.
 *
 * Layout (column-major — fills down first column, then second):
 *        ┌───┬───┐
 *        │ 0 │ 3 │
 *   ★    ├───┼───┤
 *        │ 1 │ 4 │
 *        ├───┼───┤
 *        │ 2 │ 5 │
 *        └───┘───┘
 *
 * Slot assignments:
 *   0 = Gateway indicators
 *   1 = Ship presence (idle)
 *   2 = Ship arriving (transit, pointing down)
 *   3 = Ship departing (transit, pointing up)
 *   4-5 = Reserved
 */

export interface StatusGridConfig {
  cellSize: number;
  gapX: number;
  gapY: number;
  originOffsetX: number;
  originOffsetY: number;
  columns: number;
  rows: number;
}

/** Galaxy-view grid for plain systems (no base, no CX) */
export const SYSTEM_GRID_CONFIG: StatusGridConfig = {
  cellSize: 18,
  gapX: 4,
  gapY: 4,
  originOffsetX: 24,
  originOffsetY: -18,
  columns: 2,
  rows: 3,
};

/** Galaxy-view grid for base systems (no CX) — offset to clear base rings (edge ~20px) */
export const BASE_SYSTEM_GRID_CONFIG: StatusGridConfig = {
  cellSize: 18,
  gapX: 4,
  gapY: 4,
  originOffsetX: 29,
  originOffsetY: -18,
  columns: 2,
  rows: 3,
};

/** Galaxy-view grid for CX systems — clears CX diamonds */
export const CX_SYSTEM_GRID_CONFIG: StatusGridConfig = {
  cellSize: 18,
  gapX: 4,
  gapY: 4,
  originOffsetX: 49,
  originOffsetY: -18,
  columns: 2,
  rows: 3,
};

/** System-view grid — tuned for planet display sizes */
export const PLANET_GRID_CONFIG: StatusGridConfig = {
  cellSize: 22,
  gapX: 4,
  gapY: 4,
  originOffsetX: 28,
  originOffsetY: -24,
  columns: 2,
  rows: 3,
};

/** System-view grid for owned planets — clears burn ring + Helm planet hit area */
export const OWNED_PLANET_GRID_CONFIG: StatusGridConfig = {
  cellSize: 22,
  gapX: 4,
  gapY: 4,
  originOffsetX: 40,
  originOffsetY: -24,
  columns: 2,
  rows: 3,
};

/** Returns world-space offset from element centre for a given slot index (column-major). */
export function getSlotOffset(
  slot: number,
  config: StatusGridConfig,
): { x: number; y: number } {
  const col = Math.floor(slot / config.rows);
  const row = slot % config.rows;

  return {
    x: config.originOffsetX + col * (config.cellSize + config.gapX),
    y: config.originOffsetY + row * (config.cellSize + config.gapY),
  };
}
