/**
 * Map Module
 *
 * Initializes the Helm galaxy map, wires up empire state from bridge messages,
 * renders ownership overlays, and frames camera to player territory.
 */

import {
  createMap, getSystemByNaturalId, getSystemById, getPlanetsForSystem,
  onStateChange, getViewLevel,
} from '@27bit/helm';
import type { HelmInstance } from '@27bit/helm';
import type { Viewport } from 'pixi-viewport';
import type { ApxmInitMessage, ApxmUpdateMessage } from './types/bridge';
import { createEmpireState } from './empire-state';
import { createEmpireOverlay } from './empire-overlay';
import type { EmpireOverlay, SystemResolvers, PlanetInfo } from './empire-overlay';

const MAX_ZOOM = 8.0;
const EMPIRE_PADDING = 100;
const FRAME_TRANSITION_MS = 800;

const resolvers: SystemResolvers = {
  resolveSystem(naturalId: string) {
    const sys = getSystemByNaturalId(naturalId);
    return sys ? { worldX: sys.worldX, worldY: sys.worldY } : null;
  },

  resolveNaturalId(systemUuid: string) {
    const sys = getSystemById(systemUuid);
    return sys?.naturalId ?? null;
  },

  resolvePlanets(systemNaturalId: string): PlanetInfo[] | null {
    const planets = getPlanetsForSystem(systemNaturalId);
    if (!planets) return null;
    return planets.map((p, i) => ({
      naturalId: p.naturalId,
      ringRadius: p.ringRadius,
      displayRadius: p.displayRadius,
      orbitIndex: i,
      totalPlanets: planets.length,
    }));
  },
};

/** Saved empire camera state for restoring after system view exit */
let empireCamera: { x: number; y: number; scale: number } | null = null;

function frameToEmpire(viewport: Viewport, naturalIds: string[]): void {
  if (naturalIds.length === 0) return;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const nid of naturalIds) {
    const sys = getSystemByNaturalId(nid);
    if (!sys) continue;
    minX = Math.min(minX, sys.worldX);
    maxX = Math.max(maxX, sys.worldX);
    minY = Math.min(minY, sys.worldY);
    maxY = Math.max(maxY, sys.worldY);
  }

  if (!isFinite(minX)) return;

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const routeWidth = maxX - minX;
  const routeHeight = maxY - minY;

  const scaleX = window.innerWidth / (routeWidth + EMPIRE_PADDING * 2);
  const scaleY = window.innerHeight / (routeHeight + EMPIRE_PADDING * 2);
  const targetScale = Math.min(scaleX, scaleY, MAX_ZOOM);

  empireCamera = { x: centreX, y: centreY, scale: targetScale };

  viewport.animate({
    position: { x: centreX, y: centreY },
    scale: targetScale,
    time: FRAME_TRANSITION_MS,
    ease: 'easeInOutCubic',
  });
}

function restoreEmpireCamera(viewport: Viewport): void {
  if (!empireCamera) return;

  viewport.animate({
    position: { x: empireCamera.x, y: empireCamera.y },
    scale: empireCamera.scale,
    time: FRAME_TRANSITION_MS,
    ease: 'easeInOutCubic',
  });
}

export async function initMap(container: HTMLElement, earlyMessages: MessageEvent[] = []): Promise<void> {
  const empireState = createEmpireState();
  let helm: HelmInstance | null = null;
  let overlay: EmpireOverlay | null = null;
  const pendingMessages: MessageEvent[] = [];

  function processMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'apxm-init') {
      const msg = data as ApxmInitMessage;
      empireState.applySnapshot(msg.snapshot);
      overlay?.refresh();
      frameToEmpire(helm!.viewport, empireState.getOwnedSystemNaturalIds());
    } else if (data.type === 'apxm-update') {
      const msg = data as ApxmUpdateMessage;
      empireState.applyUpdate(msg.update);
      if (msg.update.entityType === 'sites' || msg.update.entityType === 'workforce') {
        overlay?.refresh();
      }
    }
  }

  // Register listener BEFORE awaiting Helm (buffer early messages)
  window.addEventListener('message', (event: MessageEvent) => {
    if (!helm) {
      pendingMessages.push(event);
      return;
    }
    processMessage(event);
  });

  helm = await createMap(container);
  overlay = createEmpireOverlay(helm.viewport, empireState, resolvers);

  // Restore empire camera when exiting system view
  const viewport = helm.viewport;
  onStateChange(() => {
    if (getViewLevel() === 'galaxy' && empireCamera) {
      restoreEmpireCamera(viewport);
    }
  });

  // Drain all buffered messages: early (from main.ts) + pending (during Helm load)
  for (const event of earlyMessages) processMessage(event);
  for (const event of pendingMessages) processMessage(event);
  pendingMessages.length = 0;

  console.log('[APXM Shell] Map initialized with empire overlay');
}
