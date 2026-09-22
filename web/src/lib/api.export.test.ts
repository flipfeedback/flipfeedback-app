import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setToken } from './api';

// Exercises api.exportAnalytics (FFSCRUM-13) — the missing endpoint call that
// left the Analytics "Export CSV" button spinning forever. Mocks fetch so we
// can assert the request shape and how the CSV response is surfaced.
describe('api.exportAnalytics (FFSCRUM-13)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    setToken('jwt-123');
  });

  afterEach(() => {
    setToken(null);
    vi.unstubAllGlobals();
  });

  it('GETs /analytics/export for the window with the bearer token and returns blob + filename', async () => {
    fetchMock.mockResolvedValue(
      new Response('id,message\r\nfb_1,Love it', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="feedback-export-7d.csv"',
        },
      }),
    );

    const { blob, filename } = await api.exportAnalytics(7);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analytics/export?days=7');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer jwt-123');
    expect(filename).toBe('feedback-export-7d.csv');
    expect(await blob.text()).toContain('fb_1,Love it');
  });

  it('falls back to a window-keyed filename when Content-Disposition is absent', async () => {
    fetchMock.mockResolvedValue(
      new Response('id,message', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    );

    const { filename } = await api.exportAnalytics(30);

    expect(filename).toBe('feedback-export-30d.csv');
  });

  it('throws an ApiError carrying the server message on a non-OK response', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const err = await api.exportAnalytics().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });
});
