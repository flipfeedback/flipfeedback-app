import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';

// Controls what `prisma.feedback.update` does for the current test: either
// resolve with a serializable feedback payload, or reject with a specific error.
let updateBehavior: () => Promise<unknown>;

const feedbackRow = (over: Record<string, unknown> = {}) => ({
  id: 'fb_1',
  message: 'Great product',
  author: 'ada@example.com',
  status: 'NEW',
  sentiment: 'POSITIVE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  source: null,
  assignedTo: null,
  labels: [],
  ...over,
});

vi.mock('../lib/prisma', () => {
  const prisma = {
    feedback: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'fb_1' ? { id: 'fb_1', organizationId: 'org_1', status: 'NEW' } : null,
      ),
      update: vi.fn(async () => updateBehavior()),
    },
    user: {
      // Assignee membership check: `user_1` is a member, anyone else is not.
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'user_1' ? { id: 'user_1', name: 'Ada', organizationId: 'org_1' } : null,
      ),
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

describe('PATCH /feedback/:id assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateBehavior = async () => feedbackRow({ assignedTo: { id: 'user_1', name: 'Ada' } });
  });

  it('persists a valid assignment and returns the assignee (FFSCRUM-18)', async () => {
    const res = await auth(request(app).patch('/feedback/fb_1')).send({ assignedToId: 'user_1' });

    expect(res.status).toBe(200);
    expect(res.body.assignedTo).toEqual({ id: 'user_1', name: 'Ada' });
    expect(prisma.feedback.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'user_1' }) }),
    );
  });

  it('surfaces a foreign-key failure at write time as a clear 400, not a generic 500 (FFSCRUM-18)', async () => {
    // The assignee passes the membership check but is removed before the write,
    // so Prisma raises P2003. Previously this fell through to a 500 and the
    // assignment silently "did not save".
    updateBehavior = async () => {
      throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.22.0',
      });
    };

    const res = await auth(request(app).patch('/feedback/fb_1')).send({ assignedToId: 'user_1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Assignee is not a member of this organization');
  });
});
