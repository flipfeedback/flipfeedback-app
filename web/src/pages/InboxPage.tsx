import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, FeedbackQuery } from '../lib/api';
import type { Feedback, Label, Source, TeamMember } from '../lib/types';
import { LabelChip, relativeTime, SentimentBadge, StatusBadge } from '../components/badges';

export function InboxPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FeedbackQuery>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listFeedback(filters);
      setItems(res.items);
      setTotal(res.total);
      setSelected((cur) => (cur ? res.items.find((i) => i.id === cur.id) ?? null : null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Promise.all([api.listSources(), api.listLabels(), api.listTeam()])
      .then(([s, l, t]) => {
        setSources(s);
        setLabels(l);
        setTeam(t);
      })
      .catch(() => undefined);
  }, []);

  async function mutate(fn: () => Promise<Feedback>) {
    try {
      const updated = await fn();
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  return (
    <div>
      <h1 className="page-title">Inbox</h1>
      <div className="toolbar">
        <input
          placeholder="Search messages…"
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))}
        />
        <select onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as never }))}>
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, sentiment: e.target.value || undefined }))}>
          <option value="">All sentiment</option>
          <option value="POSITIVE">Positive</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="NEGATIVE">Negative</option>
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, sourceId: e.target.value || undefined }))}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="muted">{total} items</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="split">
        <div className="feedback-list">
          {loading && <div className="muted">Loading…</div>}
          {!loading && items.length === 0 && <div className="muted">No feedback matches these filters.</div>}
          {items.map((item) => (
            <div
              key={item.id}
              className={`panel feedback-item ${selected?.id === item.id ? 'selected' : ''}`}
              onClick={() => setSelected(item)}
            >
              <div className="feedback-meta">
                <StatusBadge status={item.status} />
                <SentimentBadge sentiment={item.sentiment} />
                {item.source && <span>{item.source.name}</span>}
                <span>·</span>
                <span>{relativeTime(item.createdAt)}</span>
              </div>
              <div className="msg">{item.message}</div>
              <div className="feedback-meta">
                {item.labels.map((l) => (
                  <LabelChip key={l.id} label={l} />
                ))}
                {item.assignedTo && <span>Assigned: {item.assignedTo.name}</span>}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="panel detail">
            <h3>Feedback detail</h3>
            <div className="row">
              <div className="muted" style={{ fontSize: 12 }}>
                {selected.author ?? 'Anonymous'} · {selected.source?.name} · {new Date(selected.createdAt).toLocaleString()}
              </div>
              <p>{selected.message}</p>
            </div>

            <div className="row">
              <label>Status</label>
              <select
                value={selected.status}
                onChange={(e) => mutate(() => api.updateFeedback(selected.id, { status: e.target.value as never }))}
              >
                <option value="NEW">New</option>
                <option value="IN_REVIEW">In review</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>

            <div className="row">
              <label>Assignee</label>
              <select
                value={selected.assignedTo?.id ?? ''}
                onChange={(e) =>
                  mutate(() => api.updateFeedback(selected.id, { assignedToId: e.target.value || null }))
                }
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="row">
              <label>Labels</label>
              <div className="feedback-meta" style={{ marginBottom: 8 }}>
                {selected.labels.map((l) => (
                  <button
                    key={l.id}
                    style={{ background: l.color, color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 999, fontSize: 11 }}
                    onClick={() => mutate(() => api.removeLabel(selected.id, l.id))}
                    title="Remove label"
                  >
                    {l.name} ×
                  </button>
                ))}
              </div>
              <select
                value=""
                onChange={(e) => e.target.value && mutate(() => api.addLabel(selected.id, e.target.value))}
              >
                <option value="">Add label…</option>
                {labels
                  .filter((l) => !selected.labels.some((sl) => sl.id === l.id))
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
