import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAllMaterials, fetchExchangeAll, fetchStorage } from '../client';
import type { FioConfig } from '../types';

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

/**
 * The authenticated-endpoint contract: the API key travels as the
 * Authorization header, the username is URL-encoded into the path, and
 * HTTP failures map to the categorized error results the sync layer
 * switches on (unauthorized/not_found), with 204 as a valid empty fetch.
 */
describe('FIO authenticated client', () => {
  const fetchMock = vi.fn();
  const config: FioConfig = { username: 'test user+1', apiKey: 'secret-key-123' };

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

  it('sends the API key as the Authorization header', async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    await fetchStorage(config);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('secret-key-123');
  });

  it('encodeURIComponent-encodes the username into the URL path', async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    await fetchStorage(config);

    // 'test user+1' → space %20, plus %2B — raw chars must not reach the URL.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://rest.fnar.net/storage/test%20user%2B1',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('maps a 401 to the unauthorized error category', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as unknown as Response);

    const result = await fetchStorage(config);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unauthorized');
    }
  });

  it('maps a 404 to the not_found error category', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as unknown as Response);

    const result = await fetchStorage(config);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });

  it('treats 204 No Content as success with an empty array (no json() call)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('204 has no body')),
    } as unknown as Response);

    const result = await fetchStorage(config);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });
});
