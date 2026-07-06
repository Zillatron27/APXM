import { describe, it, expect, beforeEach } from 'vitest';
import {
  isRepairableBuilding,
  getBuildingLastRepairTimestamp,
  classifyRepairUrgency,
  calculateSiteRepairStatus,
  calculateAllRepairStatuses,
  calculateSiteRepairBuildings,
} from '../repair';
import { useSitesStore } from '../../stores/entities/sites';
import {
  createTestSite,
  createPlatform,
  createPlatformModule,
} from '../../__tests__/fixtures/factories';
import type { PrunApi } from '../../types/prun-api';

const MS_PER_DAY = 86400000;
const THRESHOLDS = { threshold: 60, offset: 10 };

function platformOfType(
  type: PrunApi.PlatformModuleType,
  overrides: Partial<PrunApi.Platform> = {}
): PrunApi.Platform {
  return createPlatform({ module: createPlatformModule({ type }), ...overrides });
}

describe('isRepairableBuilding', () => {
  it('includes PRODUCTION and RESOURCES — both degrade and need repair', () => {
    expect(isRepairableBuilding(platformOfType('PRODUCTION'))).toBe(true);
    expect(isRepairableBuilding(platformOfType('RESOURCES'))).toBe(true);
  });

  it('excludes CORE, HABITATION, and STORAGE', () => {
    expect(isRepairableBuilding(platformOfType('CORE'))).toBe(false);
    expect(isRepairableBuilding(platformOfType('HABITATION'))).toBe(false);
    expect(isRepairableBuilding(platformOfType('STORAGE'))).toBe(false);
  });
});

describe('getBuildingLastRepairTimestamp', () => {
  it('uses lastRepair when present', () => {
    const p = createPlatform({ lastRepair: { timestamp: 1000 } });
    expect(getBuildingLastRepairTimestamp(p)).toBe(1000);
  });

  it('falls back to creationTime for never-repaired buildings', () => {
    const p = createPlatform({ lastRepair: null, creationTime: { timestamp: 2000 } });
    expect(getBuildingLastRepairTimestamp(p)).toBe(2000);
  });
});

describe('classifyRepairUrgency', () => {
  it('is critical at and beyond the threshold', () => {
    expect(classifyRepairUrgency(60, THRESHOLDS)).toBe('critical');
    expect(classifyRepairUrgency(90, THRESHOLDS)).toBe('critical');
  });

  it('is warning within offset days of the threshold', () => {
    expect(classifyRepairUrgency(50, THRESHOLDS)).toBe('warning');
    expect(classifyRepairUrgency(59.9, THRESHOLDS)).toBe('warning');
  });

  it('is ok below the warning window', () => {
    expect(classifyRepairUrgency(49.9, THRESHOLDS)).toBe('ok');
    expect(classifyRepairUrgency(0, THRESHOLDS)).toBe('ok');
  });
});

describe('calculateSiteRepairStatus', () => {
  beforeEach(() => {
    useSitesStore.getState().clear();
  });

  it('returns nulls when the site has no repairable buildings', () => {
    const site = createTestSite({
      siteId: 'site-hab-only',
      platforms: [
        platformOfType('HABITATION', { siteId: 'site-hab-only' }),
        platformOfType('CORE', { siteId: 'site-hab-only' }),
      ],
    });
    useSitesStore.getState().setAll([site]);

    const result = calculateSiteRepairStatus('site-hab-only');
    expect(result.oldestBuildingAgeDays).toBeNull();
    expect(result.oldestBuildingCondition).toBeNull();
  });

  it('reports the oldest repairable building age and its condition', () => {
    const now = Date.now();
    const site = createTestSite({
      siteId: 'site-1',
      platforms: [
        // repaired 10 days ago
        platformOfType('PRODUCTION', {
          siteId: 'site-1',
          lastRepair: { timestamp: now - 10 * MS_PER_DAY },
          condition: 0.95,
        }),
        // never repaired, built 40 days ago — this is the oldest
        platformOfType('RESOURCES', {
          siteId: 'site-1',
          lastRepair: null,
          creationTime: { timestamp: now - 40 * MS_PER_DAY },
          condition: 0.8,
        }),
        // habitation older than both, but not repairable — must be ignored
        platformOfType('HABITATION', {
          siteId: 'site-1',
          lastRepair: null,
          creationTime: { timestamp: now - 200 * MS_PER_DAY },
          condition: 0.5,
        }),
      ],
    });
    useSitesStore.getState().setAll([site]);

    const result = calculateSiteRepairStatus('site-1');
    expect(result.oldestBuildingAgeDays).toBeCloseTo(40, 0);
    expect(result.oldestBuildingCondition).toBe(0.8);
  });

  it('returns nulls for an unknown site', () => {
    const result = calculateSiteRepairStatus('nope');
    expect(result.oldestBuildingAgeDays).toBeNull();
    expect(result.oldestBuildingCondition).toBeNull();
  });
});

describe('calculateAllRepairStatuses', () => {
  beforeEach(() => {
    useSitesStore.getState().clear();
  });

  it('returns one summary per site, each computed independently', () => {
    const now = Date.now();
    const siteA = createTestSite({
      siteId: 'site-a',
      platforms: [
        // repaired 5 days ago
        platformOfType('PRODUCTION', {
          siteId: 'site-a',
          lastRepair: { timestamp: now - 5 * MS_PER_DAY },
          condition: 0.97,
        }),
      ],
    });
    const siteB = createTestSite({
      siteId: 'site-b',
      platforms: [
        // never repaired, built 25 days ago
        platformOfType('RESOURCES', {
          siteId: 'site-b',
          lastRepair: null,
          creationTime: { timestamp: now - 25 * MS_PER_DAY },
          condition: 0.85,
        }),
      ],
    });
    useSitesStore.getState().setAll([siteA, siteB]);

    const results = calculateAllRepairStatuses();
    expect(results).toHaveLength(2);

    const a = results.find((r) => r.siteId === 'site-a');
    const b = results.find((r) => r.siteId === 'site-b');
    expect(a?.oldestBuildingAgeDays).toBeCloseTo(5, 0);
    expect(a?.oldestBuildingCondition).toBe(0.97);
    expect(b?.oldestBuildingAgeDays).toBeCloseTo(25, 0);
    expect(b?.oldestBuildingCondition).toBe(0.85);
  });
});

describe('calculateSiteRepairBuildings', () => {
  beforeEach(() => {
    useSitesStore.getState().clear();
  });

  it('lists only repairable buildings, oldest-since-repair first, with ticker and name', () => {
    const now = Date.now();
    const site = createTestSite({
      siteId: 'site-detail',
      platforms: [
        // repaired 10 days ago — second-oldest repairable
        createPlatform({
          siteId: 'site-detail',
          module: createPlatformModule({
            type: 'PRODUCTION',
            reactorTicker: 'SME',
            reactorName: 'Smelter',
          }),
          lastRepair: { timestamp: now - 10 * MS_PER_DAY },
          condition: 0.95,
        }),
        // never repaired, built 30 days ago — lastRepair null falls back to
        // creationTime, making this the oldest
        createPlatform({
          siteId: 'site-detail',
          module: createPlatformModule({
            type: 'RESOURCES',
            reactorTicker: 'EXT',
            reactorName: 'Extractor',
          }),
          lastRepair: null,
          creationTime: { timestamp: now - 30 * MS_PER_DAY },
          condition: 0.8,
        }),
        // not repairable — must all be excluded even though they are older
        platformOfType('CORE', {
          siteId: 'site-detail',
          lastRepair: null,
          creationTime: { timestamp: now - 100 * MS_PER_DAY },
        }),
        platformOfType('HABITATION', {
          siteId: 'site-detail',
          lastRepair: null,
          creationTime: { timestamp: now - 100 * MS_PER_DAY },
        }),
        platformOfType('STORAGE', {
          siteId: 'site-detail',
          lastRepair: null,
          creationTime: { timestamp: now - 100 * MS_PER_DAY },
        }),
      ],
    });
    useSitesStore.getState().setAll([site]);

    const rows = calculateSiteRepairBuildings('site-detail');

    // Only PRODUCTION and RESOURCES survive the filter
    expect(rows).toHaveLength(2);

    // Oldest first: 30 days (never-repaired extractor) before 10 days (smelter)
    expect(rows[0].ticker).toBe('EXT');
    expect(rows[0].name).toBe('Extractor');
    expect(rows[0].ageDays).toBeCloseTo(30, 0);
    expect(rows[0].condition).toBe(0.8);

    expect(rows[1].ticker).toBe('SME');
    expect(rows[1].name).toBe('Smelter');
    expect(rows[1].ageDays).toBeCloseTo(10, 0);
    expect(rows[1].condition).toBe(0.95);
  });

  it('returns an empty list for an unknown site', () => {
    expect(calculateSiteRepairBuildings('nope')).toEqual([]);
  });
});
