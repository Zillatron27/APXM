/**
 * Shared chevron drawing helper for ship markers.
 */

import type { Graphics } from 'pixi.js';

/** Draws an open chevron (V shape) centred at the graphic's origin. */
export function drawChevron(g: Graphics, size: number, colour: number): void {
  g.moveTo(-size, size * 0.6);
  g.lineTo(0, -size * 0.6);
  g.lineTo(size, size * 0.6);
  g.stroke({ width: 2.5, color: colour });
}
