/**
 * Gateway Markers — Status Grid Slot 0
 *
 * Re-renders Helm's gateway indicator dots at the status grid position
 * instead of Helm's hardcoded offset. Visual style matches Helm exactly
 * (purple circle stroke), only position changes.
 */

import { Container, Graphics } from 'pixi.js';
import { getSystems, isGatewaySystem, getCxForSystem, onStateChange, getViewLevel } from '@27bit/helm';
import type { StatusGridConfig } from './status-grid';
import { getSlotOffset, SYSTEM_GRID_CONFIG, BASE_SYSTEM_GRID_CONFIG, CX_SYSTEM_GRID_CONFIG } from './status-grid';
import type { EmpireState } from '../empire-state';

const GATEWAY_COLOUR = 0xbb77ff;
const GATEWAY_RADIUS = 7;
const GATEWAY_STROKE = 1.5;
const GATEWAY_ALPHA = 0.8;
const SYSTEM_VIEW_DIM_ALPHA = 0.05;

const GATEWAY_SLOT = 0;

export interface GatewayMarkerLayer {
  refresh(): void;
  destroy(): void;
  container: Container;
}

export function createGatewayMarkers(empireState: EmpireState): GatewayMarkerLayer {
  const container = new Container();
  container.eventMode = 'none';
  container.alpha = GATEWAY_ALPHA;

  function refresh(): void {
    container.removeChildren();

    const ownedSystems = new Set(empireState.getOwnedSystemNaturalIds());

    for (const system of getSystems()) {
      if (!isGatewaySystem(system.id)) continue;

      let config = SYSTEM_GRID_CONFIG;
      if (getCxForSystem(system.id)) {
        config = CX_SYSTEM_GRID_CONFIG;
      } else if (ownedSystems.has(system.naturalId)) {
        config = BASE_SYSTEM_GRID_CONFIG;
      }
      const offset = getSlotOffset(GATEWAY_SLOT, config);

      const dot = new Graphics();
      dot.circle(0, 0, GATEWAY_RADIUS);
      dot.stroke({ width: GATEWAY_STROKE, color: GATEWAY_COLOUR });
      dot.x = system.worldX + offset.x;
      dot.y = system.worldY + offset.y;
      dot.eventMode = 'none';

      container.addChild(dot);
    }
  }

  // Dim in system view, full alpha in galaxy view
  onStateChange(() => {
    if (getViewLevel() === 'system') {
      container.alpha = SYSTEM_VIEW_DIM_ALPHA;
    } else {
      container.alpha = GATEWAY_ALPHA;
    }
  });

  return { refresh, destroy: () => container.destroy({ children: true }), container };
}
