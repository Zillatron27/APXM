/**
 * Empire State Manager
 *
 * In-memory store of empire data on the shell side.
 * Receives snapshots and incremental updates from the bridge,
 * derives owned systems and burn status for overlay rendering.
 */

import type {
  BridgeSnapshot, BridgeUpdate, WorkforceSummary, ShipSummary, FlightSummary,
  SiteSummary, ProductionSummary, StorageSummary, ScreenInfo, BurnThresholds,
} from './types/bridge';

const BURN_PRIORITY: Record<WorkforceSummary['burnStatus'], number> = {
  critical: 3,
  warning: 2,
  unknown: 1,
  ok: 0,
};

export interface EmpireState {
  applySnapshot(snapshot: BridgeSnapshot): void;
  applyUpdate(update: BridgeUpdate): void;
  getOwnedSystemNaturalIds(): string[];
  getOwnedPlanetNaturalIds(systemNaturalId: string): string[];
  getSystemBurnStatus(systemNaturalId: string): 'critical' | 'warning' | 'ok' | 'unknown';
  getPlanetBurnStatus(planetNaturalId: string): 'critical' | 'warning' | 'ok' | 'unknown';
  getShipsInSystem(systemNaturalId: string): ShipSummary[];
  getInTransitShips(): Array<{ ship: ShipSummary; flight: FlightSummary }>;
  getFlightForShip(shipId: string): FlightSummary | undefined;
  getIdleShipsBySystem(): Map<string, ShipSummary[]>;
  getIdleShipsByPlanet(systemNaturalId: string): Map<string, ShipSummary[]>;
  getSiteForPlanet(planetNaturalId: string): SiteSummary | undefined;
  getProductionForPlanet(planetNaturalId: string): ProductionSummary | undefined;
  getWorkforceForPlanet(planetNaturalId: string): WorkforceSummary | undefined;
  getStorageForSite(siteId: string): StorageSummary | undefined;
  getScreens(): ScreenInfo[];
  getAssignedScreenIdForPlanet(planetNaturalId: string): string | null;
  getAssignedScreenForPlanet(planetNaturalId: string): ScreenInfo | null;
  setScreenAssignment(planetNaturalId: string, screenId: string | null): void;
  getBurnThresholds(): BurnThresholds;
  setBurnThresholds(thresholds: BurnThresholds): void;
  onChange(callback: () => void): () => void;
}

export function createEmpireState(): EmpireState {
  const DEFAULT_BURN_THRESHOLDS: BurnThresholds = { critical: 3, warning: 5, resupply: 30 };

  let state: BridgeSnapshot = {
    sites: [],
    ships: [],
    flights: [],
    storage: [],
    production: [],
    workforce: [],
    contracts: [],
    balances: [],
    screens: [],
    screenAssignments: {},
    burnThresholds: DEFAULT_BURN_THRESHOLDS,
    timestamp: 0,
  };

  const listeners: Array<() => void> = [];

  function notify(): void {
    for (const cb of listeners) cb();
  }

  function applySnapshot(snapshot: BridgeSnapshot): void {
    state = snapshot;
    notify();
  }

  function applyUpdate(update: BridgeUpdate): void {
    // entityType is a known key of BridgeSnapshot (excluding 'timestamp')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state as any)[update.entityType] = update.data;
    state.timestamp = update.timestamp;
    notify();
  }

  function getOwnedSystemNaturalIds(): string[] {
    const ids = new Set<string>();
    for (const site of state.sites) {
      if (site.systemNaturalId) ids.add(site.systemNaturalId);
    }
    return Array.from(ids);
  }

  function getOwnedPlanetNaturalIds(systemNaturalId: string): string[] {
    const ids: string[] = [];
    for (const site of state.sites) {
      if (site.systemNaturalId === systemNaturalId && site.planetNaturalId) {
        ids.push(site.planetNaturalId);
      }
    }
    return ids;
  }

  function getPlanetBurnStatus(
    planetNaturalId: string,
  ): 'critical' | 'warning' | 'ok' | 'unknown' {
    let worst: WorkforceSummary['burnStatus'] | null = null;
    for (const wf of state.workforce) {
      if (wf.planetNaturalId !== planetNaturalId) continue;
      if (worst === null || BURN_PRIORITY[wf.burnStatus] > BURN_PRIORITY[worst]) {
        worst = wf.burnStatus;
      }
    }
    return worst ?? 'unknown';
  }

  function getSystemBurnStatus(
    systemNaturalId: string,
  ): 'critical' | 'warning' | 'ok' | 'unknown' {
    let worst: WorkforceSummary['burnStatus'] | null = null;
    for (const wf of state.workforce) {
      if (wf.systemNaturalId !== systemNaturalId) continue;
      if (worst === null || BURN_PRIORITY[wf.burnStatus] > BURN_PRIORITY[worst]) {
        worst = wf.burnStatus;
      }
    }
    return worst ?? 'unknown';
  }

  function getShipsInSystem(systemNaturalId: string): ShipSummary[] {
    const flightShipIds = new Set(state.flights.map((f) => f.shipId));
    return state.ships.filter(
      (s) => s.locationSystemNaturalId === systemNaturalId && !flightShipIds.has(s.shipId),
    );
  }

  function getInTransitShips(): Array<{ ship: ShipSummary; flight: FlightSummary }> {
    const pairs: Array<{ ship: ShipSummary; flight: FlightSummary }> = [];
    for (const flight of state.flights) {
      const ship = state.ships.find((s) => s.shipId === flight.shipId);
      if (ship) pairs.push({ ship, flight });
    }
    return pairs;
  }

  function getFlightForShip(shipId: string): FlightSummary | undefined {
    return state.flights.find((f) => f.shipId === shipId);
  }

  function getIdleShipsBySystem(): Map<string, ShipSummary[]> {
    const flightShipIds = new Set(state.flights.map((f) => f.shipId));
    const bySystem = new Map<string, ShipSummary[]>();
    for (const ship of state.ships) {
      if (!ship.locationSystemNaturalId || flightShipIds.has(ship.shipId)) continue;
      const existing = bySystem.get(ship.locationSystemNaturalId);
      if (existing) {
        existing.push(ship);
      } else {
        bySystem.set(ship.locationSystemNaturalId, [ship]);
      }
    }
    return bySystem;
  }

  function getIdleShipsByPlanet(systemNaturalId: string): Map<string, ShipSummary[]> {
    const ships = getShipsInSystem(systemNaturalId);
    const byPlanet = new Map<string, ShipSummary[]>();
    for (const ship of ships) {
      const key = ship.locationPlanetNaturalId ?? '';
      const existing = byPlanet.get(key);
      if (existing) {
        existing.push(ship);
      } else {
        byPlanet.set(key, [ship]);
      }
    }
    return byPlanet;
  }

  function getSiteForPlanet(planetNaturalId: string): SiteSummary | undefined {
    return state.sites.find((s) => s.planetNaturalId === planetNaturalId);
  }

  function getProductionForPlanet(planetNaturalId: string): ProductionSummary | undefined {
    return state.production.find((p) => p.planetNaturalId === planetNaturalId);
  }

  function getWorkforceForPlanet(planetNaturalId: string): WorkforceSummary | undefined {
    return state.workforce.find((w) => w.planetNaturalId === planetNaturalId);
  }

  function getStorageForSite(siteId: string): StorageSummary | undefined {
    return state.storage.find((s) => s.addressableId === siteId && s.type === 'STORE');
  }

  function getScreens(): ScreenInfo[] {
    return state.screens;
  }

  function getAssignedScreenIdForPlanet(planetNaturalId: string): string | null {
    return state.screenAssignments[planetNaturalId] ?? null;
  }

  function getAssignedScreenForPlanet(planetNaturalId: string): ScreenInfo | null {
    const screenId = state.screenAssignments[planetNaturalId];
    if (!screenId) return null;
    return state.screens.find((s) => s.id === screenId) ?? null;
  }

  function setScreenAssignment(planetNaturalId: string, screenId: string | null): void {
    if (screenId) {
      state.screenAssignments[planetNaturalId] = screenId;
    } else {
      delete state.screenAssignments[planetNaturalId];
    }
    notify();
  }

  function getBurnThresholds(): BurnThresholds {
    return state.burnThresholds;
  }

  function setBurnThresholds(thresholds: BurnThresholds): void {
    state.burnThresholds = thresholds;
    notify();
  }

  function onChange(callback: () => void): () => void {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  return {
    applySnapshot, applyUpdate, getOwnedSystemNaturalIds, getOwnedPlanetNaturalIds,
    getSystemBurnStatus, getPlanetBurnStatus,
    getShipsInSystem, getInTransitShips, getFlightForShip, getIdleShipsBySystem, getIdleShipsByPlanet,
    getSiteForPlanet, getProductionForPlanet, getWorkforceForPlanet, getStorageForSite,
    getScreens, getAssignedScreenIdForPlanet, getAssignedScreenForPlanet, setScreenAssignment,
    getBurnThresholds, setBurnThresholds,
    onChange,
  };
}
