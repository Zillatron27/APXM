import { describe, it, expect, beforeEach } from 'vitest';
import {
  isRepairableBuilding,
  getBuildingLastRepairTimestamp,
  classifyRepairUrgency,
  calculateSiteRepairStatus,
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
