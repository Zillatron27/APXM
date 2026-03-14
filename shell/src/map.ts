/**
 * Map Module
 *
 * Initializes the Helm galaxy map, wires up empire state from bridge messages,
 * renders ownership overlays, frames camera to player territory,
 * and provides toolbar/menu/panel UI for the desktop view.
 */

import {
  createMap, getSystemByNaturalId, getSystemById, getPlanetsForSystem,
  onStateChange, getViewLevel, getSelectedEntity, setSelectedEntity,
  getFocusedSystemId, setGatewaysVisible, onThemeChange,
} from '@27bit/helm';
import type { HelmInstance } from '@27bit/helm';
import { Ticker, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { ApxmInitMessage, ApxmUpdateMessage, ApxmSettingsUpdateMessage } from './types/bridge';
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
import { createToolbar, setMenuActive, setEmpireActive, isEmpireActive, getMenuButton } from './ui/toolbar';
import { showMenu, hideMenu, isMenuVisible } from './ui/menu';
import { showFleetPanel, hideFleetPanel, isFleetPanelVisible, getFleetPanelWidth, setFleetPanelRightOffset } from './ui/fleet-panel';
import { showBurnPanel, hideBurnPanel, isBurnPanelVisible, getBurnPanelWidth, setBurnPanelRightOffset } from './ui/burn-panel';
import { showSettingsPanel, hideSettingsPanel } from './ui/settings-panel';
import { getBrightSystems, clearBrightCache } from './ui/empire-dim';

const MAX_ZOOM = 8.0;
const SHIP_ZOOM_SCALE = 5.0;
const EMPIRE_PADDING = 100;
const FRAME_TRANSITION_MS = 800;
const EMPIRE_DIM_STORAGE_KEY = 'apxm-empire-dim';

// System selection halo — matches Helm's planet selection style
const SYSTEM_HALO_RADIUS = 22;
const SYSTEM_HALO_COLOUR = 0x3399ff;
const SYSTEM_HALO_ALPHA = 0.7;
const SYSTEM_HALO_STROKE = 2.0;
const SYSTEM_HALO_ARC_SPAN = Math.PI * 0.7;

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

/** Saved camera state before ship selection zoom */
let preShipCamera: { x: number; y: number; scale: number } | null = null;

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

  // Empire dim state
  let empireDimActive = false;
  try {
    empireDimActive = localStorage.getItem(EMPIRE_DIM_STORAGE_KEY) === 'true';
  } catch { /* localStorage unavailable */ }

  function applyEmpireDim(): void {
    if (!helm) return;
    if (empireDimActive) {
      const bright = getBrightSystems(empireState);
      helm.setHighlightedSystems(bright);
    } else {
      helm.setHighlightedSystems(null);
    }
  }

  function toggleEmpireDim(active: boolean): void {
    empireDimActive = active;
    try {
      localStorage.setItem(EMPIRE_DIM_STORAGE_KEY, String(active));
    } catch { /* localStorage unavailable */ }
    applyEmpireDim();
  }

  // Close all overlay panels (fleet, burn, settings)
  function closeOverlayPanels(): void {
    if (isFleetPanelVisible()) hideFleetPanel();
    if (isBurnPanelVisible()) hideBurnPanel();
    hideSettingsPanel();
  }

  const MENU_WIDTH = 220;
  const PANEL_GAP = 8;
  const BASE_RIGHT = 12;

  /** Reposition all open panels based on whether the menu is open. */
  function repositionPanels(): void {
    const menuOpen = isMenuVisible();
    let right = menuOpen ? MENU_WIDTH : BASE_RIGHT;

    // Stack panels left-to-right: first fleet, then burn
    if (isFleetPanelVisible()) {
      setFleetPanelRightOffset(right);
      right += getFleetPanelWidth() + PANEL_GAP;
    }
    if (isBurnPanelVisible()) {
      setBurnPanelRightOffset(right);
    }
  }

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
      // Re-apply empire dim with potentially new site data
      clearBrightCache();
      if (empireDimActive) applyEmpireDim();
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
      // Re-compute empire dim when sites change
      if (msg.update.entityType === 'sites') {
        clearBrightCache();
        if (empireDimActive) applyEmpireDim();
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
      // Hide Helm's native panel without clearing entity selection
      setTimeout(() => helm!.panelManager.hide(), 0);
      // If no entity selected, set focused system as guard so Helm's
      // cascade step 1 (deselect) absorbs the dismiss click
      if (!getSelectedEntity() && getViewLevel() === 'system') {
        const focusedId = getFocusedSystemId();
        if (focusedId) setSelectedEntity({ type: 'system', id: focusedId });
      }
      // Select the first ship in the group
      const selectShip = (id: string) => {
        shipIdleMarkers?.setSelectedShip(id);
        shipTransit?.setSelectedShip(id);
        shipSystemView?.setSelectedShip(id);
      };
      if (ships.length > 0) selectShip(ships[0].shipId);

      showPanel(ships, flights, screenX, screenY, {
        onBufferCommand(command) {
          window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
        },
        onShipChange(shipId) {
          selectShip(shipId);
        },
        onClose() {
          shipIdleMarkers?.setSelectedShip(null);
          shipTransit?.setSelectedShip(null);
          shipSystemView?.setSelectedShip(null);
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

  // System selection halo — visual ring around selected system in galaxy view
  const systemSelectionHalo = new Graphics();
  systemSelectionHalo.eventMode = 'none';
  systemSelectionHalo.visible = false;
  helm.viewport.addChild(systemSelectionHalo);

  function updateSystemSelectionHalo(): void {
    systemSelectionHalo.clear();
    systemSelectionHalo.visible = false;

    if (getViewLevel() !== 'galaxy') return;
    const entity = getSelectedEntity();
    if (!entity || entity.type !== 'system') return;

    const sys = getSystemById(entity.id);
    if (!sys) return;

    systemSelectionHalo.x = sys.worldX;
    systemSelectionHalo.y = sys.worldY;
    systemSelectionHalo.arc(0, 0, SYSTEM_HALO_RADIUS, -SYSTEM_HALO_ARC_SPAN / 2, SYSTEM_HALO_ARC_SPAN / 2);
    systemSelectionHalo.stroke({ width: SYSTEM_HALO_STROKE, color: SYSTEM_HALO_COLOUR, alpha: SYSTEM_HALO_ALPHA });
    systemSelectionHalo.arc(0, 0, SYSTEM_HALO_RADIUS, Math.PI - SYSTEM_HALO_ARC_SPAN / 2, Math.PI + SYSTEM_HALO_ARC_SPAN / 2);
    systemSelectionHalo.stroke({ width: SYSTEM_HALO_STROKE, color: SYSTEM_HALO_COLOUR, alpha: SYSTEM_HALO_ALPHA });
    systemSelectionHalo.visible = true;
  }

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

  // ============================================================================
  // Toolbar + Menu
  // ============================================================================

  const toolbarEl = createToolbar({
    onGatewayToggle(active) {
      setGatewaysVisible(active);
      helm!.setGatewaysVisible(active);
      // Keep Helm's native indicators hidden — APXM uses status grid instead
      helm!.renderer.setGatewayIndicatorsVisible(false);
    },
    onEmpireToggle(active) {
      toggleEmpireDim(active);
    },
    onMenuToggle(active) {
      if (active) {
        const anchor = getMenuButton();
        if (!anchor) return;
        showMenu(anchor, {
          onFleetOverview() {
            if (isFleetPanelVisible()) { hideFleetPanel(); repositionPanels(); return; }
            showFleetPanel(empireState, {
              onShipClick(systemNaturalId, shipId) {
                // Try transit layer first (ship may be mid-flight)
                const transitPos = shipTransit?.getShipWorldPosition(shipId) ?? null;

                // Fallback to system position (idle ships)
                const sys = getSystemByNaturalId(systemNaturalId);
                if (!sys && !transitPos) return;

                const targetX = transitPos?.x ?? sys!.worldX;
                const targetY = transitPos?.y ?? sys!.worldY;

                // Save camera ONLY on first selection (don't overwrite on re-click)
                const vp = helm!.viewport;
                if (!preShipCamera) {
                  preShipCamera = { x: vp.center.x, y: vp.center.y, scale: vp.scaled };
                }

                vp.animate({
                  position: { x: targetX, y: targetY },
                  scale: SHIP_ZOOM_SCALE,
                  time: FRAME_TRANSITION_MS,
                  ease: 'easeInOutCubic',
                });

                // Highlight the ship's chevron (on whichever layer it lives)
                shipIdleMarkers?.setSelectedShip(shipId);
                shipTransit?.setSelectedShip(shipId);
                shipSystemView?.setSelectedShip(shipId);
              },
              onClose() {
                // Restore camera and clear selection
                shipIdleMarkers?.setSelectedShip(null);
                shipTransit?.setSelectedShip(null);
                shipSystemView?.setSelectedShip(null);
                if (preShipCamera) {
                  const vp = helm!.viewport;
                  vp.animate({
                    position: { x: preShipCamera.x, y: preShipCamera.y },
                    scale: preShipCamera.scale,
                    time: FRAME_TRANSITION_MS,
                    ease: 'easeInOutCubic',
                  });
                  preShipCamera = null;
                }
                repositionPanels();
              },
            });
            repositionPanels();
          },
          onBurnStatus() {
            if (isBurnPanelVisible()) { hideBurnPanel(); repositionPanels(); return; }
            showBurnPanel(empireState, {
              onBaseClick(systemNaturalId, planetNaturalId) {
                const sys = getSystemByNaturalId(systemNaturalId);
                if (!sys) return;
                const planets = getPlanetsForSystem(sys.naturalId);
                const planet = planets?.find(p => p.naturalId === planetNaturalId);
                if (planet) {
                  helm!.panToPlanet(sys.id, planet.id);
                } else {
                  helm!.panToSystem(sys.id);
                }
              },
              onClose() { repositionPanels(); },
            });
            repositionPanels();
          },
          onSettings() {
            hideSettingsPanel();
            showSettingsPanel(empireState, {
              onSave(thresholds) {
                const msg: ApxmSettingsUpdateMessage = {
                  type: 'apxm-settings-update',
                  settings: { burnThresholds: thresholds },
                };
                window.parent.postMessage(msg, '*');
              },
              onClose() { /* panel cleans itself up */ },
            });
          },
          onDismiss() {
            setMenuActive(false);
            repositionPanels();
          },
        });
        repositionPanels();
      } else {
        hideMenu();
        repositionPanels();
      }
    },
  });
  document.body.appendChild(toolbarEl);

  // Restore persisted empire dim state
  if (empireDimActive) {
    setEmpireActive(true);
    // Defer dim application until first data arrives (no owned systems yet)
  }

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

    updateSystemSelectionHalo();

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

    // System guard entity in system view while panel is open — don't close
    if (entity.type === 'system' && getViewLevel() === 'system' && isManagedPanelVisible()) return;
    // Other entity selection — close any APXM panel
    if (isManagedPanelVisible()) hideManagedPanel();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Skip if input is focused (same guard as Helm's controls)
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') {
      if (isMenuVisible()) {
        hideMenu();
        setMenuActive(false);
        return;
      }
      if (isFleetPanelVisible()) { hideFleetPanel(); return; }
      if (isBurnPanelVisible()) { hideBurnPanel(); return; }
      if (isManagedPanelVisible()) { hideManagedPanel(); return; }
    }

    if (e.key === 'E' || e.key === 'e') {
      const next = !isEmpireActive();
      setEmpireActive(next);
      toggleEmpireDim(next);
    }
  });

  // Drain all buffered messages: early (from main.ts) + pending (during Helm load)
  for (const event of earlyMessages) processMessage(event);
  for (const event of pendingMessages) processMessage(event);
  pendingMessages.length = 0;

  console.log('[APXM Shell] Map initialized with empire overlay');
}
