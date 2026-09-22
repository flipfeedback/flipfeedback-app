import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Two feedback rows behind the charts. The second carries a comma, a double
// quote and a newline in its message so the test also pins down CSV escaping.
const rows = [
  {
    id: 'fb_1',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    status: 'RESOLVED',
    sentiment: 'POSITIVE',
    author: 'ada@example.com',
    message: 'Love it',
    source: { name: 'Web widget', campaign: 'spring' },
  },
  {
    id: 'fb_2',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    status: 'NEW',
    sentiment: 'NEGATIVE',
    author: null,
    message: 'Crashes, "hard", on\nupload',
    source: null,
  },
];

vi.mock('../lib/prisma', () => {
  const prisma = {
    feedback: {
      findMany: vi.fn(async () => rows),
    },
  };
  return { prisma };
});

import { createApp } from '../app';
import { signToken } from '../lib/auth';
import { prisma } from '../lib/prisma';

const app = createApp();
const token = signToken({ userId: 'user_1', organizationId: 'org_1' });
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('GET /analytics/export (FFSCRUM-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the underlying feedback rows as a downloadable CSV attachment', async () => {
    const res = await auth(request(app).get('/analytics/export?days=7'));

    // Without the endpoint this falls through to the 404 handler.
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="feedback-export-7d.csv"',
    );

    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe('id,createdAt,status,sentiment,source,campaign,author,message');
    expect(lines[1]).toBe(
      'fb_1,2026-01-02T00:00:00.000Z,RESOLVED,POSITIVE,Web widget,spring,ada@example.com,Love it',
    );
    // Fields with commas/quotes/newlines are RFC 4180 quoted; quotes are doubled.
    // The embedded "\n" stays inside the quoted field (records are joined by
    // "\r\n"), so splitting on "\r\n" yields exactly 3 records: header + 2 rows.
    expect(res.text).toContain('fb_2,2026-01-01T00:00:00.000Z,NEW,NEGATIVE,,,,"Crashes, ""hard"", on\nupload"');
    expect(lines).toHaveLength(3);
  });

  it('scopes the query to the caller organization', async () => {
    await auth(request(app).get('/analytics/export'));
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
      }),
    );
  });
});
