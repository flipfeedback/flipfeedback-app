import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
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

export function TriagePage() {
  const [byStatus, setByStatus] = useState<Record<FeedbackStatus, Feedback[]>>({
    NEW: [],
    IN_REVIEW: [],
    RESOLVED: [],
  });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  async function move(item: Feedback, status: FeedbackStatus) {
    try {
      await api.updateFeedback(item.id, { status });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Move failed');
    }
  }

  async function assign(item: Feedback, assignedToId: string) {
    try {
      await api.updateFeedback(item.id, { assignedToId: assignedToId || null });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Assign failed');
    }
  }

  return (
    <div>
      <h1 className="page-title">Triage</h1>
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
        {COLUMNS.map((col) => (
          <div key={col.status}>
            <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{col.title}</span>
              <span className="muted">{byStatus[col.status].length}</span>
            </h3>
            <div className="feedback-list">
              {byStatus[col.status].map((item) => (
                <div key={item.id} className="panel feedback-item" style={{ cursor: 'default' }}>
                  <div className="feedback-meta">
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
              {byStatus[col.status].length === 0 && <div className="muted">Nothing here.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
