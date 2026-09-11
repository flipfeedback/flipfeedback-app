import type { Feedback } from './types';

export interface BulkUpdateResult {
  // Server-confirmed updated items, in the same order as the input ids.
  succeeded: Feedback[];
  // Ids whose update rejected — surfaced so the caller can report the partial
  // failure and leave those rows visibly unchanged, never silently dropped.
  failed: string[];
}

// Fan a per-item update out over a list of feedback ids, tolerating partial
// failure. FFSCRUM-7 v1 deliberately reuses PATCH /feedback/:id per item rather
// than a batched endpoint, so the bulk action is just N concurrent PATCHes whose
// outcomes we split into succeeded / failed. The `update` function is injected so
// callers pass `(id) => api.updateFeedback(id, patch)` and tests can stub it.
export async function bulkUpdateFeedback(
  ids: string[],
  update: (id: string) => Promise<Feedback>,
): Promise<BulkUpdateResult> {
  const results = await Promise.allSettled(ids.map((id) => update(id)));
  const succeeded: Feedback[] = [];
  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') succeeded.push(result.value);
    else failed.push(ids[i]);
  });
  return { succeeded, failed };
}
