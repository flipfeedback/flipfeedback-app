import type { FeedbackStatus, Label, Sentiment } from '../lib/types';

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  NEW: 'New',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const text = sentiment.charAt(0) + sentiment.slice(1).toLowerCase();
  return <span className={`badge ${sentiment}`}>{text}</span>;
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className="label-chip" style={{ background: label.color }}>
      {label.name}
    </span>
  );
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
