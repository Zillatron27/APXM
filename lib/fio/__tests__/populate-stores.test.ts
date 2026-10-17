import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrunApi } from '../../../types/prun-api';
import type { FioConfig } from '../types';

vi.mock('../client', () => ({
  fetchSites: vi.fn(),
  fetchWorkforce: vi.fn(),
  fetchStorage: vi.fn(),
  fetchProduction: vi.fn(),
}));

import { fetchSites, fetchWorkforce, fetchStorage, fetchProduction } from '../client';
import { populateStoresFromFio } from '../populate-stores';
import { useSitesStore } from '../../../stores/entities/sites';
import { useStorageStore } from '../../../stores/entities/storage';
import { useWorkforceStore } from '../../../stores/entities/workforce';
import { useProductionStore } from '../../../stores/entities/production';
import { useSiteSourceStore } from '../../../stores/site-data-sources';

const config: FioConfig = { apiKey: 'k', username: 'u' };
const failure = { ok: false as const, error: { type: 'network' as const, message: 'down' } };

describe('populateStoresFromFio site source stamping', () => {
  beforeEach(() => {
    vi.mocked(fetchSites).mockReset();
    vi.mocked(fetchWorkforce).mockReset();
    vi.mocked(fetchStorage).mockReset();
    vi.mocked(fetchProduction).mockReset();
    useSitesStore.getState().clear();
    useStorageStore.getState().clear();
    useWorkforceStore.getState().clear();
    useProductionStore.getState().clear();
    useSiteSourceStore.getState().clear();
    useSitesStore.getState().setAll([{ siteId: 's1' }, { siteId: 's2' }] as PrunApi.Site[]);
    useSiteSourceStore.getState().markAllSites(['s1', 's2'], 'cache');
  });

  it('does not relabel cached sites as FIO when every fetch failed', async () => {
    vi.mocked(fetchSites).mockResolvedValue(failure);
    vi.mocked(fetchWorkforce).mockResolvedValue(failure);
    vi.mocked(fetchStorage).mockResolvedValue(failure);
    vi.mocked(fetchProduction).mockResolvedValue(failure);

    await populateStoresFromFio(config);

    const entries = useSiteSourceStore.getState().entries;
    expect(entries.get('s1')?.source).toBe('cache');
    expect(entries.get('s2')?.source).toBe('cache');
  });

  it('keeps a websocket-sourced site as websocket after a FIO refresh', async () => {
    useSiteSourceStore.getState().markSite('s1', 'websocket');
    vi.mocked(fetchSites).mockResolvedValue(failure);
    vi.mocked(fetchWorkforce).mockResolvedValue(failure);
    vi.mocked(fetchProduction).mockResolvedValue(failure);
    vi.mocked(fetchStorage).mockResolvedValue({
      ok: true,
      data: [
        {
          AddressableId: 'a',
          Name: 'n',
          Type: 'STORE',
          StorageItems: [],
          WeightCapacity: 1,
          VolumeCapacity: 1,
          WeightLoad: 0,
          VolumeLoad: 0,
          FixedStore: false,
        },
      ],
    } as never);

    const result = await populateStoresFromFio(config);

    expect(result.populated.storage).toBeGreaterThan(0);
    const entries = useSiteSourceStore.getState().entries;
    expect(entries.get('s1')?.source).toBe('websocket');
    expect(entries.get('s2')?.source).toBe('fio');
  });
});
