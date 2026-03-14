/**
 * Store Serializer
 *
 * Pure functions that derive flat, serializable bridge summaries from
 * entity stores. No side effects — fully unit-testable.
 */

import type { PrunApi } from '../../types/prun-api';
import type {
  SiteSummary,
  ShipSummary,
  FlightSummary,
  CargoItem,
  StorageSummary,
  ProductionSummary,
  WorkforceSummary,
  ContractSummary,
  CurrencyAmount,
  ScreenInfo,
  BridgeSnapshot,
} from '../../types/bridge';
import { useSitesStore } from '../../stores/entities/sites';
import { useShipsStore } from '../../stores/entities/ships';
import { useFlightsStore } from '../../stores/entities/flights';
import { useStorageStore } from '../../stores/entities/storage';
import { useProductionStore } from '../../stores/entities/production';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useContractsStore } from '../../stores/entities/contracts';
import { useBalancesStore } from '../../stores/entities/balances';
import { useScreensStore } from '../../stores/screens';
import { useSettingsStore } from '../../stores/settings';
import { useCompanyStore } from '../../stores/company';
import { calculateSiteBurn } from '../../core/burn';

// ============================================================================
// Address Resolution Helpers
// ============================================================================

export interface PlanetInfo {
  name: string;
  naturalId: string;
}

/** Extracts planet name and naturalId from an address, or null if no PLANET line. */
export function extractPlanetInfo(address: PrunApi.Address): PlanetInfo | null {
  for (const line of address.lines) {
    if (line.type === 'PLANET' && line.entity) {
      return { name: line.entity.name, naturalId: line.entity.naturalId };
    }
  }
  return null;
}

/** Extracts the SYSTEM naturalId from an address, or null if no SYSTEM line. */
export function extractSystemNaturalId(address: PrunApi.Address): string | null {
  for (const line of address.lines) {
    if (line.type === 'SYSTEM' && line.entity) {
      return line.entity.naturalId;
    }
  }
  return null;
}

/** Sums the quantity amounts of all items in a store (fuel unit count). */
function sumItemUnits(items: PrunApi.StoreItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.quantity) total += item.quantity.amount;
  }
  return total;
}

/** Derives unit capacity from store weight capacity and per-unit material weight. */
function deriveUnitCapacity(store: PrunApi.Store): number {
  const perUnit = store.items.find((i) => i.quantity)?.quantity?.material.weight;
  if (perUnit && perUnit > 0) return Math.floor(store.weightCapacity / perUnit);
  return 0;
}

// ============================================================================
// Derive Functions
// ============================================================================

export function deriveSiteSummaries(): SiteSummary[] {
  return useSitesStore.getState().getAll().map((site) => {
    const planet = extractPlanetInfo(site.address);
    return {
      siteId: site.siteId,
      planetName: planet?.name ?? null,
      planetNaturalId: planet?.naturalId ?? null,
      systemNaturalId: extractSystemNaturalId(site.address),
      platformCount: site.platforms.length,
      area: site.area,
    };
  });
}

/** Maps store items to CargoItem[], filtering out items with no quantity. */
export function deriveCargoItems(items: PrunApi.StoreItem[]): CargoItem[] {
  const result: CargoItem[] = [];
  for (const item of items) {
    if (!item.quantity) continue;
    result.push({
      ticker: item.quantity.material.ticker,
      category: item.quantity.material.category,
      amount: item.quantity.amount,
      weight: item.weight,
      volume: item.volume,
    });
  }
  return result;
}

export function deriveShipSummaries(): ShipSummary[] {
  const storageState = useStorageStore.getState();

  return useShipsStore.getState().getAll().map((ship) => {
    const cargoStore = storageState.getById(ship.idShipStore);
    const stlFuelStore = storageState.getById(ship.idStlFuelStore);
    const ftlFuelStore = storageState.getById(ship.idFtlFuelStore);

    return {
      shipId: ship.id,
      name: ship.name,
      registration: ship.registration,
      blueprintNaturalId: ship.blueprintNaturalId,
      condition: ship.condition,
      status: ship.status,
      locationSystemNaturalId: ship.address
        ? extractSystemNaturalId(ship.address)
        : null,
      locationPlanetNaturalId: ship.address
        ? extractPlanetInfo(ship.address)?.naturalId ?? null
        : null,
      cargo: cargoStore
        ? {
            weightUsed: cargoStore.weightLoad,
            weightCapacity: cargoStore.weightCapacity,
            volumeUsed: cargoStore.volumeLoad,
            volumeCapacity: cargoStore.volumeCapacity,
            items: deriveCargoItems(cargoStore.items),
          }
        : null,
      fuel:
        stlFuelStore && ftlFuelStore
          ? {
              stlUnits: sumItemUnits(stlFuelStore.items),
              stlUnitCapacity: deriveUnitCapacity(stlFuelStore),
              ftlUnits: sumItemUnits(ftlFuelStore.items),
              ftlUnitCapacity: deriveUnitCapacity(ftlFuelStore),
            }
          : null,
    };
  });
}

export function deriveFlightSummaries(): FlightSummary[] {
  return useFlightsStore.getState().getAll().map((flight) => ({
    flightId: flight.id,
    shipId: flight.shipId,
    originSystemNaturalId: extractSystemNaturalId(flight.origin),
    destinationSystemNaturalId: extractSystemNaturalId(flight.destination),
    originPlanetNaturalId: extractPlanetInfo(flight.origin)?.naturalId ?? null,
    destinationPlanetNaturalId: extractPlanetInfo(flight.destination)?.naturalId ?? null,
    departureTimestamp: flight.departure.timestamp,
    arrivalTimestamp: flight.arrival.timestamp,
    segments: flight.segments.map((seg) => ({
      type: seg.type,
      originSystemNaturalId: extractSystemNaturalId(seg.origin),
      destinationSystemNaturalId: extractSystemNaturalId(seg.destination),
      originPlanetNaturalId: extractPlanetInfo(seg.origin)?.naturalId ?? null,
      destinationPlanetNaturalId: extractPlanetInfo(seg.destination)?.naturalId ?? null,
      departureTimestamp: seg.departure.timestamp,
      arrivalTimestamp: seg.arrival.timestamp,
    })),
    currentSegmentIndex: flight.currentSegmentIndex,
  }));
}

export function deriveStorageSummaries(): StorageSummary[] {
  return useStorageStore.getState().getAll().map((store) => ({
    storageId: store.id,
    addressableId: store.addressableId,
    type: store.type,
    weightUsed: store.weightLoad,
    weightCapacity: store.weightCapacity,
    volumeUsed: store.volumeLoad,
    volumeCapacity: store.volumeCapacity,
  }));
}

export function deriveProductionSummaries(): ProductionSummary[] {
  // Group production lines by siteId
  const bySite = new Map<string, PrunApi.ProductionLine[]>();
  for (const line of useProductionStore.getState().getAll()) {
    const existing = bySite.get(line.siteId);
    if (existing) {
      existing.push(line);
    } else {
      bySite.set(line.siteId, [line]);
    }
  }

  const summaries: ProductionSummary[] = [];
  for (const [siteId, lines] of bySite) {
    // Use the first line's address for location (all lines at same site share address)
    const firstLine = lines[0];
    const planet = extractPlanetInfo(firstLine.address);
    const systemNaturalId = extractSystemNaturalId(firstLine.address);

    let totalCapacity = 0;
    let activeCount = 0;
    let nextCompletion: number | null = null;

    for (const line of lines) {
      totalCapacity += line.capacity;
      // Count orders that are actively producing
      for (const order of line.orders) {
        if (order.started !== null && !order.halted) {
          activeCount++;
          if (order.completion !== null) {
            const ts = order.completion.timestamp;
            if (nextCompletion === null || ts < nextCompletion) {
              nextCompletion = ts;
            }
          }
        }
      }
    }

    summaries.push({
      siteId,
      planetNaturalId: planet?.naturalId ?? null,
      systemNaturalId,
      totalLines: totalCapacity,
      activeLines: activeCount,
      idleLines: totalCapacity - activeCount,
      nextCompletionTimestamp: nextCompletion,
    });
  }

  return summaries;
}

export function deriveWorkforceSummaries(): WorkforceSummary[] {
  const { burnThresholds } = useSettingsStore.getState();

  return useWorkforceStore.getState().getAll().map((entity) => {
    const planet = extractPlanetInfo(entity.address);
    const systemNaturalId = extractSystemNaturalId(entity.address);

    // Overall satisfaction: average across workforce levels with population > 0
    const populated = entity.workforces.filter((w) => w.population > 0);
    const overallSatisfaction = populated.length > 0
      ? populated.reduce((sum, w) => sum + w.satisfaction, 0) / populated.length
      : 1;

    // Use burn engine for status, with user-configured thresholds
    let burnStatus: WorkforceSummary['burnStatus'] = 'unknown';
    let lowestBurnDays: number | null = null;
    try {
      const siteBurn = calculateSiteBurn(entity.siteId);
      const consumingBurns = siteBurn.burns.filter((b) => b.type === 'workforce' || b.type === 'input');
      if (consumingBurns.length > 0) {
        const lowest = Math.min(...consumingBurns.map((b) => b.daysRemaining));
        lowestBurnDays = lowest === Infinity ? null : lowest;
        if (lowestBurnDays !== null) {
          if (lowestBurnDays <= burnThresholds.critical) burnStatus = 'critical';
          else if (lowestBurnDays <= burnThresholds.warning) burnStatus = 'warning';
          else burnStatus = 'ok';
        } else {
          burnStatus = 'ok';
        }
      }
    } catch {
      // Burn calculation may fail if stores are partially populated
    }

    return {
      siteId: entity.siteId,
      planetNaturalId: planet?.naturalId ?? null,
      systemNaturalId,
      overallSatisfaction,
      burnStatus,
      lowestBurnDays,
    };
  });
}

export function deriveContractSummaries(): ContractSummary[] {
  return useContractsStore.getState().getAll().map((contract) => {
    const dueDateTimestamp = contract.dueDate?.timestamp ?? null;
    const isOverdue = dueDateTimestamp !== null && dueDateTimestamp < Date.now();
    return {
      contractId: contract.id,
      localId: contract.localId,
      partnerName: contract.partner.name,
      status: contract.status,
      dueDateTimestamp,
      isOverdue,
    };
  });
}

export function deriveBalances(): CurrencyAmount[] {
  return useBalancesStore.getState().getAll().map((b) => ({
    currency: b.currency,
    amount: b.amount,
  }));
}

export function deriveScreens(): ScreenInfo[] {
  return useScreensStore.getState().screens.map((s) => ({
    id: s.id,
    name: s.name,
    hidden: s.hidden,
  }));
}

export function deriveBurnThresholds(): BridgeSnapshot['burnThresholds'] {
  const { burnThresholds } = useSettingsStore.getState();
  return { ...burnThresholds };
}

// Faction → primary currency mapping (countryId values need verification against live data)
const COUNTRY_CURRENCY: Record<string, string> = {
  'AI': 'AIC',
  'CI': 'CIS',
  'IC': 'ICA',
  'NC': 'NCC',
};

export function deriveCompanyInfo(): { companyName: string | null; primaryCurrency: string | null } {
  const company = useCompanyStore.getState().company;
  if (!company) return { companyName: null, primaryCurrency: null };
  return {
    companyName: company.name,
    primaryCurrency: COUNTRY_CURRENCY[company.countryId] ?? null,
  };
}

/** Creates a full snapshot from all entity stores. */
export function createSnapshot(): BridgeSnapshot {
  const { companyName, primaryCurrency } = deriveCompanyInfo();
  return {
    sites: deriveSiteSummaries(),
    ships: deriveShipSummaries(),
    flights: deriveFlightSummaries(),
    storage: deriveStorageSummaries(),
    production: deriveProductionSummaries(),
    workforce: deriveWorkforceSummaries(),
    contracts: deriveContractSummaries(),
    balances: deriveBalances(),
    screens: deriveScreens(),
    screenAssignments: { ...useScreensStore.getState().screenAssignments },
    burnThresholds: deriveBurnThresholds(),
    companyName,
    primaryCurrency,
    timestamp: Date.now(),
  };
}
