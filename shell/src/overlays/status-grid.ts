/**
 * Status Grid Positioning System
 *
 * 2×3 grid positioned top-right of a star or planet centre.
 * Each overlay type claims a slot index; getSlotOffset() returns
 * the world-space offset from the element centre for that slot.
 *
 * Layout:
 *        ┌───┬───┐
 *        │ 0 │ 1 │
 *   ★    ├───┼───┤
 *        │ 2 │ 3 │
 *        ├───┼───┤
 *        │ 4 │ 5 │
 *        └───┘───┘
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

/** Returns world-space offset from element centre for a given slot index. */
export function getSlotOffset(
  slot: number,
  config: StatusGridConfig,
): { x: number; y: number } {
  const col = slot % config.columns;
  const row = Math.floor(slot / config.columns);
  const step = config.cellSize + config.gapX;

  return {
    x: config.originOffsetX + col * step,
    y: config.originOffsetY + row * (config.cellSize + config.gapY),
  };
}