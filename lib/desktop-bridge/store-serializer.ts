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
              stlWeightUsed: stlFuelStore.weightLoad,
              stlWeightCapacity: stlFuelStore.weightCapacity,
              ftlWeightUsed: ftlFuelStore.weightLoad,
              ftlWeightCapacity: ftlFuelStore.weightCapacity,
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

    let activeLines = 0;
    let idleLines = 0;
    let nextCompletion: number | null = null;

    for (const line of lines) {
      const hasActiveOrder = line.orders.some(
        (o) => o.started !== null && o.completion !== null && !o.halted
      );
      if (hasActiveOrder) {
        activeLines++;
        // Find earliest completion across active orders
        for (const order of line.orders) {
          if (order.completion !== null && !order.halted) {
            const ts = order.completion.timestamp;
            if (nextCompletion === null || ts < nextCompletion) {
              nextCompletion = ts;
            }
          }
        }
      } else {
        idleLines++;
      }
    }

    summaries.push({
      siteId,
      planetNaturalId: planet?.naturalId ?? null,
      systemNaturalId,
      totalLines: lines.length,
      activeLines,
      idleLines,
      nextCompletionTimestamp: nextCompletion,
    });
  }

  return summaries;
}

export function deriveWorkforceSummaries(): WorkforceSummary[] {
  return useWorkforceStore.getState().getAll().map((entity) => {
    const planet = extractPlanetInfo(entity.address);
    const systemNaturalId = extractSystemNaturalId(entity.address);

    // Overall satisfaction: average across workforce levels with population > 0
    const populated = entity.workforces.filter((w) => w.population > 0);
    const overallSatisfaction = populated.length > 0
      ? populated.reduce((sum, w) => sum + w.satisfaction, 0) / populated.length
      : 1;

    // Use burn engine for status
    let burnStatus: WorkforceSummary['burnStatus'] = 'unknown';
    let lowestBurnDays: number | null = null;
    try {
      const siteBurn = calculateSiteBurn(entity.siteId);
      const workforceBurns = siteBurn.burns.filter((b) => b.type === 'workforce');
      if (workforceBurns.length > 0) {
        const lowest = Math.min(...workforceBurns.map((b) => b.daysRemaining));
        lowestBurnDays = lowest === Infinity ? null : lowest;
        if (lowestBurnDays !== null) {
          if (lowestBurnDays <= 3) burnStatus = 'critical';
          else if (lowestBurnDays <= 7) burnStatus = 'warning';
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

/** Creates a full snapshot from all entity stores. */
export function createSnapshot(): BridgeSnapshot {
  return {
    sites: deriveSiteSummaries(),
    ships: deriveShipSummaries(),
    flights: deriveFlightSummaries(),
    storage: deriveStorageSummaries(),
    production: deriveProductionSummaries(),
    workforce: deriveWorkforceSummaries(),
    contracts: deriveContractSummaries(),
    balances: deriveBalances(),
    timestamp: Date.now(),
  };
}
