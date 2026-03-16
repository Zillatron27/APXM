/**
 * Ship System View Layer
 *
 * Renders ships at their actual positions within a focused system:
 * docked at planets, at the system edge (arriving/departing),
 * or in STL transit between planets. Visible only in system view.
 */

import { Container, Graphics, Circle } from 'pixi.js';
import { onStateChange, getViewLevel, getFocusedSystemId } from '@27bit/helm';
import {
  getSlotOffset,
  PLANET_GRID_CONFIG,
  OWNED_PLANET_GRID_CONFIG,
} from './status-grid';
import { drawChevron } from './chevron';
import type { ShipInteractionCallbacks } from './ship-idle-markers';
import type { EmpireState } from '../empire-state';
import type { SystemResolvers, PlanetInfo } from '../empire-overlay';
import type { ShipSummary, FlightSummary, FlightSegmentSummary } from '../types/bridge';

const SHIP_COLOUR = 0xff8c00;
const SYSTEM_VIEW_ALPHA = 0.85;
const SYSTEM_CHEVRON_SIZE = 4.7;
const HIT_RADIUS = 15.5;
const STACK_OFFSET_Y = -3;
const EDGE_PADDING = 30;
const SHIP_SLOT = 1;
const SHIP_SLOT_NUDGE_Y = 3;

// Selection halo — matches Helm's planet selection style
const HALO_RADIUS = 10;
const HALO_COLOUR = 0x3399ff;
const HALO_ALPHA = 0.7;
const HALO_STROKE = 2.0;
const HALO_ARC_SPAN = Math.PI * 0.7;

/** Central star fallback: below star name, laid out horizontally */
const STAR_OFFSET_Y = 80;
const STAR_SHIP_GAP_X = 16;

/** Segment types where the ship actually moves between systems */
const TRAVEL_SEGMENT_TYPES = new Set(['TRANSIT', 'JUMP', 'JUMP_GATEWAY', 'FLOAT']);

/** Flight path line style */
const PATH_COLOUR = 0xff8c00;
const PATH_ALPHA = 0.3;
const PATH_STROKE_WIDTH = 1.5;

interface SystemShipEntry {
  ships: ShipSummary[];
  flight?: FlightSummary;
  graphic: Container;
}

interface StlEntry {
  ship: ShipSummary;
  flight: FlightSummary;
  segment: FlightSegmentSummary;
  graphic: Graphics;
  originPos: { x: number; y: number };
  destPos: { x: number; y: number };
}

export interface ShipSystemViewLayer {
  refresh(): void;
  tick(): void;
  setSelectedShip(shipId: string | null): void;
  destroy(): void;
  container: Container;
}

export function createShipSystemView(
  empireState: EmpireState,
  resolvers: SystemResolvers,
  callbacks: ShipInteractionCallbacks,
): ShipSystemViewLayer {
  const container = new Container();
  container.eventMode = 'passive';
  container.alpha = 0;
  container.visible = false;

  let entries: SystemShipEntry[] = [];
  let stlEntries: StlEntry[] = [];
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  let selectedShipId: string | null = null;
  let selectionRing: Graphics | null = null;
  const pathGraphics = new Graphics();
  pathGraphics.eventMode = 'none';
  container.addChild(pathGraphics);

  function clearSelectionRing(): void {
    if (selectionRing) {
      selectionRing.destroy();
      selectionRing = null;
    }
  }

  function drawSelectionRing(parent: Container): void {
    selectionRing = new Graphics();
    selectionRing.arc(0, 0, HALO_RADIUS, -HALO_ARC_SPAN / 2, HALO_ARC_SPAN / 2);
    selectionRing.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });
    selectionRing.arc(0, 0, HALO_RADIUS, Math.PI - HALO_ARC_SPAN / 2, Math.PI + HALO_ARC_SPAN / 2);
    selectionRing.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });
    parent.addChild(selectionRing);
  }

  function applySelectionRing(): void {
    clearSelectionRing();
    if (!selectedShipId) return;

    // Check docked / edge ship entries
    for (const entry of entries) {
      if (entry.ships.some(s => s.shipId === selectedShipId)) {
        // Attach to the chevron Graphics (first child of the group container)
        const chevron = entry.graphic.getChildAt(0) as Graphics;
        drawSelectionRing(chevron);
        return;
      }
    }

    // Check STL transit entries
    for (const entry of stlEntries) {
      if (entry.ship.shipId === selectedShipId) {
        drawSelectionRing(entry.graphic);
        return;
      }
    }
  }

  function setSelectedShip(shipId: string | null): void {
    selectedShipId = shipId;
    applySelectionRing();
  }

  function clearRetry(): void {
    if (retryTimer !== null) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  function clear(): void {
    // Remove ship markers but keep pathGraphics
    for (const entry of entries) entry.graphic.destroy({ children: true });
    for (const entry of stlEntries) entry.graphic.destroy({ children: true });
    pathGraphics.clear();
    entries = [];
    stlEntries = [];
  }

  /** Build planet position lookup for the focused system. */
  function buildPlanetPositions(
    systemPos: { worldX: number; worldY: number },
    planets: PlanetInfo[],
  ): Map<string, { x: number; y: number }> {
    const map = new Map<string, { x: number; y: number }>();
    for (const planet of planets) {
      const angle = (planet.orbitIndex / planet.totalPlanets) * Math.PI * 2 - Math.PI / 2;
      map.set(planet.naturalId, {
        x: systemPos.worldX + Math.cos(angle) * planet.ringRadius,
        y: systemPos.worldY + Math.sin(angle) * planet.ringRadius,
      });
    }
    return map;
  }

  /** Get the grid config for a planet — owned planets need wider offset for burn ring. */
  function getPlanetGridConfig(planetNaturalId: string): typeof PLANET_GRID_CONFIG {
    return empireState.getSiteForPlanet(planetNaturalId)
      ? OWNED_PLANET_GRID_CONFIG
      : PLANET_GRID_CONFIG;
  }

  /** Create a ship marker group. Stack chevrons only for docked ships (status grid), not transit. */
  function createShipMarker(
    ships: ShipSummary[],
    options?: { flight?: FlightSummary; stack?: boolean },
  ): Container {
    const group = new Container();
    group.eventMode = 'static';
    group.cursor = 'pointer';

    const chevron = new Graphics();
    chevron.hitArea = new Circle(0, 0, HIT_RADIUS);
    chevron.eventMode = 'static';
    drawChevron(chevron, SYSTEM_CHEVRON_SIZE, SHIP_COLOUR);
    if (ships.length >= 2 && options?.stack !== false) {
      const stacked = new Graphics();
      stacked.y = STACK_OFFSET_Y;
      drawChevron(stacked, SYSTEM_CHEVRON_SIZE, SHIP_COLOUR);
      chevron.addChild(stacked);
    }
    group.addChild(chevron);

    const entry: SystemShipEntry = { ships, flight: options?.flight, graphic: group };
    entries.push(entry);

    chevron.on('pointerover', (e) => {
      callbacks.onHover(entry.ships, e.global.x, e.global.y);
    });
    chevron.on('pointerout', () => {
      callbacks.onHoverEnd();
    });
    chevron.on('pointertap', (e) => {
      callbacks.onHoverEnd();
      callbacks.onClick(entry.ships, e.global.x, e.global.y);
    });

    return group;
  }

  /** Create a single transit chevron for STL ships. */
  function createStlMarker(ship: ShipSummary): Graphics {
    const graphic = new Graphics();
    graphic.eventMode = 'static';
    graphic.cursor = 'pointer';
    graphic.hitArea = new Circle(0, 0, HIT_RADIUS);
    drawChevron(graphic, SYSTEM_CHEVRON_SIZE, SHIP_COLOUR);

    graphic.on('pointerover', (e) => {
      callbacks.onHover([ship], e.global.x, e.global.y);
    });
    graphic.on('pointerout', () => {
      callbacks.onHoverEnd();
    });
    graphic.on('pointertap', (e) => {
      callbacks.onHoverEnd();
      callbacks.onClick([ship], e.global.x, e.global.y);
    });

    return graphic;
  }

  function refresh(): void {
    clear();
    clearRetry();

    if (getViewLevel() !== 'system') {
      container.visible = false;
      container.alpha = 0;
      return;
    }

    const focusedUuid = getFocusedSystemId();
    if (!focusedUuid) return;

    const systemNaturalId = resolvers.resolveNaturalId(focusedUuid);
    if (!systemNaturalId) return;

    const systemPos = resolvers.resolveSystem(systemNaturalId);
    if (!systemPos) return;

    const planets = resolvers.resolvePlanets(systemNaturalId);
    if (!planets) {
      // Retry until planet data loads
      retryTimer = setInterval(() => {
        if (getViewLevel() !== 'system' || getFocusedSystemId() !== focusedUuid) {
          clearRetry();
          return;
        }
        if (resolvers.resolvePlanets(systemNaturalId)) {
          clearRetry();
          refresh();
        }
      }, 200);
      return;
    }

    container.visible = true;
    container.alpha = SYSTEM_VIEW_ALPHA;

    const planetPositions = buildPlanetPositions(systemPos, planets);

    // --- 1. Docked/idle ships at planets ---
    const idleByPlanet = empireState.getIdleShipsByPlanet(systemNaturalId);
    for (const [planetId, ships] of idleByPlanet) {
      if (!planetId || !planetPositions.has(planetId)) {
        // Central star fallback: lay out each ship horizontally below star name
        const totalWidth = ships.length * STAR_SHIP_GAP_X;
        const startX = systemPos.worldX - totalWidth / 2 + STAR_SHIP_GAP_X / 2;
        for (let i = 0; i < ships.length; i++) {
          const marker = createShipMarker([ships[i]]);
          marker.x = startX + i * STAR_SHIP_GAP_X;
          marker.y = systemPos.worldY + STAR_OFFSET_Y;
          container.addChild(marker);
        }
        continue;
      }

      const pos = planetPositions.get(planetId)!;
      const config = getPlanetGridConfig(planetId);
      const offset = getSlotOffset(SHIP_SLOT, config);

      const marker = createShipMarker(ships);
      marker.x = pos.x + offset.x;
      marker.y = pos.y + offset.y + SHIP_SLOT_NUDGE_Y;
      container.addChild(marker);
    }

    // --- 2. Transit ships (arriving, departing, in-system STL) ---
    const transitShips = empireState.getInTransitShips();
    // Compute edge ring radius
    let maxRingRadius = 0;
    for (const planet of planets) {
      if (planet.ringRadius > maxRingRadius) maxRingRadius = planet.ringRadius;
    }
    const edgeRadius = maxRingRadius + EDGE_PADDING;

    // Group edge ships by angle bucket for stacking
    const arrivingByAngle = new Map<string, Array<{ ship: ShipSummary; flight: FlightSummary; angle: number }>>();
    const departingByAngle = new Map<string, Array<{ ship: ShipSummary; flight: FlightSummary; angle: number }>>();

    for (const { ship, flight } of transitShips) {
      const seg = flight.segments[flight.currentSegmentIndex];
      if (!seg) continue;

      // In-system STL: both origin and destination are this system, planet-to-planet
      if (
        seg.originSystemNaturalId === systemNaturalId &&
        seg.destinationSystemNaturalId === systemNaturalId &&
        seg.originPlanetNaturalId &&
        seg.destinationPlanetNaturalId &&
        TRAVEL_SEGMENT_TYPES.has(seg.type)
      ) {
        const originPos = planetPositions.get(seg.originPlanetNaturalId);
        const destPos = planetPositions.get(seg.destinationPlanetNaturalId);
        if (originPos && destPos) {
          const graphic = createStlMarker(ship);
          container.addChild(graphic);
          stlEntries.push({
            ship, flight, segment: seg, graphic,
            originPos, destPos,
          });

          // Flight path: origin planet → destination planet
          pathGraphics.moveTo(originPos.x, originPos.y);
          pathGraphics.lineTo(destPos.x, destPos.y);
          pathGraphics.stroke({ width: PATH_STROKE_WIDTH, color: PATH_COLOUR, alpha: PATH_ALPHA });
          continue;
        }
      }

      // Arriving: destination is this system
      if (
        seg.destinationSystemNaturalId === systemNaturalId &&
        TRAVEL_SEGMENT_TYPES.has(seg.type) &&
        seg.originSystemNaturalId &&
        seg.originSystemNaturalId !== systemNaturalId
      ) {
        const otherPos = resolvers.resolveSystem(seg.originSystemNaturalId);
        if (otherPos) {
          const angle = Math.atan2(
            otherPos.worldY - systemPos.worldY,
            otherPos.worldX - systemPos.worldX,
          );
          const key = angle.toFixed(2);
          const group = arrivingByAngle.get(key) ?? [];
          group.push({ ship, flight, angle });
          arrivingByAngle.set(key, group);
        }
        continue;
      }

      // Departing: origin is this system
      if (
        seg.originSystemNaturalId === systemNaturalId &&
        TRAVEL_SEGMENT_TYPES.has(seg.type) &&
        seg.destinationSystemNaturalId &&
        seg.destinationSystemNaturalId !== systemNaturalId
      ) {
        const otherPos = resolvers.resolveSystem(seg.destinationSystemNaturalId);
        if (otherPos) {
          const angle = Math.atan2(
            otherPos.worldY - systemPos.worldY,
            otherPos.worldX - systemPos.worldX,
          );
          const key = angle.toFixed(2);
          const group = departingByAngle.get(key) ?? [];
          group.push({ ship, flight, angle });
          departingByAngle.set(key, group);
        }
        continue;
      }

      // Non-travel segment at this system (charging, loading) — show at edge arriving
      if (
        !TRAVEL_SEGMENT_TYPES.has(seg.type) &&
        (seg.originSystemNaturalId === systemNaturalId || seg.destinationSystemNaturalId === systemNaturalId)
      ) {
        // Place at a default angle (top)
        const angle = -Math.PI / 2;
        const key = angle.toFixed(2);
        const group = arrivingByAngle.get(key) ?? [];
        group.push({ ship, flight, angle });
        arrivingByAngle.set(key, group);
      }
    }

    // Render arriving edge ships with flight path from edge toward destination planet
    for (const [, group] of arrivingByAngle) {
      const angle = group[0].angle;
      const ships = group.map((g) => g.ship);
      const marker = createShipMarker(ships, { flight: group[0].flight, stack: false });
      const ex = systemPos.worldX + Math.cos(angle) * edgeRadius;
      const ey = systemPos.worldY + Math.sin(angle) * edgeRadius;
      marker.x = ex;
      marker.y = ey;
      // Chevron points inward (toward centre)
      const chevronGraphic = marker.getChildAt(0) as Graphics;
      chevronGraphic.rotation = angle + Math.PI + Math.PI / 2;
      container.addChild(marker);

      // Flight path: edge → destination planet (or system centre)
      const flight = group[0].flight;
      const destPlanetPos = flight.destinationPlanetNaturalId
        ? planetPositions.get(flight.destinationPlanetNaturalId)
        : null;
      const targetX = destPlanetPos?.x ?? systemPos.worldX;
      const targetY = destPlanetPos?.y ?? systemPos.worldY;
      pathGraphics.moveTo(ex, ey);
      pathGraphics.lineTo(targetX, targetY);
      pathGraphics.stroke({ width: PATH_STROKE_WIDTH, color: PATH_COLOUR, alpha: PATH_ALPHA });
    }

    // Render departing edge ships with flight path from origin planet to edge
    for (const [, group] of departingByAngle) {
      const angle = group[0].angle;
      const ships = group.map((g) => g.ship);
      const marker = createShipMarker(ships, { flight: group[0].flight, stack: false });
      const ex = systemPos.worldX + Math.cos(angle) * edgeRadius;
      const ey = systemPos.worldY + Math.sin(angle) * edgeRadius;
      marker.x = ex;
      marker.y = ey;
      // Chevron points outward (away from centre)
      const chevronGraphic = marker.getChildAt(0) as Graphics;
      chevronGraphic.rotation = angle + Math.PI / 2;
      container.addChild(marker);

      // Flight path: origin planet (or system centre) → edge
      const flight = group[0].flight;
      const originPlanetPos = flight.originPlanetNaturalId
        ? planetPositions.get(flight.originPlanetNaturalId)
        : null;
      const startX = originPlanetPos?.x ?? systemPos.worldX;
      const startY = originPlanetPos?.y ?? systemPos.worldY;
      pathGraphics.moveTo(startX, startY);
      pathGraphics.lineTo(ex, ey);
      pathGraphics.stroke({ width: PATH_STROKE_WIDTH, color: PATH_COLOUR, alpha: PATH_ALPHA });
    }

    // Initial STL positioning
    tick();

    // Re-apply selection ring after rebuild
    selectionRing = null;
    applySelectionRing();
  }

  function tick(): void {
    if (stlEntries.length === 0) return;
    const now = Date.now();

    for (const entry of stlEntries) {
      const duration = entry.segment.arrivalTimestamp - entry.segment.departureTimestamp;
      const t = duration > 0
        ? Math.max(0, Math.min(1, (now - entry.segment.departureTimestamp) / duration))
        : 1;

      const dx = entry.destPos.x - entry.originPos.x;
      const dy = entry.destPos.y - entry.originPos.y;
      entry.graphic.x = entry.originPos.x + dx * t;
      entry.graphic.y = entry.originPos.y + dy * t;
      entry.graphic.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      entry.graphic.visible = t < 1;
    }
  }

  // Toggle visibility on view level changes
  onStateChange(() => {
    if (getViewLevel() === 'system') {
      refresh();
    } else {
      clear();
      clearRetry();
      container.visible = false;
      container.alpha = 0;
    }
  });

  return {
    refresh,
    tick,
    setSelectedShip,
    destroy() {
      clearRetry();
      container.destroy({ children: true });
    },
    container,
  };
}
