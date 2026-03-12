/**
 * Map Module
 *
 * Initializes the Helm galaxy map, wires up empire state from bridge messages,
 * renders ownership overlays, and frames camera to player territory.
 */

import {
  createMap, getSystemByNaturalId, getSystemById, getPlanetsForSystem,
  onStateChange, getViewLevel, getSelectedEntity, setSelectedEntity,
  getFocusedSystemId,
} from '@27bit/helm';
import type { HelmInstance } from '@27bit/helm';
import { Ticker } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { ApxmInitMessage, ApxmUpdateMessage } from './types/bridge';
import { createEmpireState } from './empire-state';
import { createEmpireOverlay } from './empire-overlay';
import type { EmpireOverlay, SystemResolvers, PlanetInfo } from './empire-overlay';
import { createGatewayMarkers } from './overlays/gateway-markers';
import type { GatewayMarkerLayer } from './overlays/gateway-markers';
import { createShipIdleMarkers } from './overlays/ship-idle-markers';
import type { ShipIdleMarkerLayer } from './overlays/ship-idle-markers';
import type { ShipInteractionCallbacks } from './overlays/ship-idle-markers';
import { createShipTransitLayer } from './overlays/ship-transit';
import type { ShipTransitLayer } from './overlays/ship-transit';
import { createShipSystemView } from './overlays/ship-system-view';
import type { ShipSystemViewLayer } from './overlays/ship-system-view';
import { showTooltip, hideTooltip, updateTooltipPosition } from './ui/ship-tooltip';
import { showPanel, updatePanel } from './ui/ship-panel';
import { showBasePanel, updateBasePanel } from './ui/base-panel';
import { isManagedPanelVisible, hideManagedPanel } from './ui/panel-manager';

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
  let gatewayMarkers: GatewayMarkerLayer | null = null;
  let shipIdleMarkers: ShipIdleMarkerLayer | null = null;
  let shipTransit: ShipTransitLayer | null = null;
  let shipSystemView: ShipSystemViewLayer | null = null;
  const pendingMessages: MessageEvent[] = [];

  function processMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'apxm-init') {
      const msg = data as ApxmInitMessage;
      empireState.applySnapshot(msg.snapshot);
      overlay?.refresh();
      gatewayMarkers?.refresh();
      shipIdleMarkers?.refresh();
      shipTransit?.refresh();
      shipSystemView?.refresh();
      updatePanel(msg.snapshot.ships, msg.snapshot.flights);
      updateBasePanel(empireState);
      frameToEmpire(helm!.viewport, empireState.getOwnedSystemNaturalIds());
    } else if (data.type === 'apxm-update') {
      const msg = data as ApxmUpdateMessage;
      empireState.applyUpdate(msg.update);
      if (msg.update.entityType === 'sites' || msg.update.entityType === 'workforce') {
        overlay?.refresh();
      }
      if (msg.update.entityType === 'ships' || msg.update.entityType === 'flights') {
        shipIdleMarkers?.refresh();
        shipTransit?.refresh();
        shipSystemView?.refresh();
        // Re-render open ship panel with updated data
        const snap = empireState;
        const allShips = [...snap.getIdleShipsBySystem().values()].flat();
        const inTransit = snap.getInTransitShips();
        const ships = [...allShips, ...inTransit.map(e => e.ship)];
        const flights = inTransit.map(e => e.flight);
        updatePanel(ships, flights);
      }
      // Re-render open base panel when relevant data changes
      const basePanelTypes = ['sites', 'production', 'workforce', 'storage', 'screens'];
      if (basePanelTypes.includes(msg.update.entityType)) {
        updateBasePanel(empireState);
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

  const viewport = helm.viewport;

  // Ship interaction callbacks shared by idle + transit layers
  const shipCallbacks: ShipInteractionCallbacks = {
    onHover(ships, screenX, screenY) {
      const flights = ships
        .map(s => empireState.getFlightForShip(s.shipId))
        .filter((f): f is NonNullable<typeof f> => !!f);
      showTooltip(ships, flights, screenX, screenY);
    },
    onHoverEnd() {
      hideTooltip();
    },
    onClick(ships, screenX, screenY) {
      hideTooltip();
      const flights = ships
        .map(s => empireState.getFlightForShip(s.shipId))
        .filter((f): f is NonNullable<typeof f> => !!f);
      // Close any Helm entity panel
      setSelectedEntity(null);
      showPanel(ships, flights, screenX, screenY, {
        onBufferCommand(command) {
          window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
        },
        onClose() {
          // No-op — panel handles its own DOM cleanup
        },
      });
    },
  };

  overlay = createEmpireOverlay(helm.viewport, empireState, resolvers);

  // Hide Helm's native gateway indicator dots, render via status grid instead
  helm.renderer.setGatewayIndicatorsVisible(false);
  gatewayMarkers = createGatewayMarkers(empireState);
  gatewayMarkers.refresh();
  // Insert after empire overlay (index 2) → index 3
  helm.viewport.addChildAt(gatewayMarkers.container, 3);

  shipIdleMarkers = createShipIdleMarkers(empireState, shipCallbacks);
  shipIdleMarkers.refresh();
  helm.viewport.addChildAt(shipIdleMarkers.container, 4);

  shipTransit = createShipTransitLayer(empireState, resolvers, helm.viewport, shipCallbacks);
  shipTransit.refresh();
  helm.viewport.addChildAt(shipTransit.container, 5);

  shipSystemView = createShipSystemView(empireState, resolvers, helm.viewport, shipCallbacks);
  shipSystemView.refresh();
  // Append on top — must be above Helm's system-level planet hit areas
  helm.viewport.addChild(shipSystemView.container);

  // Per-frame ticker for transit ship interpolation
  const tickerFn = () => {
    shipTransit!.tick();
    shipSystemView!.tick();

    // Update tooltip position for moving transit ships
    const worldPos = shipTransit!.getHoveredWorldPos();
    if (worldPos) {
      const screen = viewport.toScreen(worldPos.x, worldPos.y);
      updateTooltipPosition(screen.x, screen.y);
    }
  };
  Ticker.shared.add(tickerFn);

  // Panel coordination: entity selection drives panel lifecycle
  let prevViewLevel = getViewLevel();
  onStateChange(() => {
    const viewLevel = getViewLevel();

    if (viewLevel === 'galaxy' && empireCamera) {
      restoreEmpireCamera(viewport);
    }

    // Dismiss Helm's native panel when entering system view (zoom-in transition)
    if (viewLevel === 'system' && prevViewLevel === 'galaxy') {
      setTimeout(() => helm!.panelManager.hide(), 0);
    }
    prevViewLevel = viewLevel;

    const entity = getSelectedEntity();

    if (entity === null) {
      // Deselection — close any APXM panel
      if (isManagedPanelVisible()) hideManagedPanel();
      return;
    }

    if (entity.type === 'planet') {
      // Resolve Helm UUID to naturalId
      const focusedId = getFocusedSystemId();
      if (!focusedId) return;
      const system = getSystemById(focusedId);
      if (!system) return;
      const planets = getPlanetsForSystem(system.naturalId);
      const planet = planets?.find((p) => p.id === entity.id || p.naturalId === entity.id);
      if (!planet) return;

      const site = empireState.getSiteForPlanet(planet.naturalId);
      if (site) {
        // Owned planet — suppress Helm's panel and show base panel
        // setTimeout(0) ensures our hide fires after Helm's own onStateChange renders
        setTimeout(() => helm!.panelManager.hide(), 0);

        // Calculate planet screen position from world coordinates
        const planetAngle = (planet.orbitIndex / Math.max(planets!.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const planetWorldX = system.worldX + Math.cos(planetAngle) * planet.ringRadius;
        const planetWorldY = system.worldY + Math.sin(planetAngle) * planet.ringRadius;
        const screenPos = viewport.toScreen(planetWorldX, planetWorldY);

        showBasePanel(planet.naturalId, planet.name || planet.naturalId, screenPos.x, screenPos.y, empireState, {
          onBufferCommand(command) {
            window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
          },
          onScreenSwitch(screenId) {
            window.parent.postMessage({ type: 'apxm-screen-switch', screenId }, '*');
          },
          onScreenAssign(planetNaturalId, screenId) {
            empireState.setScreenAssignment(planetNaturalId, screenId);
            window.parent.postMessage({ type: 'apxm-screen-assign', planetNaturalId, screenId }, '*');
          },
          onClose() {
            // No-op — panel handles its own DOM cleanup
          },
        });
        return;
      }
      // Not owned — close any APXM panel, let Helm show its native panel
      if (isManagedPanelVisible()) hideManagedPanel();
      return;
    }

    // System or other entity selection — close any APXM panel
    if (isManagedPanelVisible()) hideManagedPanel();
  });

  // Escape key closes ship panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isManagedPanelVisible()) {
      hideManagedPanel();
    }
  });

  // Drain all buffered messages: early (from main.ts) + pending (during Helm load)
  for (const event of earlyMessages) processMessage(event);
  for (const event of pendingMessages) processMessage(event);
  pendingMessages.length = 0;

  console.log('[APXM Shell] Map initialized with empire overlay');
}
