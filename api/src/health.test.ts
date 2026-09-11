import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';

// No Postgres in CI — mock the shared Prisma client and drive $queryRaw to
// simulate the DB being reachable / unreachable. `vi.hoisted` keeps the mock fn
// available inside the hoisted `vi.mock` factory.
const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('./lib/prisma', () => ({ prisma: { $queryRaw: queryRaw } }));

import { createApp } from './app';

const app = createApp();

describe('GET /health readiness', () => {
  beforeEach(() => queryRaw.mockReset());

  it('returns 200 and db:up when the database answers', async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  it('returns 503 and db:down when the database query fails', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe('down');
  });
});

describe('request id', () => {
  beforeEach(() => queryRaw.mockResolvedValue([{ ok: 1 }]));

  it('echoes a supplied x-request-id', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'trace-abc-123');
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('mints a request id when none is supplied', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
