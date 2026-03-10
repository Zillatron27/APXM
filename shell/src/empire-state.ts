/**
 * Empire State Manager
 *
 * In-memory store of empire data on the shell side.
 * Receives snapshots and incremental updates from the bridge,
 * derives owned systems and burn status for overlay rendering.
 */

import type { BridgeSnapshot, BridgeUpdate, WorkforceSummary } from './types/bridge';

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
  onChange(callback: () => void): () => void;
}

export function createEmpireState(): EmpireState {
  let state: BridgeSnapshot = {
    sites: [],
    ships: [],
    flights: [],
    storage: [],
    production: [],
    workforce: [],
    contracts: [],
    balances: [],
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

  function onChange(callback: () => void): () => void {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  return {
    applySnapshot, applyUpdate, getOwnedSystemNaturalIds, getOwnedPlanetNaturalIds,
    getSystemBurnStatus, getPlanetBurnStatus, onChange,
  };
}
