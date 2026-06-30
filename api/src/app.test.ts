import { describe, expect, it } from 'vitest';
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
