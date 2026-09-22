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
  // A serializable feedback row in the full `includeAll` shape, used by the
  // label attach/detach handlers when they re-fetch the item after the write.
  const includedRow = (id: string, labels: Array<{ label: { id: string; name: string; color: string } }>) => ({
    id,
    message: 'Great product',
    author: 'ada@example.com',
    status: 'NEW',
    sentiment: 'POSITIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    source: null,
    assignedTo: null,
    labels,
  });
  const prisma = {
    feedback: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'fb_1' ? { id: 'fb_1', organizationId: 'org_1', status: 'NEW' } : null,
      ),
      update: vi.fn(async () => updateBehavior()),
      // After an attach/detach the handler re-reads the item; the join set here
      // reflects that `lbl_1` is attached to `fb_1`.
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) =>
        includedRow(where.id, [{ label: { id: 'lbl_1', name: 'Bug', color: '#dc2626' } }]),
      ),
    },
    user: {
      // Assignee membership check: `user_1` is a member, anyone else is not.
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'user_1' ? { id: 'user_1', name: 'Ada', organizationId: 'org_1' } : null,
      ),
    },
    label: {
      // Label membership check: `lbl_1` belongs to the org, anything else does not.
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'lbl_1' ? { id: 'lbl_1', name: 'Bug', color: '#dc2626', organizationId: 'org_1' } : null,
      ),
    },
    feedbackLabel: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
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

describe('PATCH /feedback/:id status transitions (FFSCRUM-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateBehavior = async () => feedbackRow({ status: 'RESOLVED' });
  });

  it('moves an item to a new status and persists it', async () => {
    const res = await auth(request(app).patch('/feedback/fb_1')).send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(prisma.feedback.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RESOLVED' }) }),
    );
  });

  it('rejects an unknown status value with 400 without touching the database', async () => {
    const res = await auth(request(app).patch('/feedback/fb_1')).send({ status: 'ARCHIVED' });

    expect(res.status).toBe(400);
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a feedback item that does not belong to the organization', async () => {
    const res = await auth(request(app).patch('/feedback/fb_missing')).send({ status: 'RESOLVED' });

    expect(res.status).toBe(404);
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it('rejects a non-member assignee at the pre-write check with 400', async () => {
    // Distinct from the P2003 write-time path: `user_999` fails the membership
    // lookup, so the handler must 400 before ever calling feedback.update.
    const res = await auth(request(app).patch('/feedback/fb_1')).send({ assignedToId: 'user_999' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Assignee is not a member of this organization');
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });
});

describe('label attach/detach (FFSCRUM-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches a label and returns the item with the label present', async () => {
    const res = await auth(request(app).post('/feedback/fb_1/labels')).send({ labelId: 'lbl_1' });

    expect(res.status).toBe(200);
    expect(prisma.feedbackLabel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { feedbackId_labelId: { feedbackId: 'fb_1', labelId: 'lbl_1' } },
      }),
    );
    expect(res.body.labels).toContainEqual({ id: 'lbl_1', name: 'Bug', color: '#dc2626' });
  });

  it('rejects attaching a label that does not belong to the organization with 400', async () => {
    const res = await auth(request(app).post('/feedback/fb_1/labels')).send({ labelId: 'lbl_other' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown label for this organization');
    expect(prisma.feedbackLabel.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 when attaching a label to an unknown feedback item', async () => {
    const res = await auth(request(app).post('/feedback/fb_missing/labels')).send({ labelId: 'lbl_1' });

    expect(res.status).toBe(404);
    expect(prisma.feedbackLabel.upsert).not.toHaveBeenCalled();
  });

  it('detaches a label from an item', async () => {
    const res = await auth(request(app).delete('/feedback/fb_1/labels/lbl_1'));

    expect(res.status).toBe(200);
    expect(prisma.feedbackLabel.deleteMany).toHaveBeenCalledWith({
      where: { feedbackId: 'fb_1', labelId: 'lbl_1' },
    });
  });

  it('returns 404 when detaching a label from an unknown feedback item', async () => {
    const res = await auth(request(app).delete('/feedback/fb_missing/labels/lbl_1'));

    expect(res.status).toBe(404);
    expect(prisma.feedbackLabel.deleteMany).not.toHaveBeenCalled();
  });
});
