/**
 * Empire Overlay Renderer
 *
 * Galaxy view: coloured circle strokes at owned system positions.
 * System view: coloured circle strokes around owned planets.
 * Ring colour reflects burn status: green (ok), amber (warning),
 * red (critical), orange (unknown/no data).
 */

import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { onStateChange, getViewLevel, getFocusedSystemId } from '@27bit/helm';
import type { EmpireState } from './empire-state';

// Galaxy-level system rings (calibrated against Helm's CX markers)
const EMPIRE_RING_RADIUS = 18;
const EMPIRE_RING_STROKE = 2.5;
const EMPIRE_RING_ALPHA = 0.7;

// System-level planet rings (scaled relative to planet display size)
const PLANET_RING_PADDING = 6;
const PLANET_RING_STROKE = 2.5;
const PLANET_RING_ALPHA = 0.8;

type BurnStatus = ReturnType<EmpireState['getSystemBurnStatus']>;

const BURN_COLOURS: Record<BurnStatus, number> = {
  ok: 0x22cc66,
  warning: 0xffaa00,
  critical: 0xff4444,
  unknown: 0x888888,
};

export interface EmpireOverlay {
  refresh(): void;
}

export interface PlanetInfo {
  naturalId: string;
  ringRadius: number;
  displayRadius: number;
  orbitIndex: number;
  totalPlanets: number;
}

export interface SystemResolvers {
  /** naturalId → world position */
  resolveSystem(naturalId: string): { worldX: number; worldY: number } | null;
  /** UUID → naturalId */
  resolveNaturalId(systemUuid: string): string | null;
  /** systemNaturalId → planet layout info */
  resolvePlanets(systemNaturalId: string): PlanetInfo[] | null;
}

export function createEmpireOverlay(
  viewport: Viewport,
  empireState: EmpireState,
  resolvers: SystemResolvers,
): EmpireOverlay {
  const galaxyContainer = new Container();
  galaxyContainer.eventMode = 'none';

  const systemContainer = new Container();
  systemContainer.eventMode = 'none';

  // Insert galaxy overlay between Galaxy[1] and System[2→3]
  viewport.addChildAt(galaxyContainer, 2);
  // System overlay on top of everything
  viewport.addChild(systemContainer);

  function refreshGalaxy(): void {
    galaxyContainer.removeChildren();

    for (const nid of empireState.getOwnedSystemNaturalIds()) {
      const pos = resolvers.resolveSystem(nid);
      if (!pos) continue;

      const status = empireState.getSystemBurnStatus(nid);
      const color = BURN_COLOURS[status];

      const ring = new Graphics();
      ring.circle(0, 0, EMPIRE_RING_RADIUS);
      ring.stroke({ width: EMPIRE_RING_STROKE, color, alpha: EMPIRE_RING_ALPHA });
      ring.x = pos.worldX;
      ring.y = pos.worldY;
      ring.eventMode = 'none';

      galaxyContainer.addChild(ring);
    }
  }

  function refreshSystem(systemNaturalId: string): void {
    systemContainer.removeChildren();

    const systemPos = resolvers.resolveSystem(systemNaturalId);
    if (!systemPos) return;

    const ownedPlanetIds = new Set(empireState.getOwnedPlanetNaturalIds(systemNaturalId));
    if (ownedPlanetIds.size === 0) return;

    const planets = resolvers.resolvePlanets(systemNaturalId);
    if (!planets) return;

    for (const planet of planets) {
      if (!ownedPlanetIds.has(planet.naturalId)) continue;

      // Replicate SystemLayer planet positioning
      const angle = (planet.orbitIndex / planet.totalPlanets) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * planet.ringRadius;
      const py = Math.sin(angle) * planet.ringRadius;

      const status = empireState.getPlanetBurnStatus(planet.naturalId);
      const color = BURN_COLOURS[status];
      const ringRadius = planet.displayRadius + PLANET_RING_PADDING;

      const ring = new Graphics();
      ring.circle(0, 0, ringRadius);
      ring.stroke({ width: PLANET_RING_STROKE, color, alpha: PLANET_RING_ALPHA });
      ring.x = systemPos.worldX + px;
      ring.y = systemPos.worldY + py;
      ring.eventMode = 'none';

      systemContainer.addChild(ring);
    }
  }

  function refresh(): void {
    const viewLevel = getViewLevel();

    if (viewLevel === 'galaxy') {
      galaxyContainer.visible = true;
      systemContainer.removeChildren();
      refreshGalaxy();
    } else if (viewLevel === 'system') {
      showPlanetOverlay();
    }
  }

  function showPlanetOverlay(): void {
    galaxyContainer.visible = false;
    const focusedUuid = getFocusedSystemId();
    if (!focusedUuid) return;

    const naturalId = resolvers.resolveNaturalId(focusedUuid);
    if (!naturalId) return;

    // Helm lazy-loads planet data — if not cached yet, retry after fetch completes
    const planets = resolvers.resolvePlanets(naturalId);
    if (planets) {
      refreshSystem(naturalId);
    } else {
      const retryInterval = setInterval(() => {
        if (getViewLevel() !== 'system' || getFocusedSystemId() !== focusedUuid) {
          clearInterval(retryInterval);
          return;
        }
        if (resolvers.resolvePlanets(naturalId)) {
          clearInterval(retryInterval);
          refreshSystem(naturalId);
        }
      }, 200);
    }
  }

  // Toggle visibility when Helm view level changes
  onStateChange(() => {
    const viewLevel = getViewLevel();
    if (viewLevel === 'galaxy') {
      galaxyContainer.visible = true;
      systemContainer.removeChildren();
    } else if (viewLevel === 'system') {
      showPlanetOverlay();
    }
  });

  return { refresh };
}
