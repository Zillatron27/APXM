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
  getFocusedSystemId, setGatewaysVisible,
} from '@27bit/helm';
import type { HelmInstance } from '@27bit/helm';
import { Graphics } from 'pixi.js';
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
import { createToolbar, setMenuActive, setEmpireActive, isEmpireActive, setGatewayActive, isGatewayActive, setBurnActive, isBurnActive, setFleetActive, isFleetActive, setWarehouseActive, getMenuButton, getWarehouseButton } from './ui/toolbar';
import { showWarehouseDropdown, hideWarehouseDropdown, isWarehouseDropdownVisible } from './ui/warehouse-dropdown';
import { showMenu, hideMenu, isMenuVisible } from './ui/menu';
import { showFleetPanel, hideFleetPanel, isFleetPanelVisible } from './ui/fleet-panel';
import { showBurnPanel, hideBurnPanel, isBurnPanelVisible } from './ui/burn-panel';
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

function frameToEmpire(helm: HelmInstance, naturalIds: string[]): void {
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

  helm.animateCamera({
    x: centreX, y: centreY, scale: targetScale,
    timeMs: FRAME_TRANSITION_MS,
  });
}

function restoreEmpireCamera(helm: HelmInstance): void {
  if (!empireCamera) return;

  helm.animateCamera({
    x: empireCamera.x, y: empireCamera.y, scale: empireCamera.scale,
    timeMs: FRAME_TRANSITION_MS,
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

  // Track whether initial empire framing has happened
  let initialFrameDone = false;

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
      if (!initialFrameDone) {
        frameToEmpire(helm!, empireState.getOwnedSystemNaturalIds());
        initialFrameDone = true;
      }
      // Re-apply empire dim with potentially new site data
      clearBrightCache();
      if (empireDimActive) applyEmpireDim();
    } else if (data.type === 'apxm-update') {
      const msg = data as ApxmUpdateMessage;
      empireState.applyUpdate(msg.update);
      if (msg.update.entityType === 'sites' || msg.update.entityType === 'workforce' || msg.update.entityType === 'warehouses') {
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
      setTimeout(() => helm!.hideNativePanel(), 0);
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

  // Create overlay layers via Bridge API — Helm manages z-ordering
  const empireGalaxyLayer = helm.createOverlayLayer('empire-galaxy', 10);
  empireGalaxyLayer.eventMode = 'none';
  const empireWarehouseLayer = helm.createOverlayLayer('empire-warehouse', 10.5);
  empireWarehouseLayer.eventMode = 'static';
  empireWarehouseLayer.interactiveChildren = true;
  const empireSystemLayer = helm.createOverlayLayer('empire-system', 20.5);
  empireSystemLayer.eventMode = 'none';
  overlay = createEmpireOverlay(empireGalaxyLayer, empireWarehouseLayer, empireSystemLayer, empireState, resolvers);

  helm.setGatewayIndicatorsVisible(false);
  const gatewayLayer = helm.createOverlayLayer('gateways', 11);
  gatewayMarkers = createGatewayMarkers(empireState);
  gatewayMarkers.refresh();
  gatewayLayer.addChild(gatewayMarkers.container);

  const idleLayer = helm.createOverlayLayer('ships-idle', 12);
  shipIdleMarkers = createShipIdleMarkers(empireState, shipCallbacks);
  shipIdleMarkers.refresh();
  idleLayer.addChild(shipIdleMarkers.container);

  const transitLayer = helm.createOverlayLayer('ships-transit', 13);
  shipTransit = createShipTransitLayer(empireState, resolvers, {
    worldToScreen: (wx, wy) => helm!.worldToScreen(wx, wy),
    getScale: () => helm!.getCameraState().scale,
  }, shipCallbacks);
  shipTransit.refresh();
  transitLayer.addChild(shipTransit.container);

  const sysViewLayer = helm.createOverlayLayer('ships-system', 20);
  shipSystemView = createShipSystemView(empireState, resolvers, shipCallbacks);
  shipSystemView.refresh();
  sysViewLayer.addChild(shipSystemView.container);

  const haloLayer = helm.createOverlayLayer('selection-halo', 21);
  const systemSelectionHalo = new Graphics();
  systemSelectionHalo.eventMode = 'none';
  systemSelectionHalo.visible = false;
  haloLayer.addChild(systemSelectionHalo);

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
  helm.onTick(() => {
    shipTransit!.tick();
    shipSystemView!.tick();

    // Update tooltip position for moving transit ships
    const worldPos = shipTransit!.getHoveredWorldPos();
    if (worldPos) {
      const screen = helm!.worldToScreen(worldPos.x, worldPos.y);
      updateTooltipPosition(screen.x, screen.y);
    }
  });

  // ============================================================================
  // Toolbar + Menu
  // ============================================================================

  function toggleFleetPanel(): void {
    if (isFleetPanelVisible()) {
      hideFleetPanel();
      setFleetActive(false);
            return;
    }
    showFleetPanel(empireState, {
      onBufferCommand(command) {
        window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
      },
      onShipClick(systemNaturalId, shipId) {
        const transitPos = shipTransit?.getShipWorldPosition(shipId) ?? null;
        const sys = getSystemByNaturalId(systemNaturalId);
        if (!sys && !transitPos) return;

        const targetX = transitPos?.x ?? sys!.worldX;
        const targetY = transitPos?.y ?? sys!.worldY;

        if (!preShipCamera) {
          const cam = helm!.getCameraState();
          preShipCamera = { x: cam.x, y: cam.y, scale: cam.scale };
        }

        helm!.animateCamera({
          x: targetX, y: targetY, scale: SHIP_ZOOM_SCALE,
          timeMs: FRAME_TRANSITION_MS,
        });

        shipIdleMarkers?.setSelectedShip(shipId);
        shipTransit?.setSelectedShip(shipId);
        shipSystemView?.setSelectedShip(shipId);
      },
      onClose() {
        shipIdleMarkers?.setSelectedShip(null);
        shipTransit?.setSelectedShip(null);
        shipSystemView?.setSelectedShip(null);
        if (preShipCamera) {
          helm!.animateCamera({
            x: preShipCamera.x, y: preShipCamera.y, scale: preShipCamera.scale,
            timeMs: FRAME_TRANSITION_MS,
          });
          preShipCamera = null;
        }
        setFleetActive(false);
              },
    });
      }

  function toggleBurnPanel(): void {
    if (isBurnPanelVisible()) {
      hideBurnPanel();
      setBurnActive(false);
            return;
    }
    showBurnPanel(empireState, {
      onBufferCommand(command) {
        window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
      },
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
      onClose() {
        setBurnActive(false);
              },
    });
      }

  const toolbarEl = createToolbar({
    onBurnToggle(active) {
      if (active) toggleBurnPanel();
      else { hideBurnPanel(); }
    },
    onFleetToggle(active) {
      if (active) toggleFleetPanel();
      else { hideFleetPanel(); }
    },
    onWarehouseToggle(active) {
      if (active) {
        const anchor = getWarehouseButton();
        if (!anchor) return;
        showWarehouseDropdown(anchor, empireState, {
          onBufferCommand(command) {
            window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
          },
          onDismiss() {
            setWarehouseActive(false);
          },
        });
      } else {
        hideWarehouseDropdown();
      }
    },
    onGatewayToggle(active) {
      setGatewaysVisible(active);
      helm!.setGatewaysVisible(active);
      helm!.setGatewayIndicatorsVisible(false);
    },
    onEmpireToggle(active) {
      toggleEmpireDim(active);
      if (active) {
        frameToEmpire(helm!, empireState.getOwnedSystemNaturalIds());
      }
    },
    onMenuToggle(active) {
      if (active) {
        const anchor = getMenuButton();
        if (!anchor) return;
        showMenu(anchor, {
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
              onRprunToggle(disabled) {
                const msg: ApxmSettingsUpdateMessage = {
                  type: 'apxm-settings-update',
                  settings: { rprunFeaturesDisabled: disabled },
                };
                window.parent.postMessage(msg, '*');
              },
              onClose() { /* panel cleans itself up */ },
            });
          },
          onDismiss() {
            setMenuActive(false);
                      },
        }, empireState);
      } else {
        hideMenu();
      }
    },
  });
  document.body.appendChild(toolbarEl);

  // Restore persisted empire dim state
  if (empireDimActive) {
    setEmpireActive(true);
    // Defer dim application until first data arrives (no owned systems yet)
  }

  // Restore persisted burn/fleet panel state
  if (isBurnActive()) toggleBurnPanel();
  if (isFleetActive()) toggleFleetPanel();

  // Bridge API: lifecycle events
  helm.onSystemViewEnter(() => {
    helm!.hideNativePanel();
  });

  helm.onSystemViewExit(() => {
    if (empireCamera) {
      restoreEmpireCamera(helm!);
      empireCamera = null;
    }
  });

  // Bridge API: planet click interception
  helm.onPlanetClick((planetNaturalId, screenX, screenY) => {
    const site = empireState.getSiteForPlanet(planetNaturalId);
    if (!site) return false;

    // Resolve planet display name
    const focusedId = getFocusedSystemId();
    if (!focusedId) return false;
    const system = getSystemById(focusedId);
    if (!system) return false;
    const planets = getPlanetsForSystem(system.naturalId);
    const planet = planets?.find(p => p.naturalId === planetNaturalId);
    const displayName = planet?.name || planetNaturalId;

    showBasePanel(planetNaturalId, displayName, screenX, screenY, empireState, {
      onBufferCommand(command) {
        window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
      },
      onScreenSwitch(screenId) {
        window.parent.postMessage({ type: 'apxm-screen-switch', screenId }, '*');
      },
      onScreenAssign(pNid, screenId) {
        empireState.setScreenAssignment(pNid, screenId);
        window.parent.postMessage({ type: 'apxm-screen-assign', planetNaturalId: pNid, screenId }, '*');
      },
      onClose() {},
    });
    return true;
  });

  // Entity selection drives panel lifecycle
  onStateChange(() => {
    updateSystemSelectionHalo();

    const entity = getSelectedEntity();

    if (entity === null) {
      // Deselection — close any APXM panel
      if (isManagedPanelVisible()) hideManagedPanel();
      return;
    }

    // System guard entity in system view while panel is open — don't close
    if (entity.type === 'system' && getViewLevel() === 'system' && isManagedPanelVisible()) return;
    // Other entity selection — close any APXM panel
    if (entity.type !== 'planet' && isManagedPanelVisible()) hideManagedPanel();
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
      if (isWarehouseDropdownVisible()) { hideWarehouseDropdown(); setWarehouseActive(false); return; }
      if (isFleetPanelVisible()) { hideFleetPanel(); setFleetActive(false); return; }
      if (isBurnPanelVisible()) { hideBurnPanel(); setBurnActive(false); return; }
      if (isManagedPanelVisible()) { hideManagedPanel(); return; }
    }

    if (e.key === 'B' || e.key === 'b') {
      toggleBurnPanel();
      setBurnActive(isBurnPanelVisible());
    }

    if (e.key === 'F' || e.key === 'f') {
      toggleFleetPanel();
      setFleetActive(isFleetPanelVisible());
    }

    if (e.key === 'W' || e.key === 'w') {
      if (isWarehouseDropdownVisible()) {
        hideWarehouseDropdown();
        setWarehouseActive(false);
      } else {
        const anchor = getWarehouseButton();
        if (anchor) {
          setWarehouseActive(true);
          showWarehouseDropdown(anchor, empireState, {
            onBufferCommand(command) {
              window.parent.postMessage({ type: 'apxm-buffer-command', command }, '*');
            },
            onDismiss() {
              setWarehouseActive(false);
            },
          });
        }
      }
    }

    if (e.key === 'G' || e.key === 'g') {
      const next = !isGatewayActive();
      setGatewayActive(next);
      setGatewaysVisible(next);
      helm!.setGatewaysVisible(next);
      helm!.setGatewayIndicatorsVisible(false);
    }

    if (e.key === 'E' || e.key === 'e') {
      const next = !isEmpireActive();
      setEmpireActive(next);
      toggleEmpireDim(next);
      if (next) {
        frameToEmpire(helm!, empireState.getOwnedSystemNaturalIds());
      }
    }
  });

  // Drain all buffered messages: early (from main.ts) + pending (during Helm load)
  for (const event of earlyMessages) processMessage(event);
  for (const event of pendingMessages) processMessage(event);
  pendingMessages.length = 0;

  console.log('[APXM Shell] Map initialized with empire overlay');
}
