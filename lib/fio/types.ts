/**
 * FIO REST API Response Types
 *
 * These types match the JSON responses from rest.fnar.net endpoints.
 * FIO uses PascalCase naming convention.
 */

// ============================================================================
// Workforce Endpoint Types
// ============================================================================

export interface FioWorkforceNeed {
  Category: string;
  Essential: boolean;
  MaterialId: string;
  MaterialName: string;
  MaterialTicker: string;
  Satisfaction: number;
  UnitsPerInterval: number;
  UnitsPerOneHundred: number;
}

export interface FioWorkforceDescription {
  WorkforceTypeName: string; // PIONEER, SETTLER, TECHNICIAN, ENGINEER, SCIENTIST
  Population: number;
  Reserve: number;
  Capacity: number;
  Required: number;
  Satisfaction: number;
  WorkforceNeeds: FioWorkforceNeed[];
}

export interface FioWorkforce {
  PlanetId: string;
  PlanetNaturalId: string;
  PlanetName: string;
  SiteId: string;
  Workforces: FioWorkforceDescription[];
  LastWorkforceUpdateTime: string | null;
}

// ============================================================================
// Production Endpoint Types
// ============================================================================

export interface FioProductionMaterial {
  MaterialId: string;
  MaterialName: string;
  MaterialTicker: string;
  MaterialAmount: number;
}

export interface FioProductionOrder {
  ProductionLineOrderId: string;
  Inputs: FioProductionMaterial[];
  Outputs: FioProductionMaterial[];
  CreatedEpochMs: number | null;
  StartedEpochMs: number | null;
  CompletionEpochMs: number | null;
  DurationMs: number | null;
  LastUpdatedEpochMs: number | null;
  CompletedPercentage: number | null;
  IsHalted: boolean;
  Recurring: boolean;
  StandardRecipeName: string;
  ProductionFee: number;
  ProductionFeeCurrency: string;
}

export interface FioProductionLine {
  ProductionLineId: string;
  SiteId: string;
  PlanetId: string;
  PlanetNaturalId: string;
  PlanetName: string;
  Type: string; // Building name (e.g., "Farm")
  Capacity: number;
  Efficiency: number;
  Condition: number;
  Orders: FioProductionOrder[];
}

// ============================================================================
// Storage Endpoint Types
// ============================================================================

export interface FioStorageItem {
  MaterialId: string;
  MaterialName: string;
  MaterialTicker: string;
  MaterialCategory: string;
  MaterialWeight: number;
  MaterialVolume: number;
  MaterialAmount: number;
  MaterialValue: number;
  MaterialValueCurrency: string;
  Type: string; // INVENTORY, BLOCKED, SHIPMENT
  TotalWeight: number;
  TotalVolume: number;
}

export interface FioStorage {
  StorageId: string;
  AddressableId: string;
  Name: string;
  WeightLoad: number;
  WeightCapacity: number;
  VolumeLoad: number;
  VolumeCapacity: number;
  StorageItems: FioStorageItem[];
  FixedStore: boolean;
  Type: string;
}

// ============================================================================
// Sites Endpoint Types
// ============================================================================

export interface FioReclaimMaterial {
  CommodityTicker: string;
  Amount: number;
}

export interface FioSiteBuilding {
  SiteBuildingId: string;
  BuildingId: string;
  BuildingCreated: number;
  BuildingName: string;
  BuildingTicker: string;
  BuildingLastRepair: number | null;
  Condition: number;
  ReclaimableMaterials: FioReclaimMaterial[];
  RepairMaterials: FioReclaimMaterial[];
}

export interface FioSite {
  SiteId: string;
  PlanetId: string;
  PlanetIdentifier: string;
  PlanetName: string;
  PlanetFoundedEpochMs: number;
  InvestedPermits: number;
  MaximumPermits: number;
  Buildings: FioSiteBuilding[];
}

// ============================================================================
// Error Types
// ============================================================================

export type FioErrorType = 'unauthorized' | 'not_found' | 'network' | 'unknown';

export interface FioError {
  type: FioErrorType;
  message: string;
}

export type FioResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: FioError };

// ============================================================================
// Aggregate Types
// ============================================================================

export interface FioAllData {
  workforce: FioResult<FioWorkforce[]>;
  production: FioResult<FioProductionLine[]>;
  storage: FioResult<FioStorage[]>;
  sites: FioResult<FioSite[]>;
}

export interface FioConfig {
  apiKey: string;
  username: string;
}
