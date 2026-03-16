/**
 * Ship Transit Layer
 *
 * Renders in-transit ships interpolated along their flight paths.
 * Position updates every frame via tick(). Chevrons rotate to
 * face the destination system. Hover highlights the flight path.
 */

import { Container, Graphics, Circle } from 'pixi.js';
import { onStateChange, getViewLevel, getSystemByNaturalId, getCxForSystem } from '@27bit/helm';
import { getSlotOffset, SYSTEM_GRID_CONFIG, BASE_SYSTEM_GRID_CONFIG, CX_SYSTEM_GRID_CONFIG } from './status-grid';
import { drawChevron } from './chevron';
import type { ShipInteractionCallbacks } from './ship-idle-markers';
import type { EmpireState } from '../empire-state';
import type { SystemResolvers } from '../empire-overlay';
import type { ShipSummary, FlightSummary } from '../types/bridge';

export interface CameraAccess {
  worldToScreen(worldX: number, worldY: number): { x: number; y: number };
  getScale(): number;
}

const SHIP_COLOUR = 0xff8c00;
const TRANSIT_ALPHA = 0.8;
const SYSTEM_VIEW_DIM_ALPHA = 0.05;
const CHEVRON_SIZE = 6;
const HIT_RADIUS = 12;
const HOVER_OUT_DEBOUNCE_MS = 100;

// Selection halo — matches Helm's planet selection style
const HALO_RADIUS = 10;
const HALO_COLOUR = 0x3399ff;
const HALO_ALPHA = 0.7;
const HALO_STROKE = 2.0;
const HALO_ARC_SPAN = Math.PI * 0.7;

/** Segment types where the ship actually moves between systems */
const TRAVEL_SEGMENT_TYPES = new Set(['TRANSIT', 'JUMP', 'JUMP_GATEWAY', 'FLOAT']);

/** Viewport scale below which transit markers fade out (full galaxy zoom) */
const FADE_OUT_SCALE = 0.2;
const FADE_IN_SCALE = 0.3;

/** Flight path highlight colours */
const PATH_COLOR = 0x4488ff;
const PATH_ALPHA = 0.6;
const PATH_CURRENT_ALPHA = 0.9;
const PATH_STROKE_WIDTH = 2.0;
const GATEWAY_ARC_FACTOR = 0.3;
const GATEWAY_ARC_MAX = 200;

/** Grid slot for ships arriving at / waiting at a system (column 1, row 2) */
const ARRIVING_SLOT = 2;
/** Grid slot for ships departing a system (column 2, row 0) */
const DEPARTING_SLOT = 3;

interface TransitEntry {
  ship: ShipSummary;
  flight: FlightSummary;
  graphic: Graphics;
}

export interface ShipTransitLayer {
  refresh(): void;
  tick(): void;
  getHoveredWorldPos(): { x: number; y: number } | null;
  getShipWorldPosition(shipId: string): { x: number; y: number } | null;
  setSelectedShip(shipId: string | null): void;
  destroy(): void;
  container: Container;
}

export function createShipTransitLayer(
  empireState: EmpireState,
  resolvers: SystemResolvers,
  camera: CameraAccess,
  callbacks: ShipInteractionCallbacks,
): ShipTransitLayer {
  const container = new Container();
  container.eventMode = 'passive';
  container.alpha = TRANSIT_ALPHA;

  let entries: TransitEntry[] = [];
  let hoveredEntry: TransitEntry | null = null;
  let hoverOutTimer: ReturnType<typeof setTimeout> | null = null;
  let selectedShipId: string | null = null;
  let selectionRing: Graphics | null = null;

  function clearSelectionRing(): void {
    if (selectionRing) {
      selectionRing.destroy();
      selectionRing = null;
    }
  }

  function applySelectionRing(): void {
    clearSelectionRing();
    if (!selectedShipId) return;

    for (const entry of entries) {
      if (entry.ship.shipId === selectedShipId) {
        selectionRing = new Graphics();
        selectionRing.arc(0, 0, HALO_RADIUS, -HALO_ARC_SPAN / 2, HALO_ARC_SPAN / 2);
        selectionRing.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });
        selectionRing.arc(0, 0, HALO_RADIUS, Math.PI - HALO_ARC_SPAN / 2, Math.PI + HALO_ARC_SPAN / 2);
        selectionRing.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });
        entry.graphic.addChild(selectionRing);
        break;
      }
    }
  }

  function setSelectedShip(shipId: string | null): void {
    selectedShipId = shipId;
    applySelectionRing();
  }

  const pathGraphics = new Graphics();
  container.addChild(pathGraphics);

  /** Returns the status grid config for a system (CX / base / plain). */
  function getGridConfig(systemNaturalId: string): typeof SYSTEM_GRID_CONFIG {
    const sys = getSystemByNaturalId(systemNaturalId);
    if (sys && getCxForSystem(sys.id)) return CX_SYSTEM_GRID_CONFIG;
    const ownedSystems = empireState.getOwnedSystemNaturalIds();
    if (ownedSystems.includes(systemNaturalId)) return BASE_SYSTEM_GRID_CONFIG;
    return SYSTEM_GRID_CONFIG;
  }

  /** Distance threshold for snapping to a grid slot — uses the grid's originOffsetX. */
  function getSnapThreshold(systemNaturalId: string): number {
    return getGridConfig(systemNaturalId).originOffsetX;
  }

  function drawFlightPath(flight: FlightSummary): void {
    pathGraphics.clear();

    for (let i = 0; i < flight.segments.length; i++) {
      const seg = flight.segments[i];
      if (!seg.originSystemNaturalId || !seg.destinationSystemNaturalId) continue;

      const origin = resolvers.resolveSystem(seg.originSystemNaturalId);
      const dest = resolvers.resolveSystem(seg.destinationSystemNaturalId);
      if (!origin || !dest) continue;

      const isCurrent = i === flight.currentSegmentIndex;
      const alpha = isCurrent ? PATH_CURRENT_ALPHA : PATH_ALPHA;

      if (seg.type === 'JUMP_GATEWAY') {
        const dx = dest.worldX - origin.worldX;
        const dy = dest.worldY - origin.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (origin.worldX + dest.worldX) / 2;
        const midY = (origin.worldY + dest.worldY) / 2 - Math.min(dist * GATEWAY_ARC_FACTOR, GATEWAY_ARC_MAX);

        pathGraphics.moveTo(origin.worldX, origin.worldY);
        pathGraphics.quadraticCurveTo(midX, midY, dest.worldX, dest.worldY);
        pathGraphics.stroke({ width: PATH_STROKE_WIDTH, color: PATH_COLOR, alpha });
      } else if (TRAVEL_SEGMENT_TYPES.has(seg.type)) {
        pathGraphics.moveTo(origin.worldX, origin.worldY);
        pathGraphics.lineTo(dest.worldX, dest.worldY);
        pathGraphics.stroke({ width: PATH_STROKE_WIDTH, color: PATH_COLOR, alpha });
      }
    }
  }

  function clearFlightPath(): void {
    pathGraphics.clear();
  }

  function handlePointerOver(entry: TransitEntry, globalX: number, globalY: number): void {
    if (hoverOutTimer !== null) {
      clearTimeout(hoverOutTimer);
      hoverOutTimer = null;
    }
    hoveredEntry = entry;
    drawFlightPath(entry.flight);
    callbacks.onHover([entry.ship], globalX, globalY);
  }

  function handlePointerOut(): void {
    if (hoverOutTimer !== null) clearTimeout(hoverOutTimer);
    hoverOutTimer = setTimeout(() => {
      hoverOutTimer = null;
      hoveredEntry = null;
      clearFlightPath();
      callbacks.onHoverEnd();
    }, HOVER_OUT_DEBOUNCE_MS);
  }

  function refresh(): void {
    // Preserve pathGraphics — remove only ship graphics
    for (const entry of entries) {
      entry.graphic.destroy({ children: true });
    }
    entries = [];
    hoveredEntry = null;
    clearFlightPath();

    for (const { ship, flight } of empireState.getInTransitShips()) {
      const graphic = new Graphics();
      graphic.eventMode = 'static';
      graphic.cursor = 'pointer';
      graphic.hitArea = new Circle(0, 0, HIT_RADIUS);
      drawChevron(graphic, CHEVRON_SIZE, SHIP_COLOUR);
      container.addChild(graphic);

      const entry: TransitEntry = { ship, flight, graphic };
      entries.push(entry);

      graphic.on('pointerover', (e) => {
        handlePointerOver(entry, e.global.x, e.global.y);
      });
      graphic.on('pointerout', () => {
        handlePointerOut();
      });
      graphic.on('pointertap', (e) => {
        // Clear hover state so tick() doesn't re-show the tooltip
        if (hoverOutTimer !== null) { clearTimeout(hoverOutTimer); hoverOutTimer = null; }
        hoveredEntry = null;
        clearFlightPath();
        callbacks.onClick([entry.ship], e.global.x, e.global.y);
      });
    }

    // Re-apply selection ring after rebuild
    selectionRing = null;
    applySelectionRing();

    tick();
  }

  function tick(): void {
    const now = Date.now();
    const scale = camera.getScale();

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

        // Ship has arrived — hide it, idle markers will pick it up on refresh
        if (t >= 1) {
          entry.graphic.visible = false;
          continue;
        }

        const ox = originPos.worldX, oy = originPos.worldY;
        const dstX = destPos.worldX, dstY = destPos.worldY;

        // Raw interpolation — no clamping
        let px: number, py: number;
        let tanX: number, tanY: number;

        if (seg.type === 'JUMP_GATEWAY') {
          const ddx = dstX - ox, ddy = dstY - oy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          const cpX = (ox + dstX) / 2;
          const cpY = (oy + dstY) / 2 - Math.min(dist * GATEWAY_ARC_FACTOR, GATEWAY_ARC_MAX);

          const mt = 1 - t;
          px = mt * mt * ox + 2 * mt * t * cpX + t * t * dstX;
          py = mt * mt * oy + 2 * mt * t * cpY + t * t * dstY;

          tanX = 2 * mt * (cpX - ox) + 2 * t * (dstX - cpX);
          tanY = 2 * mt * (cpY - oy) + 2 * t * (dstY - cpY);
        } else {
          const ddx = dstX - ox, ddy = dstY - oy;
          px = ox + ddx * t;
          py = oy + ddy * t;
          tanX = ddx;
          tanY = ddy;
        }

        // Snap to grid slot if near origin or destination system
        const destThreshold = seg.destinationSystemNaturalId
          ? getSnapThreshold(seg.destinationSystemNaturalId) : 0;
        const originThreshold = seg.originSystemNaturalId
          ? getSnapThreshold(seg.originSystemNaturalId) : 0;

        const distToDest = Math.sqrt((px - dstX) ** 2 + (py - dstY) ** 2);
        const distToOrigin = Math.sqrt((px - ox) ** 2 + (py - oy) ** 2);

        if (distToDest < destThreshold && seg.destinationSystemNaturalId) {
          // Near destination — snap to arriving slot, chevron points down
          const config = getGridConfig(seg.destinationSystemNaturalId);
          const offset = getSlotOffset(ARRIVING_SLOT, config);
          entry.graphic.x = dstX + offset.x;
          entry.graphic.y = dstY + offset.y;
          entry.graphic.rotation = Math.PI;
        } else if (distToOrigin < originThreshold && seg.originSystemNaturalId) {
          // Near origin — snap to departing slot, chevron points up
          const config = getGridConfig(seg.originSystemNaturalId);
          const offset = getSlotOffset(DEPARTING_SLOT, config);
          entry.graphic.x = ox + offset.x;
          entry.graphic.y = oy + offset.y;
          entry.graphic.rotation = 0;
        } else {
          // Open space — interpolated position, face travel direction
          entry.graphic.x = px;
          entry.graphic.y = py;
          entry.graphic.rotation = Math.atan2(tanY, tanX) + Math.PI / 2;
        }
        entry.graphic.visible = true;
      } else {
        // Non-travel segment (charging, loading, etc.) — snap to arriving slot
        const systemId = seg.originSystemNaturalId ?? entry.flight.originSystemNaturalId;
        const pos = systemId ? resolvers.resolveSystem(systemId) : null;
        if (!pos || !systemId) {
          entry.graphic.visible = false;
          continue;
        }

        const config = getGridConfig(systemId);
        const offset = getSlotOffset(ARRIVING_SLOT, config);
        entry.graphic.x = pos.worldX + offset.x;
        entry.graphic.y = pos.worldY + offset.y;
        entry.graphic.rotation = Math.PI;
        entry.graphic.visible = true;
      }
    }

    // Update tooltip position for hovered transit ship (ship moves each frame)
    if (hoveredEntry && hoveredEntry.graphic.visible) {
      const worldPos = hoveredEntry.graphic.position;
      const screen = camera.worldToScreen(worldPos.x, worldPos.y);
      callbacks.onHover([hoveredEntry.ship], screen.x, screen.y);
    }
  }

  function getHoveredWorldPos(): { x: number; y: number } | null {
    if (!hoveredEntry || !hoveredEntry.graphic.visible) return null;
    return { x: hoveredEntry.graphic.x, y: hoveredEntry.graphic.y };
  }

  function getShipWorldPosition(shipId: string): { x: number; y: number } | null {
    for (const entry of entries) {
      if (entry.ship.shipId === shipId && entry.graphic.visible) {
        return { x: entry.graphic.x, y: entry.graphic.y };
      }
    }
    return null;
  }

  onStateChange(() => {
    if (getViewLevel() === 'system') {
      container.alpha = SYSTEM_VIEW_DIM_ALPHA;
    } else {
      container.alpha = TRANSIT_ALPHA;
    }
  });

  return { refresh, tick, getHoveredWorldPos, getShipWorldPosition, setSelectedShip, destroy: () => container.destroy({ children: true }), container };
}
