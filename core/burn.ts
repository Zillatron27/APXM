/**
 * Burn Rate Calculation Engine
 *
 * Computes daily material consumption/production for each site,
 * determines inventory runout times, and classifies urgency.
 */

import type { PrunApi } from '../types/prun-api';
import { useSettingsStore, type BurnThresholds } from '../stores/settings';
export type { BurnThresholds } from '../stores/settings';
import { getProductionBySiteId } from '../stores/entities/production';
import { getWorkforceBySiteId } from '../stores/entities/workforce';
import { getStorageByAddressableId } from '../stores/entities/storage';
import { useSitesStore } from '../stores/entities/sites';

// ============================================================================
// Types
// ============================================================================

export type BurnType = 'input' | 'output' | 'workforce';
export type Urgency = 'critical' | 'warning' | 'ok' | 'surplus';

export interface BurnRate {
  materialTicker: string;
  materialName?: string;
  dailyAmount: number; // negative = consuming, positive = producing
  type: BurnType;
  productionInput: number; // daily consumed by production (>= 0)
  productionOutput: number; // daily produced (>= 0)
  workforceConsumption: number; // daily consumed by workforce (>= 0)
  inventoryAmount: number;
  daysRemaining: number; // Infinity if not consuming
  need: number; // amount to buy to reach green threshold
  urgency: Urgency;
}

export interface SiteBurnSummary {
  siteId: string;
  siteName: string;
  burns: BurnRate[];
  mostUrgent: BurnRate | null;
  lastCalculated: number;
}

// ============================================================================
// Internal Types
// ============================================================================

interface ProductionRateEntry {
  input: number;
  output: number;
  name?: string;
}

interface WorkforceRateEntry {
  consumption: number;
  name?: string;
}

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

const MS_PER_DAY = 86400000;

/**
 * Returns recurring orders only if any exist, else all orders.
 * If ANY order is recurring, use ONLY recurring orders (steady-state production plan).
 */
export function getOrdersForCalculation(
  orders: PrunApi.ProductionOrder[]
): PrunApi.ProductionOrder[] {
  if (orders.length === 0) return [];
  const recurring = orders.filter((o) => o.recurring);
  return recurring.length > 0 ? recurring : orders;
}

/**
 * Calculates daily production input/output rates from production lines.
 * Returns a Map keyed by material ticker.
 */
export function calculateProductionRates(
  lines: PrunApi.ProductionLine[]
): Map<string, ProductionRateEntry> {
  const rates = new Map<string, ProductionRateEntry>();

  for (const line of lines) {
    const orders = getOrdersForCalculation(line.orders);
    if (orders.length === 0) continue;

    // Total cycle duration for relevant orders
    const totalDurationMs = orders.reduce(
      (sum, o) => sum + (o.duration?.millis ?? 0),
      0
    );
    if (totalDurationMs === 0) continue;

    const totalDurationDays = totalDurationMs / MS_PER_DAY;

    for (const order of orders) {
      // Process inputs
      for (const input of order.inputs) {
        const ticker = input.material.ticker;
        // dailyRate = (amount × capacity) / (totalDuration in days)
        const dailyRate = (input.amount * line.capacity) / totalDurationDays;

        const existing = rates.get(ticker) ?? { input: 0, output: 0 };
        existing.input += dailyRate;
        existing.name = existing.name ?? input.material.name;
        rates.set(ticker, existing);
      }

      // Process outputs
      for (const output of order.outputs) {
        const ticker = output.material.ticker;
        const dailyRate = (output.amount * line.capacity) / totalDurationDays;

        const existing = rates.get(ticker) ?? { input: 0, output: 0 };
        existing.output += dailyRate;
        existing.name = existing.name ?? output.material.name;
        rates.set(ticker, existing);
      }
    }
  }

  return rates;
}

/**
 * Calculates daily workforce consumption rates.
 * unitsPerInterval is already daily — do not multiply by time or population.
 */
export function calculateWorkforceConsumption(
  workforces: PrunApi.Workforce[]
): Map<string, WorkforceRateEntry> {
  const rates = new Map<string, WorkforceRateEntry>();

  for (const workforce of workforces) {
    for (const need of workforce.needs) {
      const ticker = need.material.ticker;
      // unitsPerInterval is already the daily rate
      const dailyRate = need.unitsPerInterval;

      const existing = rates.get(ticker) ?? { consumption: 0 };
      existing.consumption += dailyRate;
      existing.name = existing.name ?? need.material.name;
      rates.set(ticker, existing);
    }
  }

  return rates;
}

/**
 * Extracts inventory amounts from stores, filtering to STORE type only.
 * WAREHOUSE_STORE, SHIP_STORE do not count — game cannot draw workforce/production
 * consumables from them.
 */
export function getInventoryFromStores(
  stores: PrunApi.Store[]
): Map<string, number> {
  const inventory = new Map<string, number>();

  // ONLY type === 'STORE' counts for burn calculation
  const baseStores = stores.filter((s) => s.type === 'STORE');

  for (const store of baseStores) {
    for (const item of store.items) {
      if (item.quantity?.material?.ticker) {
        const ticker = item.quantity.material.ticker;
        const current = inventory.get(ticker) ?? 0;
        inventory.set(ticker, current + item.quantity.amount);
      }
    }
  }

  return inventory;
}

/**
 * Classifies the burn type for a material based on its activity.
 * Priority: output > input > workforce
 */
export function classifyBurnType(
  productionInput: number,
  productionOutput: number,
  workforceConsumption: number
): BurnType {
  const net = productionOutput - productionInput - workforceConsumption;

  if (net > 0) return 'output';
  if (productionInput > 0) return 'input';
  return 'workforce';
}

/**
 * Classifies urgency based on days remaining and net consumption rate.
 */
export function classifyUrgency(
  daysRemaining: number,
  netDailyAmount: number,
  thresholds: BurnThresholds
): Urgency {
  // Net positive = surplus
  if (netDailyAmount >= 0) return 'surplus';

  // Consuming — check thresholds
  if (daysRemaining <= thresholds.critical) return 'critical';
  if (daysRemaining <= thresholds.warning) return 'warning';
  return 'ok';
}

/**
 * Calculates how much material needs to be purchased to reach the green threshold.
 * greenThreshold = warning threshold (inventory should last at least this many days)
 */
export function calculateNeed(
  netDailyAmount: number,
  inventory: number,
  greenThreshold: number
): number {
  // Not consuming — no need
  if (netDailyAmount >= 0) return 0;

  // Need = (threshold × daily consumption) - current inventory
  const targetInventory = greenThreshold * Math.abs(netDailyAmount);
  return Math.max(0, targetInventory - inventory);
}

/**
 * Extracts a human-readable site name from an address.
 * Prefers planet name, falls back to naturalId, station, or 'Unknown'.
 */
export function getSiteNameFromAddress(address: PrunApi.Address): string {
  for (const line of address.lines) {
    if (line.type === 'PLANET' && line.entity) {
      return line.entity.name || line.entity.naturalId;
    }
  }

  for (const line of address.lines) {
    if (line.type === 'STATION' && line.entity) {
      return line.entity.name || line.entity.naturalId;
    }
  }

  // Fallback: first entity with a name
  for (const line of address.lines) {
    if (line.entity?.name) return line.entity.name;
    if (line.entity?.naturalId) return line.entity.naturalId;
  }

  return 'Unknown';
}

/**
 * Finds the most urgent burn rate from a list.
 * Prioritizes lowest daysRemaining, with 'input' prioritized over 'workforce' when tied.
 */
export function findMostUrgent(burns: BurnRate[]): BurnRate | null {
  const consuming = burns.filter(
    (b) => b.type === 'input' || b.type === 'workforce'
  );
  if (consuming.length === 0) return null;

  return consuming.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) {
      return a.daysRemaining - b.daysRemaining;
    }
    // Tie-breaker: 'input' before 'workforce'
    if (a.type === 'input' && b.type === 'workforce') return -1;
    if (a.type === 'workforce' && b.type === 'input') return 1;
    return 0;
  })[0];
}

// ============================================================================
// Main Entry Points
// ============================================================================

/**
 * Calculates burn rates for a single site.
 */
export function calculateSiteBurn(siteId: string): SiteBurnSummary {
  const thresholds = useSettingsStore.getState().burnThresholds;
  const site = useSitesStore.getState().getById(siteId);
  const siteName = site
    ? getSiteNameFromAddress(site.address)
    : 'Unknown Site';

  // Get data from stores
  const productionLines = getProductionBySiteId(siteId);
  const workforceEntity = getWorkforceBySiteId(siteId);
  const stores = getStorageByAddressableId(siteId);

  // Calculate rates
  const productionRates = calculateProductionRates(productionLines);
  const workforceRates = calculateWorkforceConsumption(
    workforceEntity?.workforces ?? []
  );
  const inventory = getInventoryFromStores(stores);

  // Collect all material tickers with any activity
  const allTickers = new Set<string>([
    ...productionRates.keys(),
    ...workforceRates.keys(),
  ]);

  const burns: BurnRate[] = [];

  for (const ticker of allTickers) {
    const production = productionRates.get(ticker) ?? { input: 0, output: 0 };
    const workforce = workforceRates.get(ticker) ?? { consumption: 0 };

    const productionInput = production.input;
    const productionOutput = production.output;
    const workforceConsumption = workforce.consumption;

    // Net daily amount: positive = producing, negative = consuming
    const dailyAmount =
      productionOutput - productionInput - workforceConsumption;

    const inventoryAmount = inventory.get(ticker) ?? 0;

    // Days remaining calculation
    let daysRemaining: number;
    if (dailyAmount >= 0) {
      daysRemaining = Infinity;
    } else {
      daysRemaining =
        inventoryAmount === 0 ? 0 : inventoryAmount / Math.abs(dailyAmount);
    }

    const type = classifyBurnType(
      productionInput,
      productionOutput,
      workforceConsumption
    );
    const urgency = classifyUrgency(daysRemaining, dailyAmount, thresholds);
    const need = calculateNeed(dailyAmount, inventoryAmount, thresholds.warning);

    // Get material name from either source
    const materialName = production.name ?? workforce.name;

    burns.push({
      materialTicker: ticker,
      materialName,
      dailyAmount,
      type,
      productionInput,
      productionOutput,
      workforceConsumption,
      inventoryAmount,
      daysRemaining,
      need,
      urgency,
    });
  }

  return {
    siteId,
    siteName,
    burns,
    mostUrgent: findMostUrgent(burns),
    lastCalculated: Date.now(),
  };
}

/**
 * Calculates burn rates for all sites.
 */
export function calculateAllBurns(): SiteBurnSummary[] {
  const sites = useSitesStore.getState().getAll();
  return sites.map((site) => calculateSiteBurn(site.siteId));
}
