import { describe, expect, it, vi } from 'vitest';
import type { Feedback } from './types';
import { bulkUpdateFeedback } from './bulkUpdate';

function fb(id: string, over: Partial<Feedback> = {}): Feedback {
  return {
    id,
    message: `msg-${id}`,
    author: null,
    status: 'RESOLVED',
    sentiment: 'NEUTRAL',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: null,
    assignedTo: null,
    labels: [],
    ...over,
  };
}

describe('bulkUpdateFeedback', () => {
  it('returns every updated item and no failures on the success path', async () => {
    const update = vi.fn(async (id: string) => fb(id));

    const result = await bulkUpdateFeedback(['a', 'b', 'c'], update);

    expect(result.succeeded.map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(result.failed).toEqual([]);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('reports the failed ids on the partial-failure path without dropping the successes', async () => {
    // Middle item rejects (e.g. removed between load and write); the other two succeed.
    const update = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('assignee not in org');
      return fb(id);
    });

    const result = await bulkUpdateFeedback(['a', 'b', 'c'], update);

    expect(result.succeeded.map((f) => f.id)).toEqual(['a', 'c']);
    expect(result.failed).toEqual(['b']);
  });
});
