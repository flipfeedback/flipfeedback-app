import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { bulkUpdateFeedback } from '../lib/bulkUpdate';
import type { Feedback, FeedbackStatus, TeamMember } from '../lib/types';
import { LabelChip, relativeTime, SentimentBadge } from '../components/badges';

const COLUMNS: { status: FeedbackStatus; title: string }[] = [
  { status: 'NEW', title: 'New' },
  { status: 'IN_REVIEW', title: 'In review' },
  { status: 'RESOLVED', title: 'Resolved' },
];

const NEXT: Record<FeedbackStatus, FeedbackStatus | null> = {
  NEW: 'IN_REVIEW',
  IN_REVIEW: 'RESOLVED',
  RESOLVED: null,
};
const PREV: Record<FeedbackStatus, FeedbackStatus | null> = {
  NEW: null,
  IN_REVIEW: 'NEW',
  RESOLVED: 'IN_REVIEW',
};

// v1 caps a bulk selection at 100 items (FFSCRUM-7); the board only loads the
// current page (take: 50) per column, so this is a comfortable ceiling.
const emptyBoard = (): Record<FeedbackStatus, Feedback[]> => ({ NEW: [], IN_REVIEW: [], RESOLVED: [] });

// Sentinel for the "Unassigned" choice in the bulk assign dropdown, so it is
// distinguishable from the empty "Assign to…" placeholder (both would be '').
const UNASSIGN = '__unassign__';

export function TriagePage() {
  const [byStatus, setByStatus] = useState<Record<FeedbackStatus, Feedback[]>>(emptyBoard);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Ids checked for a bulk action, across all columns on the current page.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const results = await Promise.all(
        COLUMNS.map((c) => api.listFeedback({ status: c.status, take: 50 })),
      );
      setByStatus({
        NEW: results[0].items,
        IN_REVIEW: results[1].items,
        RESOLVED: results[2].items,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load triage board');
    }
  }, []);

  useEffect(() => {
    void load();
    api.listTeam().then(setTeam).catch(() => undefined);
  }, [load]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleColumn(col: FeedbackStatus, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of byStatus[col]) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  // Reflect the server-confirmed updates locally without a full reload: keep each
  // item in place unless its status changed, in which case it moves columns.
  function applyUpdates(updated: Feedback[]) {
    if (updated.length === 0) return;
    const byId = new Map(updated.map((u) => [u.id, u]));
    setByStatus((prev) => {
      const next = emptyBoard();
      (Object.keys(prev) as FeedbackStatus[]).forEach((col) => {
        for (const item of prev[col]) {
          const u = byId.get(item.id);
          next[u ? u.status : col].push(u ?? item);
        }
      });
      return next;
    });
  }

  async function move(item: Feedback, status: FeedbackStatus) {
    try {
      const updated = await api.updateFeedback(item.id, { status });
      applyUpdates([updated]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Move failed');
    }
  }

  async function assign(item: Feedback, assignedToId: string) {
    try {
      const updated = await api.updateFeedback(item.id, { assignedToId: assignedToId || null });
      applyUpdates([updated]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Assign failed');
    }
  }

  // Fan the patch out over every selected item, tolerating partial failure.
  async function applyBulk(patch: { status?: FeedbackStatus; assignedToId?: string | null }) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setError(null);
    const { succeeded, failed } = await bulkUpdateFeedback(ids, (id) => api.updateFeedback(id, patch));
    applyUpdates(succeeded);
    if (failed.length > 0) {
      setError(`${failed.length} of ${ids.length} could not be updated; those items are unchanged.`);
    }
    // Selection clears after the action; failed items keep their prior state.
    setSelected(new Set());
  }

  const selectedCount = selected.size;

  return (
    <div>
      <h1 className="page-title">Triage</h1>
      {error && <div className="error">{error}</div>}

      {selectedCount > 0 && (
        <div className="toolbar" role="region" aria-label="Bulk actions">
          <span className="muted">{selectedCount} selected</span>
          <select
            aria-label="Assign selected to"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              void applyBulk({ assignedToId: v === UNASSIGN ? null : v });
            }}
          >
            <option value="">Assign to…</option>
            <option value={UNASSIGN}>Unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Set status of selected"
            value=""
            onChange={(e) => e.target.value && void applyBulk({ status: e.target.value as FeedbackStatus })}
          >
            <option value="">Set status…</option>
            <option value="NEW">New</option>
            <option value="IN_REVIEW">In review</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <button onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
        {COLUMNS.map((col) => {
          const items = byStatus[col.status];
          const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
          return (
            <div key={col.status}>
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label={`Select all ${col.title}`}
                    checked={allSelected}
                    disabled={items.length === 0}
                    onChange={(e) => toggleColumn(col.status, e.target.checked)}
                  />
                  <span>{col.title}</span>
                </label>
                <span className="muted">{items.length}</span>
              </h3>
              <div className="feedback-list">
                {items.map((item) => (
                  <div key={item.id} className="panel feedback-item" style={{ cursor: 'default' }}>
                    <div className="feedback-meta">
                      <input
                        type="checkbox"
                        aria-label={`Select feedback ${item.id}`}
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                      <SentimentBadge sentiment={item.sentiment} />
                      {item.source && <span>{item.source.name}</span>}
                      <span>· {relativeTime(item.createdAt)}</span>
                    </div>
                    <div className="msg">{item.message}</div>
                    <div className="feedback-meta" style={{ marginBottom: 8 }}>
                      {item.labels.map((l) => (
                        <LabelChip key={l.id} label={l} />
                      ))}
                    </div>
                    <div className="inline-form">
                      <select value={item.assignedTo?.id ?? ''} onChange={(e) => assign(item, e.target.value)}>
                        <option value="">Unassigned</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {PREV[col.status] && (
                        <button onClick={() => move(item, PREV[col.status]!)}>←</button>
                      )}
                      {NEXT[col.status] && (
                        <button className="primary" onClick={() => move(item, NEXT[col.status]!)}>
                          →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="muted">Nothing here.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
