/**
 * Repair Status Calculation Engine
 *
 * Computes the age and condition of the oldest repairable building per site.
 * Urgency classification is settings-driven (threshold/offset), mirroring the
 * burn thresholds pattern.
 *
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM),
 * MIT licensed — credit jackinabox86. Changes: urgency classification reads
 * user-configurable thresholds instead of hardcoded 60/50 days.
 */

import type { PrunApi } from '../types/prun-api';
import { useSitesStore } from '../stores/entities/sites';
import type { RepairThresholds } from '../stores/settings';

// ============================================================================
// Types
// ============================================================================

export interface RepairStatusSummary {
  siteId: string;
  /** Days since the oldest building was last repaired (or built). Null if no repairable buildings. */
  oldestBuildingAgeDays: number | null;
  /** Condition (0–1) of the oldest building. Null if no repairable buildings. */
  oldestBuildingCondition: number | null;
}

/** Per-building repair detail for one site (the repair drill-down sheet). */
export interface BuildingRepairStatus {
  /** Platform id. */
  id: string;
  /** Building ticker (e.g. "SME"). */
  ticker: string;
  /** Full building name (e.g. "Smelter"). */
  name: string;
  /** Days since this building was last repaired (or built). */
  ageDays: number;
  /** Building condition, 0–1. */
  condition: number;
}

export type RepairUrgency = 'critical' | 'warning' | 'ok';

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

const MS_PER_DAY = 86400000;

/**
 * Returns true for building types that are eligible for repair.
 * Only PRODUCTION and RESOURCES buildings degrade in a way that needs
 * repairing — CORE, HABITATION, and STORAGE are excluded (domain rule,
 * confirmed 2026-06-10, #24).
 */
export function isRepairableBuilding(platform: PrunApi.Platform): boolean {
  return platform.module.type === 'RESOURCES' || platform.module.type === 'PRODUCTION';
}

/**
 * Returns the timestamp (ms) of the last repair, or creation time if never repaired.
 */
export function getBuildingLastRepairTimestamp(platform: PrunApi.Platform): number {
  return platform.lastRepair?.timestamp ?? platform.creationTime.timestamp;
}

/**
 * Classifies a repair age against the user's thresholds:
 * red at >= threshold days, yellow within `offset` days of it.
 */
export function classifyRepairUrgency(
  ageDays: number,
  thresholds: RepairThresholds
): RepairUrgency {
  if (ageDays >= thresholds.threshold) return 'critical';
  if (ageDays >= thresholds.threshold - thresholds.offset) return 'warning';
  return 'ok';
}

// ============================================================================
// Main Entry Points
// ============================================================================

/**
 * Calculates repair status for a single site.
 * "Oldest" means the building with the earliest last-repair (or creation)
 * timestamp, i.e. the one that has gone the longest without repair.
 */
export function calculateSiteRepairStatus(siteId: string): RepairStatusSummary {
  const site = useSitesStore.getState().getById(siteId);
  const repairable = (site?.platforms ?? []).filter(isRepairableBuilding);

  if (repairable.length === 0) {
    return { siteId, oldestBuildingAgeDays: null, oldestBuildingCondition: null };
  }

  let oldestPlatform = repairable[0];
  let oldestTimestamp = getBuildingLastRepairTimestamp(repairable[0]);

  for (let i = 1; i < repairable.length; i++) {
    const ts = getBuildingLastRepairTimestamp(repairable[i]);
    if (ts < oldestTimestamp) {
      oldestTimestamp = ts;
      oldestPlatform = repairable[i];
    }
  }

  return {
    siteId,
    oldestBuildingAgeDays: (Date.now() - oldestTimestamp) / MS_PER_DAY,
    oldestBuildingCondition: oldestPlatform.condition,
  };
}

/**
 * Calculates repair status for all sites.
 */
export function calculateAllRepairStatuses(): RepairStatusSummary[] {
  const sites = useSitesStore.getState().getAll();
  return sites.map((site) => calculateSiteRepairStatus(site.siteId));
}

/**
 * Per-building repair detail for one site, oldest-since-repair first. Only
 * repairable buildings (PRODUCTION/RESOURCES) are included.
 */
export function calculateSiteRepairBuildings(siteId: string): BuildingRepairStatus[] {
  const site = useSitesStore.getState().getById(siteId);
  const now = Date.now();

  return (site?.platforms ?? [])
    .filter(isRepairableBuilding)
    .map((p) => ({
      id: p.id,
      ticker: p.module.reactorTicker,
      name: p.module.reactorName,
      ageDays: (now - getBuildingLastRepairTimestamp(p)) / MS_PER_DAY,
      condition: p.condition,
    }))
    .sort((a, b) => b.ageDays - a.ageDays);
}
