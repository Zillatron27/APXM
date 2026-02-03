import { describe, it, expect } from 'vitest';
import {
  transformWorkforce,
  transformAllWorkforce,
  transformProductionLine,
  transformAllProduction,
  transformStorage,
  transformAllStorage,
  transformSite,
  transformAllSites,
} from '../transforms';
import type {
  FioWorkforce,
  FioProductionLine,
  FioStorage,
  FioSite,
} from '../types';

describe('FIO Transforms', () => {
  describe('transformWorkforce', () => {
    const fioWorkforce: FioWorkforce = {
      PlanetId: 'planet-123',
      PlanetNaturalId: 'UV-351a',
      PlanetName: 'Promitor',
      SiteId: 'site-456',
      Workforces: [
        {
          WorkforceTypeName: 'PIONEER',
          Population: 100,
          Reserve: 10,
          Capacity: 150,
          Required: 90,
          Satisfaction: 0.95,
          WorkforceNeeds: [
            {
              Category: 'FOOD',
              Essential: true,
              MaterialId: 'mat-rat',
              MaterialName: 'Rations',
              MaterialTicker: 'RAT',
              Satisfaction: 0.98,
              UnitsPerInterval: 4.8,
              UnitsPerOneHundred: 4.0,
            },
          ],
        },
      ],
      LastWorkforceUpdateTime: '2024-01-01T00:00:00Z',
    };

    it('transforms workforce with correct siteId', () => {
      const result = transformWorkforce(fioWorkforce);
      expect(result.siteId).toBe('site-456');
    });

    it('transforms workforce address correctly', () => {
      const result = transformWorkforce(fioWorkforce);
      expect(result.address.lines).toHaveLength(1);
      expect(result.address.lines[0].type).toBe('PLANET');
      const line = result.address.lines[0] as { entity: { naturalId: string } };
      expect(line.entity.naturalId).toBe('UV-351a');
    });

    it('transforms workforce level from WorkforceTypeName', () => {
      const result = transformWorkforce(fioWorkforce);
      expect(result.workforces).toHaveLength(1);
      expect(result.workforces[0].level).toBe('PIONEER');
    });

    it('transforms workforce population numbers', () => {
      const result = transformWorkforce(fioWorkforce);
      const wf = result.workforces[0];
      expect(wf.population).toBe(100);
      expect(wf.reserve).toBe(10);
      expect(wf.capacity).toBe(150);
      expect(wf.required).toBe(90);
      expect(wf.satisfaction).toBe(0.95);
    });

    it('transforms workforce needs correctly', () => {
      const result = transformWorkforce(fioWorkforce);
      const needs = result.workforces[0].needs;
      expect(needs).toHaveLength(1);
      expect(needs[0].category).toBe('FOOD');
      expect(needs[0].essential).toBe(true);
      expect(needs[0].material.ticker).toBe('RAT');
      expect(needs[0].unitsPerInterval).toBe(4.8);
      expect(needs[0].unitsPer100).toBe(4.0);
    });

    it('transforms multiple workforces with transformAllWorkforce', () => {
      const result = transformAllWorkforce([fioWorkforce, fioWorkforce]);
      expect(result).toHaveLength(2);
    });
  });

  describe('transformProductionLine', () => {
    const fioLine: FioProductionLine = {
      ProductionLineId: 'line-123',
      SiteId: 'site-456',
      PlanetId: 'planet-789',
      PlanetNaturalId: 'UV-351a',
      PlanetName: 'Promitor',
      Type: 'Farm',
      Capacity: 10,
      Efficiency: 0.92,
      Condition: 0.88,
      Orders: [
        {
          ProductionLineOrderId: 'order-001',
          Inputs: [
            {
              MaterialId: 'mat-h2o',
              MaterialName: 'Water',
              MaterialTicker: 'H2O',
              MaterialAmount: 10,
            },
          ],
          Outputs: [
            {
              MaterialId: 'mat-rat',
              MaterialName: 'Rations',
              MaterialTicker: 'RAT',
              MaterialAmount: 5,
            },
          ],
          CreatedEpochMs: 1704067200000,
          StartedEpochMs: 1704067260000,
          CompletionEpochMs: 1704070800000,
          DurationMs: 3600000,
          LastUpdatedEpochMs: 1704069000000,
          CompletedPercentage: 0.5,
          IsHalted: false,
          Recurring: true,
          StandardRecipeName: '10xH2O=>5xRAT',
          ProductionFee: 100,
          ProductionFeeCurrency: 'AIC',
        },
      ],
    };

    it('transforms production line basic fields', () => {
      const result = transformProductionLine(fioLine);
      expect(result.id).toBe('line-123');
      expect(result.siteId).toBe('site-456');
      expect(result.type).toBe('Farm');
      expect(result.capacity).toBe(10);
      expect(result.efficiency).toBe(0.92);
      expect(result.condition).toBe(0.88);
    });

    it('transforms production orders', () => {
      const result = transformProductionLine(fioLine);
      expect(result.orders).toHaveLength(1);

      const order = result.orders[0];
      expect(order.id).toBe('order-001');
      expect(order.productionLineId).toBe('line-123');
      expect(order.halted).toBe(false);
      expect(order.recurring).toBe(true);
      expect(order.completed).toBe(0.5);
    });

    it('transforms order inputs and outputs', () => {
      const result = transformProductionLine(fioLine);
      const order = result.orders[0];

      expect(order.inputs).toHaveLength(1);
      expect(order.inputs[0].material.ticker).toBe('H2O');
      expect(order.inputs[0].amount).toBe(10);

      expect(order.outputs).toHaveLength(1);
      expect(order.outputs[0].material.ticker).toBe('RAT');
      expect(order.outputs[0].amount).toBe(5);
    });

    it('transforms order timestamps to DateTime format', () => {
      const result = transformProductionLine(fioLine);
      const order = result.orders[0];

      expect(order.created.timestamp).toBe(1704067200000);
      expect(order.started?.timestamp).toBe(1704067260000);
      expect(order.completion?.timestamp).toBe(1704070800000);
      expect(order.duration?.millis).toBe(3600000);
    });

    it('handles null timestamps in orders', () => {
      const lineWithNullTimestamps: FioProductionLine = {
        ...fioLine,
        Orders: [
          {
            ...fioLine.Orders[0],
            StartedEpochMs: null,
            CompletionEpochMs: null,
            DurationMs: null,
          },
        ],
      };

      const result = transformProductionLine(lineWithNullTimestamps);
      const order = result.orders[0];

      expect(order.started).toBeNull();
      expect(order.completion).toBeNull();
      expect(order.duration).toBeNull();
    });

    it('transforms multiple lines with transformAllProduction', () => {
      const result = transformAllProduction([fioLine, fioLine]);
      expect(result).toHaveLength(2);
    });
  });

  describe('transformStorage', () => {
    const fioStorage: FioStorage = {
      StorageId: 'store-123',
      AddressableId: 'site-456',
      Name: 'Base Storage',
      WeightLoad: 500,
      WeightCapacity: 1000,
      VolumeLoad: 200,
      VolumeCapacity: 500,
      StorageItems: [
        {
          MaterialId: 'mat-rat',
          MaterialName: 'Rations',
          MaterialTicker: 'RAT',
          MaterialCategory: 'consumables',
          MaterialWeight: 0.1,
          MaterialVolume: 0.1,
          MaterialAmount: 100,
          MaterialValue: 1500,
          MaterialValueCurrency: 'AIC',
          Type: 'INVENTORY',
          TotalWeight: 10,
          TotalVolume: 10,
        },
      ],
      FixedStore: false,
      Type: 'STORE',
    };

    it('transforms storage basic fields', () => {
      const result = transformStorage(fioStorage);
      expect(result.id).toBe('store-123');
      expect(result.addressableId).toBe('site-456');
      expect(result.name).toBe('Base Storage');
      expect(result.weightLoad).toBe(500);
      expect(result.weightCapacity).toBe(1000);
      expect(result.volumeLoad).toBe(200);
      expect(result.volumeCapacity).toBe(500);
      expect(result.fixed).toBe(false);
      expect(result.type).toBe('STORE');
    });

    it('transforms storage items', () => {
      const result = transformStorage(fioStorage);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.type).toBe('INVENTORY');
      expect(item.weight).toBe(10);
      expect(item.volume).toBe(10);
      expect(item.quantity?.material.ticker).toBe('RAT');
      expect(item.quantity?.amount).toBe(100);
    });

    it('handles empty storage name', () => {
      const storageWithEmptyName: FioStorage = {
        ...fioStorage,
        Name: '',
      };
      const result = transformStorage(storageWithEmptyName);
      expect(result.name).toBeNull();
    });

    it('maps storage types correctly', () => {
      const types = [
        'STORE',
        'SHIP_STORE',
        'WAREHOUSE_STORE',
        'CONSTRUCTION_STORE',
      ] as const;

      for (const type of types) {
        const storage: FioStorage = { ...fioStorage, Type: type };
        const result = transformStorage(storage);
        expect(result.type).toBe(type);
      }
    });

    it('defaults unknown storage types to STORE', () => {
      const storage: FioStorage = { ...fioStorage, Type: 'UNKNOWN_TYPE' };
      const result = transformStorage(storage);
      expect(result.type).toBe('STORE');
    });

    it('transforms multiple storages with transformAllStorage', () => {
      const result = transformAllStorage([fioStorage, fioStorage]);
      expect(result).toHaveLength(2);
    });
  });

  describe('transformSite', () => {
    const fioSite: FioSite = {
      SiteId: 'site-123',
      PlanetId: 'planet-456',
      PlanetIdentifier: 'UV-351a',
      PlanetName: 'Promitor',
      PlanetFoundedEpochMs: 1704067200000,
      InvestedPermits: 5,
      MaximumPermits: 10,
      Buildings: [
        {
          SiteBuildingId: 'building-001',
          BuildingId: 'frm-type',
          BuildingCreated: 1704067200000,
          BuildingName: 'Farm',
          BuildingTicker: 'FRM',
          BuildingLastRepair: 1704153600000,
          Condition: 0.95,
          ReclaimableMaterials: [{ CommodityTicker: 'BSE', Amount: 4 }],
          RepairMaterials: [{ CommodityTicker: 'MCG', Amount: 1 }],
        },
      ],
    };

    it('transforms site basic fields', () => {
      const result = transformSite(fioSite);
      expect(result.siteId).toBe('site-123');
      expect(result.investedPermits).toBe(5);
      expect(result.maximumPermits).toBe(10);
      expect(result.founded.timestamp).toBe(1704067200000);
    });

    it('transforms site address', () => {
      const result = transformSite(fioSite);
      expect(result.address.lines).toHaveLength(1);
      expect(result.address.lines[0].type).toBe('PLANET');
      const line = result.address.lines[0] as { entity: { naturalId: string; name: string } };
      expect(line.entity.naturalId).toBe('UV-351a');
      expect(line.entity.name).toBe('Promitor');
    });

    it('transforms site buildings to platforms', () => {
      const result = transformSite(fioSite);
      expect(result.platforms).toHaveLength(1);

      const platform = result.platforms[0];
      expect(platform.id).toBe('building-001');
      expect(platform.siteId).toBe('site-123');
      expect(platform.condition).toBe(0.95);
      expect(platform.module.reactorTicker).toBe('FRM');
    });

    it('transforms building repair materials', () => {
      const result = transformSite(fioSite);
      const platform = result.platforms[0];

      expect(platform.reclaimableMaterials).toHaveLength(1);
      expect(platform.reclaimableMaterials[0].material.ticker).toBe('BSE');
      expect(platform.reclaimableMaterials[0].amount).toBe(4);

      expect(platform.repairMaterials).toHaveLength(1);
      expect(platform.repairMaterials[0].material.ticker).toBe('MCG');
      expect(platform.repairMaterials[0].amount).toBe(1);
    });

    it('handles null last repair timestamp', () => {
      const siteWithNullRepair: FioSite = {
        ...fioSite,
        Buildings: [
          {
            ...fioSite.Buildings[0],
            BuildingLastRepair: null,
          },
        ],
      };
      const result = transformSite(siteWithNullRepair);
      expect(result.platforms[0].lastRepair).toBeNull();
    });

    it('transforms multiple sites with transformAllSites', () => {
      const result = transformAllSites([fioSite, fioSite]);
      expect(result).toHaveLength(2);
    });

    it('sets empty buildOptions (FIO limitation)', () => {
      const result = transformSite(fioSite);
      expect(result.buildOptions.options).toHaveLength(0);
    });
  });
});
