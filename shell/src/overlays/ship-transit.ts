/**
 * Ship Transit Layer
 *
 * Renders in-transit ships interpolated along their flight paths.
 * Position updates every frame via tick(). Chevrons rotate to
 * face the destination system.
 */

import { Container, Graphics } from 'pixi.js';
import { onStateChange, getViewLevel } from '@27bit/helm';
import { drawChevron } from './chevron';
import type { EmpireState } from '../empire-state';
import type { SystemResolvers } from '../empire-overlay';
import type { ShipSummary, FlightSummary } from '../types/bridge';
import type { Viewport } from 'pixi-viewport';

const SHIP_COLOUR = 0xff8c00;
const TRANSIT_ALPHA = 0.8;
const SYSTEM_VIEW_DIM_ALPHA = 0.05;
const CHEVRON_SIZE = 5;

/** Segment types where the ship actually moves between systems */
const TRAVEL_SEGMENT_TYPES = new Set(['TRANSIT', 'JUMP', 'JUMP_GATEWAY', 'FLOAT']);

/** Viewport scale below which transit markers fade out (full galaxy zoom) */
const FADE_OUT_SCALE = 0.2;
const FADE_IN_SCALE = 0.3;

interface TransitEntry {
  ship: ShipSummary;
  flight: FlightSummary;
  graphic: Graphics;
}

export interface ShipTransitLayer {
  refresh(): void;
  tick(): void;
  destroy(): void;
  container: Container;
}

export function createShipTransitLayer(
  empireState: EmpireState,
  resolvers: SystemResolvers,
  viewport: Viewport,
): ShipTransitLayer {
  const container = new Container();
  container.eventMode = 'none';
  container.alpha = TRANSIT_ALPHA;

  let entries: TransitEntry[] = [];

  function refresh(): void {
    container.removeChildren();
    entries = [];

    for (const { ship, flight } of empireState.getInTransitShips()) {
      const graphic = new Graphics();
      graphic.eventMode = 'none';
      drawChevron(graphic, CHEVRON_SIZE, SHIP_COLOUR);
      container.addChild(graphic);
      entries.push({ ship, flight, graphic });
    }

    tick();
  }

  function tick(): void {
    const now = Date.now();
    const scale = viewport.scale.x;

    // Fade at full galaxy zoom
    if (scale < FADE_OUT_SCALE) {
      container.visible = false;
      return;
    }
    container.visible = true;
    if (scale < FADE_IN_SCALE) {
      container.alpha = ((scale - FADE_OUT_SCALE) / (FADE_IN_SCALE - FADE_OUT_SCALE)) * TRANSIT_ALPHA;
    } else {
      container.alpha = TRANSIT_ALPHA;
    }

    // Apply system-view dimming on top of zoom fade
    if (getViewLevel() === 'system') {
      container.alpha = SYSTEM_VIEW_DIM_ALPHA;
    }

    for (const entry of entries) {
      const seg = entry.flight.segments[entry.flight.currentSegmentIndex];
      if (!seg) {
        entry.graphic.visible = false;
        continue;
      }

      if (TRAVEL_SEGMENT_TYPES.has(seg.type)) {
        const originPos = seg.originSystemNaturalId
          ? resolvers.resolveSystem(seg.originSystemNaturalId)
          : null;
        const destPos = seg.destinationSystemNaturalId
          ? resolvers.resolveSystem(seg.destinationSystemNaturalId)
          : null;

        if (!originPos || !destPos) {
          entry.graphic.visible = false;
          continue;
        }

        const duration = seg.arrivalTimestamp - seg.departureTimestamp;
        const t = duration > 0
          ? Math.max(0, Math.min(1, (now - seg.departureTimestamp) / duration))
          : 1;

        entry.graphic.x = originPos.worldX + (destPos.worldX - originPos.worldX) * t;
        entry.graphic.y = originPos.worldY + (destPos.worldY - originPos.worldY) * t;

        const dx = destPos.worldX - originPos.worldX;
        const dy = destPos.worldY - originPos.worldY;
        // Chevron points up by default (-Y), rotate to face destination
        entry.graphic.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        entry.graphic.visible = true;
      } else {
        // Non-travel segment: park at the segment's origin system
        const systemId = seg.originSystemNaturalId ?? entry.flight.originSystemNaturalId;
        const pos = systemId ? resolvers.resolveSystem(systemId) : null;
        if (!pos) {
          entry.graphic.visible = false;
          continue;
        }
        entry.graphic.x = pos.worldX;
        entry.graphic.y = pos.worldY;
        entry.graphic.rotation = 0;
        entry.graphic.visible = true;
      }
    }
  }

  onStateChange(() => {
    if (getViewLevel() === 'system') {
      container.alpha = SYSTEM_VIEW_DIM_ALPHA;
    } else {
      container.alpha = TRANSIT_ALPHA;
    }
  });

  return { refresh, tick, destroy: () => container.destroy({ children: true }), container };
}
