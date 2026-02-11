import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteSourceStore } from '../site-data-sources';

describe('site-data-sources store', () => {
  beforeEach(() => {
    useSiteSourceStore.getState().clear();
  });

  describe('markSite', () => {
    it('sets source for one site', () => {
      useSiteSourceStore.getState().markSite('site-1', 'fio', 1000);

      const entry = useSiteSourceStore.getState().entries.get('site-1');
      expect(entry).toEqual({ source: 'fio', updatedAt: 1000 });
    });

    it('overrides previous source for that site', () => {
      useSiteSourceStore.getState().markSite('site-1', 'cache', 1000);
      useSiteSourceStore.getState().markSite('site-1', 'websocket', 2000);

      const entry = useSiteSourceStore.getState().entries.get('site-1');
      expect(entry).toEqual({ source: 'websocket', updatedAt: 2000 });
    });

    it('does not affect other sites', () => {
      useSiteSourceStore.getState().markSite('site-1', 'fio', 1000);
      useSiteSourceStore.getState().markSite('site-2', 'websocket', 2000);

      expect(useSiteSourceStore.getState().entries.get('site-1')?.source).toBe('fio');
      expect(useSiteSourceStore.getState().entries.get('site-2')?.source).toBe('websocket');
    });

    it('defaults updatedAt to current time', () => {
      const before = Date.now();
      useSiteSourceStore.getState().markSite('site-1', 'websocket');
      const after = Date.now();

      const entry = useSiteSourceStore.getState().entries.get('site-1');
      expect(entry!.updatedAt).toBeGreaterThanOrEqual(before);
      expect(entry!.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('markAllSites', () => {
    it('sets source for all provided sites', () => {
      useSiteSourceStore.getState().markAllSites(['site-1', 'site-2', 'site-3'], 'fio', 5000);

      const entries = useSiteSourceStore.getState().entries;
      expect(entries.size).toBe(3);
      expect(entries.get('site-1')).toEqual({ source: 'fio', updatedAt: 5000 });
      expect(entries.get('site-2')).toEqual({ source: 'fio', updatedAt: 5000 });
      expect(entries.get('site-3')).toEqual({ source: 'fio', updatedAt: 5000 });
    });

    it('preserves existing entries for unlisted sites', () => {
      useSiteSourceStore.getState().markSite('site-0', 'cache', 1000);
      useSiteSourceStore.getState().markAllSites(['site-1', 'site-2'], 'websocket', 3000);

      expect(useSiteSourceStore.getState().entries.get('site-0')).toEqual({ source: 'cache', updatedAt: 1000 });
      expect(useSiteSourceStore.getState().entries.size).toBe(3);
    });
  });

  describe('clear', () => {
    it('empties the map', () => {
      useSiteSourceStore.getState().markAllSites(['site-1', 'site-2'], 'websocket', 1000);
      expect(useSiteSourceStore.getState().entries.size).toBe(2);

      useSiteSourceStore.getState().clear();

      expect(useSiteSourceStore.getState().entries.size).toBe(0);
    });
  });
});
