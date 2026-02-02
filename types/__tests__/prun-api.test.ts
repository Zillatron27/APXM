import { describe, it, expect, beforeEach } from 'vitest';
import type { PrunApi } from '../prun-api';
import {
  createTestSite,
  createTestStorage,
  createTestWorkforce,
  createTestProductionLine,
  createTestShip,
  createTestFlight,
  createTestContract,
  createMaterial,
  createAddress,
  resetIdCounter,
} from '../../__tests__/fixtures/factories';

/**
 * Type parsing tests verify that our PrunApi types correctly match
 * the expected wire format from the game server.
 *
 * These tests construct objects matching the wire protocol and verify
 * they satisfy our TypeScript interfaces without runtime errors.
 */
describe('PrunApi type definitions', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Material', () => {
    it('matches expected wire format', () => {
      const material: PrunApi.Material = {
        id: 'mat-123',
        name: 'Basic Rations',
        ticker: 'RAT',
        category: 'consumables (basic)',
        weight: 0.21,
        volume: 0.1,
        resource: false,
      };

      expect(material.ticker).toBe('RAT');
      expect(material.resource).toBe(false);
    });

    it('factory produces valid Material', () => {
      const material = createMaterial();

      expect(material.id).toBeDefined();
      expect(material.ticker).toBeDefined();
      expect(typeof material.weight).toBe('number');
    });
  });

  describe('Address', () => {
    it('parses system address line', () => {
      const address: PrunApi.Address = {
        lines: [
          {
            type: 'SYSTEM',
            entity: {
              id: 'sys-1',
              naturalId: 'MORIA',
              name: 'Moria',
            },
          },
        ],
      };

      expect(address.lines[0].type).toBe('SYSTEM');
      expect((address.lines[0] as PrunApi.SystemAddressLine).entity.naturalId).toBe('MORIA');
    });

    it('parses orbit address line', () => {
      const address: PrunApi.Address = {
        lines: [
          {
            type: 'ORBIT',
            orbit: {
              semiMajorAxis: 1.5,
              eccentricity: 0.1,
              inclination: 5,
              rightAscension: 30,
              periapsis: 45,
            },
          },
        ],
      };

      expect(address.lines[0].type).toBe('ORBIT');
      expect((address.lines[0] as PrunApi.OrbitAddressLine).orbit.semiMajorAxis).toBe(1.5);
    });

    it('factory produces valid Address', () => {
      const address = createAddress();

      expect(address.lines.length).toBeGreaterThan(0);
    });
  });

  describe('Site', () => {
    it('matches expected wire format', () => {
      const site: PrunApi.Site = {
        siteId: 'site-123',
        address: createAddress(),
        founded: { timestamp: Date.now() },
        platforms: [],
        buildOptions: { options: [] },
        area: 500,
        investedPermits: 1,
        maximumPermits: 10,
      };

      expect(site.siteId).toBe('site-123');
      expect(site.buildOptions.options).toEqual([]);
    });

    it('factory produces valid Site with platforms', () => {
      const site = createTestSite();

      expect(site.siteId).toBeDefined();
      expect(site.platforms.length).toBeGreaterThan(0);
      expect(site.platforms[0].module.reactorTicker).toBeDefined();
    });
  });

  describe('Store', () => {
    it('matches expected wire format', () => {
      const store: PrunApi.Store = {
        id: 'store-123',
        addressableId: 'site-123',
        name: null,
        weightLoad: 1000,
        weightCapacity: 5000,
        volumeLoad: 500,
        volumeCapacity: 2500,
        items: [],
        fixed: true,
        tradeStore: false,
        rank: 0,
        locked: false,
        type: 'STORE',
      };

      expect(store.type).toBe('STORE');
      expect(store.name).toBeNull();
    });

    it('handles ship fuel store types', () => {
      const stlStore = createTestStorage({ type: 'STL_FUEL_STORE' });
      const ftlStore = createTestStorage({ type: 'FTL_FUEL_STORE' });

      expect(stlStore.type).toBe('STL_FUEL_STORE');
      expect(ftlStore.type).toBe('FTL_FUEL_STORE');
    });
  });

  describe('Workforce', () => {
    it('matches expected wire format', () => {
      const workforce: PrunApi.Workforce = {
        level: 'PIONEER',
        population: 100,
        reserve: 10,
        capacity: 100,
        required: 100,
        satisfaction: 0.85,
        needs: [
          {
            category: 'FOOD',
            essential: true,
            material: createMaterial({ ticker: 'RAT' }),
            satisfaction: 0.9,
            unitsPerInterval: 4,
            unitsPer100: 4,
          },
        ],
      };

      expect(workforce.level).toBe('PIONEER');
      expect(workforce.needs[0].category).toBe('FOOD');
    });

    it('factory produces valid WorkforceEntity', () => {
      const entity = createTestWorkforce();

      expect(entity.siteId).toBeDefined();
      expect(entity.workforces.length).toBeGreaterThan(0);
      expect(entity.workforces[0].needs.length).toBeGreaterThan(0);
    });
  });

  describe('ProductionLine', () => {
    it('matches expected wire format with orders', () => {
      const line: PrunApi.ProductionLine = {
        id: 'prod-123',
        siteId: 'site-123',
        address: createAddress(),
        type: 'FRM',
        capacity: 2,
        slots: 5,
        efficiency: 0.95,
        condition: 0.9,
        workforces: [{ level: 'PIONEER', efficiency: 1.0 }],
        orders: [],
        productionTemplates: [],
        efficiencyFactors: [],
      };

      expect(line.type).toBe('FRM');
      expect(line.capacity).toBe(2);
    });

    it('factory produces valid ProductionLine', () => {
      const line = createTestProductionLine();

      expect(line.id).toBeDefined();
      expect(line.productionTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Ship', () => {
    it('matches expected wire format', () => {
      const ship: PrunApi.Ship = {
        id: 'ship-123',
        idShipStore: 'store-1',
        idStlFuelStore: 'store-2',
        idFtlFuelStore: 'store-3',
        registration: 'ABC-1234',
        name: 'Cargo Hauler',
        commissioningTime: { timestamp: Date.now() },
        blueprintNaturalId: 'CARGO_BASIC',
        address: null,
        flightId: 'flight-1',
        acceleration: 9.8,
        thrust: 10000,
        mass: 50000,
        operatingEmptyMass: 45000,
        volume: 500,
        reactorPower: 100,
        emitterPower: 100,
        stlFuelStoreId: 'store-2',
        stlFuelFlowRate: 0.5,
        ftlFuelStoreId: 'store-3',
        operatingTimeStl: { millis: 86400000 },
        operatingTimeFtl: { millis: 43200000 },
        condition: 0.9,
        lastRepair: null,
        repairMaterials: [],
        status: 'STATIONARY',
      };

      expect(ship.flightId).toBe('flight-1');
      expect(ship.address).toBeNull();
    });

    it('factory produces valid Ship', () => {
      const ship = createTestShip();

      expect(ship.id).toBeDefined();
      expect(ship.stlFuelFlowRate).toBeGreaterThan(0);
    });
  });

  describe('Flight', () => {
    it('matches expected wire format with segments', () => {
      const flight: PrunApi.Flight = {
        id: 'flight-123',
        shipId: 'ship-123',
        origin: createAddress({ planetName: 'Montem' }),
        destination: createAddress({ planetName: 'Promitor' }),
        departure: { timestamp: Date.now() },
        arrival: { timestamp: Date.now() + 7200000 },
        segments: [
          {
            type: 'TAKE_OFF',
            origin: createAddress(),
            departure: { timestamp: Date.now() },
            destination: createAddress(),
            arrival: { timestamp: Date.now() + 600000 },
            stlDistance: 100,
            stlFuelConsumption: 5,
            transferEllipse: null,
            ftlDistance: null,
            ftlFuelConsumption: null,
            damage: 0,
          },
        ],
        currentSegmentIndex: 0,
        stlDistance: 5000,
        ftlDistance: 0,
        aborted: false,
      };

      expect(flight.segments[0].type).toBe('TAKE_OFF');
      expect(flight.aborted).toBe(false);
    });

    it('factory produces valid Flight with segments', () => {
      const flight = createTestFlight();

      expect(flight.id).toBeDefined();
      expect(flight.segments.length).toBeGreaterThan(0);
    });
  });

  describe('Contract', () => {
    it('matches expected wire format with conditions', () => {
      const contract: PrunApi.Contract = {
        id: 'contract-123',
        localId: 'CT-001',
        date: { timestamp: Date.now() },
        party: 'PROVIDER',
        partner: {
          id: 'partner-123',
          name: 'Trade Corp',
          code: 'TC',
        },
        status: 'OPEN',
        conditions: [
          {
            type: 'DELIVERY',
            id: 'cond-1',
            party: 'PROVIDER',
            index: 0,
            status: 'PENDING',
            dependencies: [],
            deadlineDuration: { millis: 259200000 },
            deadline: { timestamp: Date.now() + 259200000 },
          },
        ],
        extensionDeadline: null,
        canExtend: false,
        canRequestTermination: true,
        dueDate: { timestamp: Date.now() + 604800000 },
        name: 'Delivery Contract',
        preamble: null,
        terminationSent: false,
        terminationReceived: false,
        agentContract: false,
        relatedContracts: [],
        contractType: null,
      };

      expect(contract.status).toBe('OPEN');
      expect(contract.conditions[0].type).toBe('DELIVERY');
    });

    it('factory produces valid Contract', () => {
      const contract = createTestContract();

      expect(contract.id).toBeDefined();
      expect(contract.conditions.length).toBeGreaterThan(0);
    });
  });

  describe('Contract condition types', () => {
    it('handles DELIVERY condition', () => {
      const condition: PrunApi.ContractCondition = {
        type: 'DELIVERY',
        id: 'cond-1',
        party: 'PROVIDER',
        index: 0,
        status: 'PENDING',
        dependencies: [],
        deadlineDuration: null,
        deadline: null,
        quantity: {
          material: createMaterial(),
          amount: 100,
        },
        address: createAddress(),
      };

      expect(condition.type).toBe('DELIVERY');
      expect(condition.quantity?.amount).toBe(100);
    });

    it('handles PAYMENT condition', () => {
      const condition: PrunApi.ContractCondition = {
        type: 'PAYMENT',
        id: 'cond-1',
        party: 'CUSTOMER',
        index: 0,
        status: 'PENDING',
        dependencies: [],
        deadlineDuration: null,
        deadline: null,
        amount: {
          currency: 'AIC',
          amount: 50000,
        },
      };

      expect(condition.type).toBe('PAYMENT');
      expect(condition.amount?.amount).toBe(50000);
    });
  });
});
