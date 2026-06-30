import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { relativeTime, SentimentBadge, StatusBadge } from './badges';

describe('badges', () => {
  it('renders a human-readable status', () => {
    render(<StatusBadge status="IN_REVIEW" />);
    expect(screen.getByText('In review')).toBeInTheDocument();
  });

  it('renders a sentiment label', () => {
    render(<SentimentBadge sentiment="POSITIVE" />);
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });

  it('formats recent times as minutes', () => {
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    expect(relativeTime(oneMinAgo)).toMatch(/m ago$/);
  });
});
