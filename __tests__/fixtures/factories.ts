/**
 * Test fixture factories for creating PrunApi entities with sensible defaults.
 * Use overrides to customize specific fields for test scenarios.
 */

import type { PrunApi } from '../../types/prun-api';
import type { WorkforceEntity } from '../../stores/entities/workforce';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// Core Primitives
// ============================================================================

export function createDateTime(timestamp: number = Date.now()): PrunApi.DateTime {
  return { timestamp };
}

export function createTimeSpan(millis: number = 0): PrunApi.TimeSpan {
  return { millis };
}

export function createCurrencyAmount(
  overrides: Partial<PrunApi.CurrencyAmount> = {}
): PrunApi.CurrencyAmount {
  return {
    currency: 'AIC',
    amount: 1000,
    ...overrides,
  };
}

// ============================================================================
// Address
// ============================================================================

export function createAddress(
  overrides: Partial<{
    systemName: string;
    planetName: string;
  }> = {}
): PrunApi.Address {
  const systemName = overrides.systemName ?? 'Moria';
  const planetName = overrides.planetName ?? 'Montem';

  return {
    lines: [
      {
        type: 'SYSTEM',
        entity: {
          id: nextId('sys'),
          naturalId: systemName.toUpperCase(),
          name: systemName,
        },
      },
      {
        type: 'PLANET',
        entity: {
          id: nextId('planet'),
          naturalId: planetName.toUpperCase(),
          name: planetName,
        },
      },
    ],
  };
}

// ============================================================================
// Materials
// ============================================================================

export function createMaterial(
  overrides: Partial<PrunApi.Material> = {}
): PrunApi.Material {
  return {
    id: nextId('mat'),
    name: 'Basic Rations',
    ticker: 'RAT',
    category: 'consumables (basic)',
    weight: 0.21,
    volume: 0.1,
    resource: false,
    ...overrides,
  };
}

export function createMaterialAmount(
  overrides: Partial<PrunApi.MaterialAmount> = {}
): PrunApi.MaterialAmount {
  return {
    material: createMaterial(),
    amount: 100,
    ...overrides,
  };
}

export function createMaterialAmountValue(
  overrides: Partial<PrunApi.MaterialAmountValue> = {}
): PrunApi.MaterialAmountValue {
  return {
    material: createMaterial(),
    amount: 100,
    value: createCurrencyAmount(),
    ...overrides,
  };
}

// ============================================================================
// Sites
// ============================================================================

export function createPlatformModule(
  overrides: Partial<PrunApi.PlatformModule> = {}
): PrunApi.PlatformModule {
  const id = nextId('module');
  return {
    id,
    platformId: nextId('platform'),
    reactorId: nextId('reactor'),
    reactorName: 'Prefab Plant',
    reactorTicker: 'PP1',
    type: 'PRODUCTION',
    ...overrides,
  };
}

export function createPlatform(
  overrides: Partial<PrunApi.Platform> = {}
): PrunApi.Platform {
  return {
    siteId: nextId('site'),
    id: nextId('platform'),
    module: createPlatformModule(),
    area: 500,
    creationTime: createDateTime(),
    reclaimableMaterials: [],
    repairMaterials: [],
    repairMaterials24: [],
    repairMaterials48: [],
    bookValue: createCurrencyAmount({ amount: 50000 }),
    condition: 1.0,
    lastRepair: null,
    ...overrides,
  };
}

export function createTestSite(
  overrides: Partial<PrunApi.Site> = {}
): PrunApi.Site {
  const siteId = overrides.siteId ?? nextId('site');
  return {
    siteId,
    address: createAddress(),
    founded: createDateTime(),
    platforms: [createPlatform({ siteId })],
    buildOptions: { options: [] },
    area: 500,
    investedPermits: 1,
    maximumPermits: 10,
    ...overrides,
  };
}

// ============================================================================
// Storage
// ============================================================================

export function createStoreItem(
  overrides: Partial<PrunApi.StoreItem> = {}
): PrunApi.StoreItem {
  return {
    id: nextId('item'),
    type: 'INVENTORY',
    weight: 21,
    volume: 10,
    quantity: createMaterialAmountValue(),
    ...overrides,
  };
}

export function createTestStorage(
  overrides: Partial<PrunApi.Store> = {}
): PrunApi.Store {
  return {
    id: nextId('store'),
    addressableId: nextId('site'),
    name: null,
    weightLoad: 500,
    weightCapacity: 5000,
    volumeLoad: 250,
    volumeCapacity: 2500,
    items: [],
    fixed: true,
    tradeStore: false,
    rank: 0,
    locked: false,
    type: 'STORE',
    ...overrides,
  };
}

// ============================================================================
// Workforce
// ============================================================================

export function createNeed(
  overrides: Partial<PrunApi.Need> = {}
): PrunApi.Need {
  return {
    category: 'FOOD',
    essential: true,
    material: createMaterial({ ticker: 'RAT', name: 'Basic Rations' }),
    satisfaction: 1.0,
    unitsPerInterval: 4.0,
    unitsPer100: 4.0,
    ...overrides,
  };
}

export function createWorkforce(
  overrides: Partial<PrunApi.Workforce> = {}
): PrunApi.Workforce {
  return {
    level: 'PIONEER',
    population: 100,
    reserve: 0,
    capacity: 100,
    required: 100,
    satisfaction: 0.85,
    needs: [
      createNeed({ category: 'FOOD', material: createMaterial({ ticker: 'RAT' }) }),
      createNeed({ category: 'WATER', material: createMaterial({ ticker: 'DW', name: 'Drinking Water' }) }),
    ],
    ...overrides,
  };
}

export function createTestWorkforce(
  overrides: Partial<WorkforceEntity> = {}
): WorkforceEntity {
  return {
    address: createAddress(),
    siteId: nextId('site'),
    workforces: [
      createWorkforce({ level: 'PIONEER' }),
      createWorkforce({ level: 'SETTLER', population: 50, capacity: 50, required: 50 }),
    ],
    ...overrides,
  };
}

// ============================================================================
// Production
// ============================================================================

export function createProductionOrder(
  overrides: Partial<PrunApi.ProductionOrder> = {}
): PrunApi.ProductionOrder {
  return {
    id: nextId('order'),
    productionLineId: nextId('prodline'),
    inputs: [createMaterialAmountValue()],
    outputs: [createMaterialAmountValue()],
    created: createDateTime(),
    started: createDateTime(),
    completion: createDateTime(Date.now() + 3600000),
    duration: createTimeSpan(3600000),
    lastUpdated: createDateTime(),
    completed: 50,
    halted: false,
    productionFee: createCurrencyAmount({ amount: 10 }),
    productionFeeCollector: {
      currency: { numericCode: 1, code: 'AIC', name: 'AI Credit', decimals: 2 },
    },
    recurring: false,
    recipeId: nextId('recipe'),
    ...overrides,
  };
}

export function createProductionTemplate(
  overrides: Partial<PrunApi.ProductionTemplate> = {}
): PrunApi.ProductionTemplate {
  return {
    id: nextId('template'),
    name: 'Basic Rations',
    inputFactors: [{ material: createMaterial({ ticker: 'H2O' }), factor: 1 }],
    outputFactors: [{ material: createMaterial({ ticker: 'RAT' }), factor: 10 }],
    experience: 0,
    effortFactor: 1.0,
    efficiency: 1.0,
    duration: createTimeSpan(14400000),
    productionFeeFactor: createCurrencyAmount({ amount: 0 }),
    productionFeeCollector: {
      currency: { numericCode: 1, code: 'AIC', name: 'AI Credit', decimals: 2 },
    },
    ...overrides,
  };
}

export function createTestProductionLine(
  overrides: Partial<PrunApi.ProductionLine> = {}
): PrunApi.ProductionLine {
  return {
    id: nextId('prodline'),
    siteId: nextId('site'),
    address: createAddress(),
    type: 'FRM',
    capacity: 1,
    slots: 5,
    efficiency: 0.85,
    condition: 0.95,
    workforces: [{ level: 'PIONEER', efficiency: 1.0 }],
    orders: [],
    productionTemplates: [createProductionTemplate()],
    efficiencyFactors: [],
    ...overrides,
  };
}

// ============================================================================
// Ships
// ============================================================================

export function createTestShip(
  overrides: Partial<PrunApi.Ship> = {}
): PrunApi.Ship {
  const id = overrides.id ?? nextId('ship');
  return {
    id,
    idShipStore: nextId('shipstore'),
    idStlFuelStore: nextId('stlfuel'),
    idFtlFuelStore: nextId('ftlfuel'),
    registration: 'ABC-1234',
    name: 'Cargo Hauler',
    commissioningTime: createDateTime(),
    blueprintNaturalId: 'CARGO_BASIC',
    address: createAddress(),
    flightId: null,
    acceleration: 9.8,
    thrust: 10000,
    mass: 50000,
    operatingEmptyMass: 45000,
    volume: 500,
    reactorPower: 100,
    emitterPower: 100,
    stlFuelStoreId: nextId('stlfuel'),
    stlFuelFlowRate: 0.5,
    ftlFuelStoreId: nextId('ftlfuel'),
    operatingTimeStl: createTimeSpan(86400000),
    operatingTimeFtl: createTimeSpan(43200000),
    condition: 0.9,
    lastRepair: null,
    repairMaterials: [],
    status: 'STATIONARY',
    ...overrides,
  };
}

// ============================================================================
// Flights
// ============================================================================

export function createFlightSegment(
  overrides: Partial<PrunApi.FlightSegment> = {}
): PrunApi.FlightSegment {
  return {
    type: 'TRANSIT',
    origin: createAddress({ planetName: 'Montem' }),
    departure: createDateTime(),
    destination: createAddress({ planetName: 'Promitor' }),
    arrival: createDateTime(Date.now() + 7200000),
    stlDistance: 1000,
    stlFuelConsumption: 50,
    transferEllipse: null,
    ftlDistance: null,
    ftlFuelConsumption: null,
    damage: 0,
    ...overrides,
  };
}

export function createTestFlight(
  overrides: Partial<PrunApi.Flight> = {}
): PrunApi.Flight {
  return {
    id: nextId('flight'),
    shipId: nextId('ship'),
    origin: createAddress({ planetName: 'Montem' }),
    destination: createAddress({ planetName: 'Promitor' }),
    departure: createDateTime(),
    arrival: createDateTime(Date.now() + 14400000),
    segments: [
      createFlightSegment({ type: 'TAKE_OFF' }),
      createFlightSegment({ type: 'DEPARTURE' }),
      createFlightSegment({ type: 'TRANSIT' }),
      createFlightSegment({ type: 'APPROACH' }),
      createFlightSegment({ type: 'LANDING' }),
    ],
    currentSegmentIndex: 2,
    stlDistance: 5000,
    ftlDistance: 0,
    aborted: false,
    ...overrides,
  };
}

// ============================================================================
// Contracts
// ============================================================================

export function createContractCondition(
  overrides: Partial<PrunApi.ContractCondition> = {}
): PrunApi.ContractCondition {
  return {
    type: 'DELIVERY',
    id: nextId('condition'),
    party: 'PROVIDER',
    index: 0,
    status: 'PENDING',
    dependencies: [],
    deadlineDuration: createTimeSpan(86400000 * 3),
    deadline: createDateTime(Date.now() + 86400000 * 3),
    quantity: createMaterialAmount(),
    ...overrides,
  };
}

export function createTestContract(
  overrides: Partial<PrunApi.Contract> = {}
): PrunApi.Contract {
  return {
    id: nextId('contract'),
    localId: 'CT-001',
    date: createDateTime(),
    party: 'PROVIDER',
    partner: {
      id: nextId('partner'),
      name: 'Trade Partner Corp',
      code: 'TPC',
    },
    status: 'OPEN',
    conditions: [createContractCondition()],
    extensionDeadline: null,
    canExtend: false,
    canRequestTermination: true,
    dueDate: createDateTime(Date.now() + 86400000 * 7),
    name: 'Material Delivery Contract',
    preamble: null,
    terminationSent: false,
    terminationReceived: false,
    agentContract: false,
    relatedContracts: [],
    contractType: null,
    ...overrides,
  };
}
