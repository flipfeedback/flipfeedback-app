import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Model the production database behaviour that FFSCRUM-17 reported: the
// FeedbackLabel -> Label foreign key does NOT cascade, so deleting a label that
// is still attached to feedback throws unless the join rows are removed first.
// A shared `detached` set records which labels have had their join rows cleared.
const detached = new Set<string>();

vi.mock('../lib/prisma', () => {
  const prisma = {
    label: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; organizationId: string } }) =>
        where.id === 'lbl_inuse'
          ? { id: 'lbl_inuse', name: 'Bug', color: '#dc2626', organizationId: where.organizationId }
          : null,
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (!detached.has(where.id)) {
          // Simulate Prisma surfacing the database foreign-key violation.
          throw new Error('Foreign key constraint failed on the field: `FeedbackLabel_labelId_fkey`');
        }
        return { id: where.id };
      }),
    },
    feedbackLabel: {
      deleteMany: vi.fn(async ({ where }: { where: { labelId: string } }) => {
        detached.add(where.labelId);
        return { count: 3 };
      }),
    },
    // Interactive-transaction shim: run the callback with the same mocked client.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma };
});

import { createApp } from '../app';
import { signToken } from '../lib/auth';
import { prisma } from '../lib/prisma';

const app = createApp();
const token = signToken({ userId: 'user_1', organizationId: 'org_1' });
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('DELETE /labels/:id', () => {
  beforeEach(() => {
    detached.clear();
    vi.clearAllMocks();
  });

  it('deletes a label that is still attached to feedback by detaching it first (FFSCRUM-17)', async () => {
    const res = await auth(request(app).delete('/labels/lbl_inuse'));

    // Without the detach step the bare label.delete throws the FK error above
    // and the handler 500s — reproducing the reported "errors the page" bug.
    expect(res.status).toBe(204);
    expect(prisma.feedbackLabel.deleteMany).toHaveBeenCalledWith({ where: { labelId: 'lbl_inuse' } });
    expect(prisma.label.delete).toHaveBeenCalledWith({ where: { id: 'lbl_inuse' } });
  });

  it('returns 404 for a label that does not belong to the organization', async () => {
    const res = await auth(request(app).delete('/labels/lbl_missing'));
    expect(res.status).toBe(404);
    expect(prisma.label.delete).not.toHaveBeenCalled();
  });
});
