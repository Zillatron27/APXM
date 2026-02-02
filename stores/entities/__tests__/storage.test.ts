import { describe, it, expect, beforeEach } from 'vitest';
import { useStorageStore, getStorageByAddressableId } from '../storage';
import { createTestStorage } from '../../../__tests__/fixtures/factories';

describe('storage store', () => {
  beforeEach(() => {
    useStorageStore.getState().clear();
  });

  describe('getStorageByAddressableId', () => {
    it('returns all storages for a given site', () => {
      const siteId = 'site-123';
      const stores = [
        createTestStorage({ id: 'store-1', addressableId: siteId, type: 'STORE' }),
        createTestStorage({ id: 'store-2', addressableId: siteId, type: 'WAREHOUSE_STORE' }),
        createTestStorage({ id: 'store-3', addressableId: 'other-site', type: 'STORE' }),
      ];

      useStorageStore.getState().setAll(stores);

      const result = getStorageByAddressableId(siteId);

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id).sort()).toEqual(['store-1', 'store-2']);
    });

    it('returns empty array when no matches', () => {
      useStorageStore.getState().setAll([
        createTestStorage({ addressableId: 'other-site' }),
      ]);

      const result = getStorageByAddressableId('nonexistent');

      expect(result).toEqual([]);
    });

    it('returns empty array when store is empty', () => {
      const result = getStorageByAddressableId('any-site');

      expect(result).toEqual([]);
    });
  });
});
