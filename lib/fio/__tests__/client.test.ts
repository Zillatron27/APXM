import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAllMaterials, fetchExchangeAll } from '../client';

/**
 * The public-endpoint contract: correct paths, NO Authorization header
 * (reference data must work without a configured FIO account), and
 * HTTP failures mapped to error results instead of throws.
 */
describe('FIO public client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function okResponse(data: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as unknown as Response;
  }

  it('fetchAllMaterials hits /material/allmaterials without an Authorization header', async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    const result = await fetchAllMaterials();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://rest.fnar.net/material/allmaterials',
      expect.objectContaining({ method: 'GET' })
    );
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('fetchExchangeAll hits /exchange/all without an Authorization header', async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    await fetchExchangeAll();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rest.fnar.net/exchange/all',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('maps a non-OK status to an error result instead of throwing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response);

    const result = await fetchAllMaterials();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unknown');
      expect(result.error.message).toContain('500');
    }
  });

  it('maps a network failure to an error result instead of throwing', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    const result = await fetchExchangeAll();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('network');
      expect(result.error.message).toBe('connection refused');
    }
  });
});
