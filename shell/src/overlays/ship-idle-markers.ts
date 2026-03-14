/**
 * Ship Idle Markers — Status Grid Slot 1
 *
 * Renders chevron markers for idle ships (not in transit) at their
 * current system position. Single chevron for 1 ship, stacked
 * chevrons for 2+ ships.
 */

import { Container, Graphics, Circle } from 'pixi.js';
import { getSystems, getCxForSystem, onStateChange, getViewLevel } from '@27bit/helm';
import { getSlotOffset, SYSTEM_GRID_CONFIG, BASE_SYSTEM_GRID_CONFIG, CX_SYSTEM_GRID_CONFIG } from './status-grid';
import { drawChevron } from './chevron';
import type { EmpireState } from '../empire-state';
import type { ShipSummary } from '../types/bridge';

const SHIP_COLOUR = 0xff8c00;
const SHIP_ALPHA = 0.8;
const SYSTEM_VIEW_DIM_ALPHA = 0.05;
const CHEVRON_SIZE = 5;
const STACK_OFFSET_Y = -4;
const HIT_RADIUS = 12;
// Selection halo — matches Helm's planet selection style
const HALO_RADIUS = 10;
const HALO_COLOUR = 0x3399ff;
const HALO_ALPHA = 0.7;
const HALO_STROKE = 2.0;
const HALO_ARC_SPAN = Math.PI * 0.7;

const SHIP_SLOT = 1;
/** Extra downward nudge so stacked chevrons don't overlap gateway (slot 0) */
const SHIP_SLOT_NUDGE_Y = 4;

export interface ShipInteractionCallbacks {
  onHover(ships: ShipSummary[], screenX: number, screenY: number): void;
  onHoverEnd(): void;
  onClick(ships: ShipSummary[], screenX: number, screenY: number): void;
}

interface IdleEntry {
  systemNaturalId: string;
  ships: ShipSummary[];
  graphic: Graphics;
}

export interface ShipIdleMarkerLayer {
  refresh(): void;
  destroy(): void;
  /** Highlight the chevron for a specific ship's system. Pass null to clear. */
  setSelectedShip(shipId: string | null): void;
  container: Container;
}

export function createShipIdleMarkers(
  empireState: EmpireState,
  callbacks: ShipInteractionCallbacks,
): ShipIdleMarkerLayer {
  const container = new Container();
  container.eventMode = 'passive';
  container.alpha = SHIP_ALPHA;

  let entries: IdleEntry[] = [];
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
      if (entry.ships.some(s => s.shipId === selectedShipId)) {
        selectionRing = new Graphics();
        // Right arc
        selectionRing.arc(0, 0, HALO_RADIUS, -HALO_ARC_SPAN / 2, HALO_ARC_SPAN / 2);
        selectionRing.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });
        // Left arc
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

  function refresh(): void {
    container.removeChildren();
    entries = [];

    const idleBySystem = empireState.getIdleShipsBySystem();
    if (idleBySystem.size === 0) return;

    const ownedSystems = new Set(empireState.getOwnedSystemNaturalIds());

    for (const system of getSystems()) {
      const ships = idleBySystem.get(system.naturalId);
      if (!ships || ships.length === 0) continue;

      let config = SYSTEM_GRID_CONFIG;
      if (getCxForSystem(system.id)) {
        config = CX_SYSTEM_GRID_CONFIG;
      } else if (ownedSystems.has(system.naturalId)) {
        config = BASE_SYSTEM_GRID_CONFIG;
      }
      const offset = getSlotOffset(SHIP_SLOT, config);

      const marker = new Graphics();
      marker.eventMode = 'static';
      marker.cursor = 'pointer';
      marker.hitArea = new Circle(0, 0, HIT_RADIUS);
      marker.x = system.worldX + offset.x;
      marker.y = system.worldY + offset.y + SHIP_SLOT_NUDGE_Y;

      drawChevron(marker, CHEVRON_SIZE, SHIP_COLOUR);
      if (ships.length >= 2) {
        const stacked = new Graphics();
        stacked.y = STACK_OFFSET_Y;
        drawChevron(stacked, CHEVRON_SIZE, SHIP_COLOUR);
        marker.addChild(stacked);
      }

      const entry: IdleEntry = { systemNaturalId: system.naturalId, ships, graphic: marker };
      entries.push(entry);

      marker.on('pointerover', (e) => {
        callbacks.onHover(entry.ships, e.global.x, e.global.y);
      });
      marker.on('pointerout', () => {
        callbacks.onHoverEnd();
      });
      marker.on('pointertap', (e) => {
        callbacks.onHoverEnd();
        callbacks.onClick(entry.ships, e.global.x, e.global.y);
      });

      container.addChild(marker);
    }

    // Re-apply selection ring after rebuild
    selectionRing = null;
    applySelectionRing();
  }

  onStateChange(() => {
    if (getViewLevel() === 'system') {
      container.alpha = SYSTEM_VIEW_DIM_ALPHA;
    } else {
      container.alpha = SHIP_ALPHA;
    }
  });

  return { refresh, destroy: () => container.destroy({ children: true }), setSelectedShip, container };
}
