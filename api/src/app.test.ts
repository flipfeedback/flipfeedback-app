import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

const app = createApp();

describe('app', () => {
  it('reports health without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/feedback');
    expect(res.status).toBe(401);
  });

  it('validates the register payload', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

// An over-limit JSON body is rejected by body-parser before it reaches a router,
// so these cases exercise the app-level size cap without touching the DB.
describe('JSON body size limit (FFSCRUM-19)', () => {
  afterEach(() => {
    delete process.env.API_JSON_LIMIT;
    vi.resetModules();
  });

  it('rejects a body over the default 1mb limit with a 413, not a 500', async () => {
    // ~1.5mb payload, comfortably over the 1mb default.
    const huge = { blob: 'x'.repeat(1_500_000) };

    const res = await request(app).post('/auth/login').send(huge);

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Request body too large');
  });

  it('honours API_JSON_LIMIT so the cap is configurable via env', async () => {
    process.env.API_JSON_LIMIT = '1kb';
    // Re-import so config re-reads the env with the tighter limit applied.
    vi.resetModules();
    const { createApp: createAppWithLimit } = await import('./app');
    const appWithLimit = createAppWithLimit();
    // ~2kb body: well under the 1mb default (would parse) but over the 1kb override.
    const body = { blob: 'x'.repeat(2_000) };

    const res = await request(appWithLimit).post('/auth/login').send(body);

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Request body too large');
  });
});
