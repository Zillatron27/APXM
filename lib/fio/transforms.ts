/**
 * FIO to PrunApi Type Transformations
 *
 * Converts FIO API responses (PascalCase, different structure) to PrunApi types
 * used by the entity stores.
 */

import type { PrunApi } from '../../types/prun-api';
import type { WorkforceEntity } from '../../stores/entities/workforce';
import type {
  FioWorkforce,
  FioWorkforceDescription,
  FioWorkforceNeed,
  FioProductionLine,
  FioProductionOrder,
  FioProductionMaterial,
  FioStorage,
  FioStorageItem,
  FioSite,
  FioSiteBuilding,
} from './types';

// ============================================================================
// Workforce Transforms
// ============================================================================

function transformWorkforceNeed(fioNeed: FioWorkforceNeed): PrunApi.Need {
  return {
    category: fioNeed.Category as PrunApi.NeedCategory,
    essential: fioNeed.Essential,
    material: {
      id: fioNeed.MaterialId,
      name: fioNeed.MaterialName,
      ticker: fioNeed.MaterialTicker,
      // FIO doesn't provide these, use defaults
      category: '',
      weight: 0,
      volume: 0,
      resource: false,
    },
    satisfaction: fioNeed.Satisfaction,
    unitsPerInterval: fioNeed.UnitsPerInterval,
    unitsPer100: fioNeed.UnitsPerOneHundred,
  };
}

function transformWorkforceDescription(
  fioWorkforce: FioWorkforceDescription
): PrunApi.Workforce {
  return {
    level: fioWorkforce.WorkforceTypeName,
    population: fioWorkforce.Population,
    reserve: fioWorkforce.Reserve,
    capacity: fioWorkforce.Capacity,
    required: fioWorkforce.Required,
    satisfaction: fioWorkforce.Satisfaction,
    needs: fioWorkforce.WorkforceNeeds.map(transformWorkforceNeed),
  };
}

/**
 * Transforms FIO workforce data to WorkforceEntity format used by stores.
 */
export function transformWorkforce(fioWorkforce: FioWorkforce): WorkforceEntity {
  return {
    siteId: fioWorkforce.SiteId,
    address: {
      lines: [
        {
          type: 'PLANET',
          entity: {
            id: fioWorkforce.PlanetId,
            naturalId: fioWorkforce.PlanetNaturalId,
            name: fioWorkforce.PlanetName,
          },
        },
      ],
    },
    workforces: fioWorkforce.Workforces.map(transformWorkforceDescription),
  };
}

export function transformAllWorkforce(fioWorkforces: FioWorkforce[]): WorkforceEntity[] {
  return fioWorkforces.map(transformWorkforce);
}

// ============================================================================
// Production Transforms
// ============================================================================

function transformProductionMaterial(
  fioMaterial: FioProductionMaterial
): PrunApi.MaterialAmountValue {
  return {
    material: {
      id: fioMaterial.MaterialId,
      name: fioMaterial.MaterialName,
      ticker: fioMaterial.MaterialTicker,
      category: '',
      weight: 0,
      volume: 0,
      resource: false,
    },
    amount: fioMaterial.MaterialAmount,
    value: { currency: '', amount: 0 },
  };
}

function transformProductionOrder(fioOrder: FioProductionOrder): PrunApi.ProductionOrder {
  return {
    id: fioOrder.ProductionLineOrderId,
    productionLineId: '', // Will be set by caller
    inputs: fioOrder.Inputs.map(transformProductionMaterial),
    outputs: fioOrder.Outputs.map(transformProductionMaterial),
    created: { timestamp: fioOrder.CreatedEpochMs ?? 0 },
    started: fioOrder.StartedEpochMs ? { timestamp: fioOrder.StartedEpochMs } : null,
    completion: fioOrder.CompletionEpochMs ? { timestamp: fioOrder.CompletionEpochMs } : null,
    duration: fioOrder.DurationMs ? { millis: fioOrder.DurationMs } : null,
    lastUpdated: fioOrder.LastUpdatedEpochMs
      ? { timestamp: fioOrder.LastUpdatedEpochMs }
      : null,
    completed: fioOrder.CompletedPercentage ?? 0,
    halted: fioOrder.IsHalted,
    recurring: fioOrder.Recurring,
    recipeId: fioOrder.StandardRecipeName,
    productionFee: {
      currency: fioOrder.ProductionFeeCurrency,
      amount: fioOrder.ProductionFee,
    },
    productionFeeCollector: {
      currency: {
        numericCode: 0,
        code: fioOrder.ProductionFeeCurrency,
        name: '',
        decimals: 2,
      },
    },
  };
}

/**
 * Transforms FIO production line to PrunApi.ProductionLine format.
 */
export function transformProductionLine(
  fioLine: FioProductionLine
): PrunApi.ProductionLine {
  const orders = fioLine.Orders.map((order) => {
    const transformed = transformProductionOrder(order);
    transformed.productionLineId = fioLine.ProductionLineId;
    return transformed;
  });

  return {
    id: fioLine.ProductionLineId,
    siteId: fioLine.SiteId,
    address: {
      lines: [
        {
          type: 'PLANET',
          entity: {
            id: fioLine.PlanetId,
            naturalId: fioLine.PlanetNaturalId,
            name: fioLine.PlanetName,
          },
        },
      ],
    },
    type: fioLine.Type,
    capacity: fioLine.Capacity,
    slots: fioLine.Capacity, // FIO doesn't distinguish, use capacity
    efficiency: fioLine.Efficiency,
    condition: fioLine.Condition,
    workforces: [], // FIO doesn't provide this at line level
    orders,
    productionTemplates: [], // FIO doesn't provide templates
    efficiencyFactors: [], // FIO doesn't provide factors
  };
}

export function transformAllProduction(
  fioLines: FioProductionLine[]
): PrunApi.ProductionLine[] {
  return fioLines.map(transformProductionLine);
}

// ============================================================================
// Storage Transforms
// ============================================================================

function transformStorageItem(fioItem: FioStorageItem): PrunApi.StoreItem {
  return {
    id: `${fioItem.MaterialId}-${fioItem.Type}`,
    type: fioItem.Type as 'INVENTORY' | 'SHIPMENT',
    weight: fioItem.TotalWeight,
    volume: fioItem.TotalVolume,
    quantity: {
      material: {
        id: fioItem.MaterialId,
        name: fioItem.MaterialName,
        ticker: fioItem.MaterialTicker,
        category: fioItem.MaterialCategory,
        weight: fioItem.MaterialWeight,
        volume: fioItem.MaterialVolume,
        resource: false,
      },
      amount: fioItem.MaterialAmount,
      value: {
        currency: fioItem.MaterialValueCurrency,
        amount: fioItem.MaterialValue,
      },
    },
  };
}

function mapStorageType(fioType: string): PrunApi.StoreType {
  const typeMap: Record<string, PrunApi.StoreType> = {
    STORE: 'STORE',
    SHIP_STORE: 'SHIP_STORE',
    STL_FUEL_STORE: 'STL_FUEL_STORE',
    FTL_FUEL_STORE: 'FTL_FUEL_STORE',
    WAREHOUSE_STORE: 'WAREHOUSE_STORE',
    CONSTRUCTION_STORE: 'CONSTRUCTION_STORE',
    UPKEEP_STORE: 'UPKEEP_STORE',
    VORTEX_FUEL_STORE: 'VORTEX_FUEL_STORE',
  };
  return typeMap[fioType] ?? 'STORE';
}

/**
 * Transforms FIO storage to PrunApi.Store format.
 */
export function transformStorage(fioStorage: FioStorage): PrunApi.Store {
  return {
    id: fioStorage.StorageId,
    addressableId: fioStorage.AddressableId,
    name: fioStorage.Name || null,
    weightLoad: fioStorage.WeightLoad,
    weightCapacity: fioStorage.WeightCapacity,
    volumeLoad: fioStorage.VolumeLoad,
    volumeCapacity: fioStorage.VolumeCapacity,
    items: fioStorage.StorageItems.map(transformStorageItem),
    fixed: fioStorage.FixedStore,
    tradeStore: false, // FIO doesn't provide this
    rank: 0, // FIO doesn't provide this
    locked: false, // FIO doesn't provide this
    type: mapStorageType(fioStorage.Type),
  };
}

export function transformAllStorage(fioStorages: FioStorage[]): PrunApi.Store[] {
  return fioStorages.map(transformStorage);
}

// ============================================================================
// Site Transforms
// ============================================================================

function transformSiteBuilding(fioBuilding: FioSiteBuilding): PrunApi.Platform {
  return {
    siteId: '', // Will be set by caller
    id: fioBuilding.SiteBuildingId,
    module: {
      id: fioBuilding.BuildingId,
      platformId: fioBuilding.SiteBuildingId,
      reactorId: fioBuilding.BuildingId,
      reactorName: fioBuilding.BuildingName,
      reactorTicker: fioBuilding.BuildingTicker,
      type: 'PRODUCTION', // FIO doesn't distinguish, default to PRODUCTION
    },
    area: 0, // FIO doesn't provide this
    creationTime: { timestamp: fioBuilding.BuildingCreated },
    reclaimableMaterials: fioBuilding.ReclaimableMaterials.map((m) => ({
      material: {
        id: '',
        name: '',
        ticker: m.CommodityTicker,
        category: '',
        weight: 0,
        volume: 0,
        resource: false,
      },
      amount: m.Amount,
    })),
    repairMaterials: fioBuilding.RepairMaterials.map((m) => ({
      material: {
        id: '',
        name: '',
        ticker: m.CommodityTicker,
        category: '',
        weight: 0,
        volume: 0,
        resource: false,
      },
      amount: m.Amount,
    })),
    repairMaterials24: [],
    repairMaterials48: [],
    bookValue: { currency: '', amount: 0 },
    condition: fioBuilding.Condition,
    lastRepair: fioBuilding.BuildingLastRepair
      ? { timestamp: fioBuilding.BuildingLastRepair }
      : null,
  };
}

/**
 * Transforms FIO site to PrunApi.Site format.
 *
 * Note: FIO site data is less complete than WebSocket data.
 * buildOptions will be empty since FIO doesn't provide available build options.
 */
export function transformSite(fioSite: FioSite): PrunApi.Site {
  const platforms = fioSite.Buildings.map((building) => {
    const platform = transformSiteBuilding(building);
    platform.siteId = fioSite.SiteId;
    return platform;
  });

  return {
    siteId: fioSite.SiteId,
    address: {
      lines: [
        {
          type: 'PLANET',
          entity: {
            id: fioSite.PlanetId,
            naturalId: fioSite.PlanetIdentifier,
            name: fioSite.PlanetName,
          },
        },
      ],
    },
    founded: { timestamp: fioSite.PlanetFoundedEpochMs },
    platforms,
    buildOptions: { options: [] }, // FIO doesn't provide build options
    area: 0, // FIO doesn't provide total area
    investedPermits: fioSite.InvestedPermits,
    maximumPermits: fioSite.MaximumPermits,
  };
}

export function transformAllSites(fioSites: FioSite[]): PrunApi.Site[] {
  return fioSites.map(transformSite);
}
