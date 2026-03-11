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
 *   2 = Reserved
 *   3-5 = Reserved (second column, used when first is full)
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
  cellSize: 12,
  gapX: 2,
  gapY: 2,
  originOffsetX: 24,
  originOffsetY: -12,
  columns: 2,
  rows: 3,
};

/** Galaxy-view grid for base systems (no CX) — offset to clear base rings (edge ~20px) */
export const BASE_SYSTEM_GRID_CONFIG: StatusGridConfig = {
  cellSize: 12,
  gapX: 2,
  gapY: 2,
  originOffsetX: 29,
  originOffsetY: -12,
  columns: 2,
  rows: 3,
};

/** Galaxy-view grid for CX systems — clears CX diamonds */
export const CX_SYSTEM_GRID_CONFIG: StatusGridConfig = {
  cellSize: 12,
  gapX: 2,
  gapY: 2,
  originOffsetX: 49,
  originOffsetY: -12,
  columns: 2,
  rows: 3,
};

/** System-view grid — tuned for planet display sizes */
export const PLANET_GRID_CONFIG: StatusGridConfig = {
  cellSize: 16,
  gapX: 3,
  gapY: 3,
  originOffsetX: 20,
  originOffsetY: -20,
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
