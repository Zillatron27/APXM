/**
 * Realistic multi-store fixture representing a 2-3 base empire.
 * This fixture is designed for testing burn calculations and cross-store queries.
 *
 * Empire structure:
 * - 2 bases: Montem (mining/extraction) and Promitor (food production)
 * - 1 ship: cargo hauler traveling between bases
 * - Realistic workforce allocations and production queues
 */

import type { PrunApi } from '../../types/prun-api';
import type { WorkforceEntity } from '../../stores/entities/workforce';
import {
  createTestSite,
  createTestStorage,
  createTestWorkforce,
  createTestProductionLine,
  createTestShip,
  createTestFlight,
  createTestContract,
  createPlatform,
  createPlatformModule,
  createWorkforce,
  createProductionOrder,
  createStoreItem,
  createMaterial,
  createMaterialAmountValue,
  createAddress,
  createDateTime,
  createTimeSpan,
  resetIdCounter,
} from './factories';

export interface EmpireFixture {
  sites: PrunApi.Site[];
  storages: PrunApi.Store[];
  workforces: WorkforceEntity[];
  productionLines: PrunApi.ProductionLine[];
  ships: PrunApi.Ship[];
  flights: PrunApi.Flight[];
  contracts: PrunApi.Contract[];
}

/**
 * Creates a realistic empire fixture with cross-referenced IDs.
 * Call resetIdCounter() before using if you need deterministic IDs.
 */
export function createEmpireFixture(): EmpireFixture {
  resetIdCounter();

  // ============================================================================
  // Sites
  // ============================================================================

  const montemSiteId = 'site-montem';
  const promitorSiteId = 'site-promitor';

  const montemSite = createTestSite({
    siteId: montemSiteId,
    address: createAddress({ systemName: 'Moria', planetName: 'Montem' }),
    platforms: [
      createPlatform({
        siteId: montemSiteId,
        module: createPlatformModule({ reactorTicker: 'CM', reactorName: 'Core Module', type: 'CORE' }),
      }),
      createPlatform({
        siteId: montemSiteId,
        module: createPlatformModule({ reactorTicker: 'EXT', reactorName: 'Extractor', type: 'PRODUCTION' }),
      }),
      createPlatform({
        siteId: montemSiteId,
        module: createPlatformModule({ reactorTicker: 'EXT', reactorName: 'Extractor', type: 'PRODUCTION' }),
      }),
      createPlatform({
        siteId: montemSiteId,
        module: createPlatformModule({ reactorTicker: 'HB1', reactorName: 'Habitation Pioneer', type: 'HABITATION' }),
      }),
    ],
    area: 1500,
    investedPermits: 4,
  });

  const promitorSite = createTestSite({
    siteId: promitorSiteId,
    address: createAddress({ systemName: 'Hortus', planetName: 'Promitor' }),
    platforms: [
      createPlatform({
        siteId: promitorSiteId,
        module: createPlatformModule({ reactorTicker: 'CM', reactorName: 'Core Module', type: 'CORE' }),
      }),
      createPlatform({
        siteId: promitorSiteId,
        module: createPlatformModule({ reactorTicker: 'FRM', reactorName: 'Farmstead', type: 'PRODUCTION' }),
      }),
      createPlatform({
        siteId: promitorSiteId,
        module: createPlatformModule({ reactorTicker: 'FRM', reactorName: 'Farmstead', type: 'PRODUCTION' }),
      }),
      createPlatform({
        siteId: promitorSiteId,
        module: createPlatformModule({ reactorTicker: 'FP', reactorName: 'Food Processor', type: 'PRODUCTION' }),
      }),
      createPlatform({
        siteId: promitorSiteId,
        module: createPlatformModule({ reactorTicker: 'HB1', reactorName: 'Habitation Pioneer', type: 'HABITATION' }),
      }),
      createPlatform({
        siteId: promitorSiteId,
        module: createPlatformModule({ reactorTicker: 'HB2', reactorName: 'Habitation Settler', type: 'HABITATION' }),
      }),
    ],
    area: 2000,
    investedPermits: 6,
  });

  // ============================================================================
  // Storage
  // ============================================================================

  const ratMaterial = createMaterial({ ticker: 'RAT', name: 'Basic Rations' });
  const dwMaterial = createMaterial({ ticker: 'DW', name: 'Drinking Water' });
  const h2oMaterial = createMaterial({ ticker: 'H2O', name: 'Water' });
  const lseMaterial = createMaterial({ ticker: 'LSE', name: 'Limestone' });
  const feMaterial = createMaterial({ ticker: 'FE', name: 'Iron Ore' });

  const montemBaseStore = createTestStorage({
    id: 'store-montem-base',
    addressableId: montemSiteId,
    type: 'STORE',
    items: [
      createStoreItem({ quantity: createMaterialAmountValue({ material: ratMaterial, amount: 200 }) }),
      createStoreItem({ quantity: createMaterialAmountValue({ material: dwMaterial, amount: 150 }) }),
      createStoreItem({ quantity: createMaterialAmountValue({ material: lseMaterial, amount: 500 }) }),
      createStoreItem({ quantity: createMaterialAmountValue({ material: feMaterial, amount: 300 }) }),
    ],
    weightLoad: 1500,
    volumeLoad: 800,
  });

  const promitorBaseStore = createTestStorage({
    id: 'store-promitor-base',
    addressableId: promitorSiteId,
    type: 'STORE',
    items: [
      createStoreItem({ quantity: createMaterialAmountValue({ material: ratMaterial, amount: 500 }) }),
      createStoreItem({ quantity: createMaterialAmountValue({ material: dwMaterial, amount: 400 }) }),
      createStoreItem({ quantity: createMaterialAmountValue({ material: h2oMaterial, amount: 1000 }) }),
    ],
    weightLoad: 2500,
    volumeLoad: 1200,
  });

  // Ship stores
  const shipId = 'ship-hauler';
  const shipStore = createTestStorage({
    id: 'store-ship-cargo',
    addressableId: shipId,
    type: 'SHIP_STORE',
    items: [
      createStoreItem({ quantity: createMaterialAmountValue({ material: ratMaterial, amount: 100 }) }),
    ],
    weightLoad: 300,
    volumeLoad: 150,
  });

  const stlFuelStore = createTestStorage({
    id: 'store-ship-stl',
    addressableId: shipId,
    type: 'STL_FUEL_STORE',
    items: [
      createStoreItem({
        quantity: createMaterialAmountValue({
          material: createMaterial({ ticker: 'SF', name: 'STL Fuel' }),
          amount: 80,
        }),
      }),
    ],
  });

  const ftlFuelStore = createTestStorage({
    id: 'store-ship-ftl',
    addressableId: shipId,
    type: 'FTL_FUEL_STORE',
    items: [
      createStoreItem({
        quantity: createMaterialAmountValue({
          material: createMaterial({ ticker: 'FF', name: 'FTL Fuel' }),
          amount: 20,
        }),
      }),
    ],
  });

  // ============================================================================
  // Workforce
  // ============================================================================

  const montemWorkforce: WorkforceEntity = createTestWorkforce({
    siteId: montemSiteId,
    address: createAddress({ planetName: 'Montem' }),
    workforces: [
      createWorkforce({
        level: 'PIONEER',
        population: 200,
        capacity: 200,
        required: 200,
        satisfaction: 0.92,
      }),
    ],
  });

  const promitorWorkforce: WorkforceEntity = createTestWorkforce({
    siteId: promitorSiteId,
    address: createAddress({ planetName: 'Promitor' }),
    workforces: [
      createWorkforce({
        level: 'PIONEER',
        population: 150,
        capacity: 150,
        required: 150,
        satisfaction: 0.95,
      }),
      createWorkforce({
        level: 'SETTLER',
        population: 80,
        capacity: 100,
        required: 100,
        satisfaction: 0.88,
      }),
    ],
  });

  // ============================================================================
  // Production
  // ============================================================================

  const extractor1 = createTestProductionLine({
    id: 'prod-ext-1',
    siteId: montemSiteId,
    type: 'EXT',
    capacity: 1,
    efficiency: 0.92,
    orders: [
      createProductionOrder({
        productionLineId: 'prod-ext-1',
        outputs: [createMaterialAmountValue({ material: lseMaterial, amount: 10 })],
        completed: 75,
        recurring: true,
      }),
    ],
  });

  const extractor2 = createTestProductionLine({
    id: 'prod-ext-2',
    siteId: montemSiteId,
    type: 'EXT',
    capacity: 1,
    efficiency: 0.90,
    orders: [
      createProductionOrder({
        productionLineId: 'prod-ext-2',
        outputs: [createMaterialAmountValue({ material: feMaterial, amount: 8 })],
        completed: 30,
        recurring: true,
      }),
    ],
  });

  const farm1 = createTestProductionLine({
    id: 'prod-frm-1',
    siteId: promitorSiteId,
    type: 'FRM',
    capacity: 2,
    efficiency: 0.95,
    orders: [
      createProductionOrder({
        productionLineId: 'prod-frm-1',
        inputs: [createMaterialAmountValue({ material: h2oMaterial, amount: 4 })],
        outputs: [createMaterialAmountValue({ material: createMaterial({ ticker: 'GRN', name: 'Grains' }), amount: 12 })],
        completed: 60,
        recurring: true,
      }),
      createProductionOrder({
        productionLineId: 'prod-frm-1',
        inputs: [createMaterialAmountValue({ material: h2oMaterial, amount: 4 })],
        outputs: [createMaterialAmountValue({ material: createMaterial({ ticker: 'GRN', name: 'Grains' }), amount: 12 })],
        completed: 0,
        recurring: true,
      }),
    ],
  });

  const farm2 = createTestProductionLine({
    id: 'prod-frm-2',
    siteId: promitorSiteId,
    type: 'FRM',
    capacity: 2,
    efficiency: 0.94,
    orders: [],
  });

  const foodProcessor = createTestProductionLine({
    id: 'prod-fp-1',
    siteId: promitorSiteId,
    type: 'FP',
    capacity: 1,
    efficiency: 0.88,
    orders: [
      createProductionOrder({
        productionLineId: 'prod-fp-1',
        inputs: [
          createMaterialAmountValue({ material: createMaterial({ ticker: 'GRN' }), amount: 1 }),
          createMaterialAmountValue({ material: createMaterial({ ticker: 'BEA' }), amount: 1 }),
        ],
        outputs: [createMaterialAmountValue({ material: ratMaterial, amount: 10 })],
        completed: 45,
        recurring: true,
      }),
    ],
  });

  // ============================================================================
  // Ships & Flights
  // ============================================================================

  const ship = createTestShip({
    id: shipId,
    name: 'Supply Runner',
    registration: 'SR-001',
    idShipStore: 'store-ship-cargo',
    idStlFuelStore: 'store-ship-stl',
    idFtlFuelStore: 'store-ship-ftl',
    stlFuelStoreId: 'store-ship-stl',
    ftlFuelStoreId: 'store-ship-ftl',
    flightId: 'flight-current',
    address: null, // In flight
    condition: 0.95,
  });

  const flight = createTestFlight({
    id: 'flight-current',
    shipId: shipId,
    origin: createAddress({ planetName: 'Montem' }),
    destination: createAddress({ planetName: 'Promitor' }),
    departure: createDateTime(Date.now() - 3600000),
    arrival: createDateTime(Date.now() + 7200000),
    currentSegmentIndex: 2,
    stlDistance: 5000,
  });

  // ============================================================================
  // Contracts
  // ============================================================================

  const deliveryContract = createTestContract({
    id: 'contract-delivery',
    localId: 'CT-001',
    name: 'RAT Delivery to Promitor',
    status: 'OPEN',
    conditions: [
      {
        type: 'DELIVERY',
        id: 'cond-1',
        party: 'PROVIDER',
        index: 0,
        status: 'IN_PROGRESS',
        dependencies: [],
        deadlineDuration: createTimeSpan(86400000 * 3),
        deadline: createDateTime(Date.now() + 86400000 * 2),
        quantity: { material: ratMaterial, amount: 200 },
        address: createAddress({ planetName: 'Promitor' }),
      },
    ],
  });

  return {
    sites: [montemSite, promitorSite],
    storages: [montemBaseStore, promitorBaseStore, shipStore, stlFuelStore, ftlFuelStore],
    workforces: [montemWorkforce, promitorWorkforce],
    productionLines: [extractor1, extractor2, farm1, farm2, foodProcessor],
    ships: [ship],
    flights: [flight],
    contracts: [deliveryContract],
  };
}

/**
 * Populates all entity stores with the empire fixture.
 * Useful for integration tests.
 */
export async function populateStoresWithEmpire(): Promise<EmpireFixture> {
  const { useSitesStore } = await import('../../stores/entities/sites');
  const { useStorageStore } = await import('../../stores/entities/storage');
  const { useWorkforceStore } = await import('../../stores/entities/workforce');
  const { useProductionStore } = await import('../../stores/entities/production');
  const { useShipsStore } = await import('../../stores/entities/ships');
  const { useFlightsStore } = await import('../../stores/entities/flights');
  const { useContractsStore } = await import('../../stores/entities/contracts');

  const empire = createEmpireFixture();

  useSitesStore.getState().setAll(empire.sites);
  useStorageStore.getState().setAll(empire.storages);
  for (const wf of empire.workforces) {
    useWorkforceStore.getState().setOne(wf);
  }
  useProductionStore.getState().setAll(empire.productionLines);
  useShipsStore.getState().setAll(empire.ships);
  useFlightsStore.getState().setAll(empire.flights);
  useContractsStore.getState().setAll(empire.contracts);

  return empire;
}
