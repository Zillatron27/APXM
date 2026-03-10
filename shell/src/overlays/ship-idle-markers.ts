/**
 * Ship Idle Markers — Status Grid Slot 1
 *
 * Renders chevron markers for idle ships (not in transit) at their
 * current system position. Single chevron for 1 ship, stacked
 * chevrons for 2+ ships.
 */

import { Container, Graphics } from 'pixi.js';
import { getSystems, getCxForSystem, onStateChange, getViewLevel } from '@27bit/helm';
import { getSlotOffset, SYSTEM_GRID_CONFIG, BASE_SYSTEM_GRID_CONFIG, CX_SYSTEM_GRID_CONFIG } from './status-grid';
import { drawChevron } from './chevron';
import type { EmpireState } from '../empire-state';

const SHIP_COLOUR = 0xff8c00;
const SHIP_ALPHA = 0.8;
const SYSTEM_VIEW_DIM_ALPHA = 0.05;
const CHEVRON_SIZE = 5;
const STACK_OFFSET_Y = -4;

const SHIP_SLOT = 1;

export interface ShipIdleMarkerLayer {
  refresh(): void;
  destroy(): void;
  container: Container;
}

export function createShipIdleMarkers(empireState: EmpireState): ShipIdleMarkerLayer {
  const container = new Container();
  container.eventMode = 'none';
  container.alpha = SHIP_ALPHA;

  function refresh(): void {
    container.removeChildren();

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
      marker.eventMode = 'none';
      marker.x = system.worldX + offset.x;
      marker.y = system.worldY + offset.y;

      drawChevron(marker, CHEVRON_SIZE, SHIP_COLOUR);
      if (ships.length >= 2) {
        // Draw a second chevron offset upward to suggest a group
        const stacked = new Graphics();
        stacked.y = STACK_OFFSET_Y;
        drawChevron(stacked, CHEVRON_SIZE, SHIP_COLOUR);
        marker.addChild(stacked);
      }

      container.addChild(marker);
    }
  }

  onStateChange(() => {
    if (getViewLevel() === 'system') {
      container.alpha = SYSTEM_VIEW_DIM_ALPHA;
    } else {
      container.alpha = SHIP_ALPHA;
    }
  });

  return { refresh, destroy: () => container.destroy({ children: true }), container };
}
