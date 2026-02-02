import { describe, it, expect, beforeEach } from 'vitest';
import { useProductionStore, getProductionBySiteId } from '../production';
import { createTestProductionLine } from '../../../__tests__/fixtures/factories';

describe('production store', () => {
  beforeEach(() => {
    useProductionStore.getState().clear();
  });

  describe('getProductionBySiteId', () => {
    it('returns all production lines for a given site', () => {
      const siteId = 'site-123';
      const lines = [
        createTestProductionLine({ id: 'prod-1', siteId, type: 'FRM' }),
        createTestProductionLine({ id: 'prod-2', siteId, type: 'FP' }),
        createTestProductionLine({ id: 'prod-3', siteId: 'other-site', type: 'EXT' }),
      ];

      useProductionStore.getState().setAll(lines);

      const result = getProductionBySiteId(siteId);

      expect(result).toHaveLength(2);
      expect(result.map((l) => l.id).sort()).toEqual(['prod-1', 'prod-2']);
    });

    it('returns empty array when no matches', () => {
      useProductionStore.getState().setAll([
        createTestProductionLine({ siteId: 'other-site' }),
      ]);

      const result = getProductionBySiteId('nonexistent');

      expect(result).toEqual([]);
    });
  });
});
