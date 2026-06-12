import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureReferenceData } from '../reference';
import { fetchAllMaterials, fetchExchangeAll } from '../client';
import { useMaterialsStore, useCxStore } from '../../../stores/reference';
import type { FioMaterial, FioExchangeEntry } from '../types';

vi.mock('../client', () => ({
  fetchAllMaterials: vi.fn(),
  fetchExchangeAll: vi.fn(),
}));

const fetchAllMaterialsMock = vi.mocked(fetchAllMaterials);
const fetchExchangeAllMock = vi.mocked(fetchExchangeAll);

const fioMaterial: FioMaterial = {
  MaterialId: 'mat-rat',
  CategoryName: 'consumables (basic)',
  CategoryId: 'cat-1',
  Name: 'Rations',
  Ticker: 'RAT',
  Weight: 0.21,
  Volume: 0.1,
};

const fioExchangeEntry: FioExchangeEntry = {
  MaterialTicker: 'RAT',
  ExchangeCode: 'AI1',
  MMBuy: null,
  MMSell: null,
  PriceAverage: 105.5,
  AskCount: 12,
  Ask: 110,
  Supply: 5000,
  BidCount: 8,
  Bid: 101,
  Demand: 3200,
};

describe('ensureReferenceData', () => {
  beforeEach(() => {
    useMaterialsStore.getState().clear();
    useCxStore.getState().clear();
    fetchAllMaterialsMock.mockReset();
    fetchExchangeAllMock.mockReset();
  });

  it('populates both empty stores and marks them fio-sourced', async () => {
    fetchAllMaterialsMock.mockResolvedValue({ ok: true, data: [fioMaterial] });
    fetchExchangeAllMock.mockResolvedValue({ ok: true, data: [fioExchangeEntry] });

    await ensureReferenceData();

    expect(useMaterialsStore.getState().fetched).toBe(true);
    expect(useMaterialsStore.getState().dataSource).toBe('fio');
    expect(useMaterialsStore.getState().getById('RAT')?.name).toBe('Rations');
    expect(useCxStore.getState().fetched).toBe(true);
    expect(useCxStore.getState().getById('RAT.AI1')?.priceAverage).toBe(105.5);
  });

  it('skips stores that are already populated (e.g. fresh cache rehydration)', async () => {
    useMaterialsStore.getState().setAll([
      { ticker: 'RAT', name: 'Rations', category: '', weight: 0, volume: 0 },
    ]);
    useMaterialsStore.getState().setFetched('cache');
    fetchExchangeAllMock.mockResolvedValue({ ok: true, data: [fioExchangeEntry] });

    await ensureReferenceData();

    expect(fetchAllMaterialsMock).not.toHaveBeenCalled();
    expect(fetchExchangeAllMock).toHaveBeenCalledTimes(1);
  });

  it('one endpoint failing does not block the other', async () => {
    fetchAllMaterialsMock.mockResolvedValue({
      ok: false,
      error: { type: 'network', message: 'offline' },
    });
    fetchExchangeAllMock.mockResolvedValue({ ok: true, data: [fioExchangeEntry] });

    await ensureReferenceData();

    expect(useMaterialsStore.getState().fetched).toBe(false);
    expect(useCxStore.getState().fetched).toBe(true);
  });

  it('a failed store stays unfetched so the next call retries it', async () => {
    fetchAllMaterialsMock.mockResolvedValue({
      ok: false,
      error: { type: 'network', message: 'offline' },
    });
    fetchExchangeAllMock.mockResolvedValue({
      ok: false,
      error: { type: 'unknown', message: 'HTTP 500' },
    });

    await expect(ensureReferenceData()).resolves.toBeUndefined();

    fetchAllMaterialsMock.mockResolvedValue({ ok: true, data: [fioMaterial] });
    fetchExchangeAllMock.mockResolvedValue({ ok: true, data: [fioExchangeEntry] });

    await ensureReferenceData();

    expect(useMaterialsStore.getState().fetched).toBe(true);
    expect(useCxStore.getState().fetched).toBe(true);
  });
});
