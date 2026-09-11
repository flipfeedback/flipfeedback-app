import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Feedback } from '../lib/types';

// Mock the API client so the board renders from fixtures and we can assert the
// bulk fan-out calls PATCH once per selected item (FFSCRUM-7).
const listFeedback = vi.fn();
const updateFeedback = vi.fn();
const listTeam = vi.fn();
vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    listFeedback: (...a: unknown[]) => listFeedback(...a),
    updateFeedback: (...a: unknown[]) => updateFeedback(...a),
    listTeam: (...a: unknown[]) => listTeam(...a),
  },
}));

import { TriagePage } from './TriagePage';

function fb(id: string, over: Partial<Feedback> = {}): Feedback {
  return {
    id,
    message: `message ${id}`,
    author: null,
    status: 'NEW',
    sentiment: 'NEUTRAL',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: null,
    assignedTo: null,
    labels: [],
    ...over,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('TriagePage bulk actions', () => {
  it('assigns every selected item via a fan-out PATCH and reflects it optimistically', async () => {
    // NEW column has two items; other columns empty.
    listFeedback.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ items: status === 'NEW' ? [fb('a'), fb('b')] : [], total: 0 }),
    );
    listTeam.mockResolvedValue([{ id: 'u1', name: 'Dana', email: 'd@x.co', role: 'MEMBER', createdAt: '' }]);
    updateFeedback.mockImplementation((id: string, patch: { assignedToId?: string | null }) =>
      Promise.resolve(fb(id, { assignedTo: { id: patch.assignedToId!, name: 'Dana' } })),
    );

    render(<TriagePage />);

    // Wait for the board to load both NEW items.
    await screen.findByLabelText('Select feedback a');
    fireEvent.click(screen.getByLabelText('Select feedback a'));
    fireEvent.click(screen.getByLabelText('Select feedback b'));

    // The bulk toolbar appears with the selection count.
    const toolbar = await screen.findByRole('region', { name: 'Bulk actions' });
    expect(within(toolbar).getByText('2 selected')).toBeInTheDocument();

    // Assign both to Dana.
    fireEvent.change(within(toolbar).getByLabelText('Assign selected to'), { target: { value: 'u1' } });

    await waitFor(() => expect(updateFeedback).toHaveBeenCalledTimes(2));
    expect(updateFeedback).toHaveBeenCalledWith('a', { assignedToId: 'u1' });
    expect(updateFeedback).toHaveBeenCalledWith('b', { assignedToId: 'u1' });

    // Selection clears after a successful bulk action (toolbar disappears).
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument(),
    );
  });

  it('surfaces a partial failure and leaves the failed item unchanged', async () => {
    listFeedback.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ items: status === 'NEW' ? [fb('a'), fb('b')] : [], total: 0 }),
    );
    listTeam.mockResolvedValue([]);
    updateFeedback.mockImplementation((id: string) =>
      id === 'b' ? Promise.reject(new Error('nope')) : Promise.resolve(fb(id, { status: 'RESOLVED' })),
    );

    render(<TriagePage />);
    await screen.findByLabelText('Select feedback a');
    fireEvent.click(screen.getByLabelText('Select feedback a'));
    fireEvent.click(screen.getByLabelText('Select feedback b'));

    const toolbar = await screen.findByRole('region', { name: 'Bulk actions' });
    fireEvent.change(within(toolbar).getByLabelText('Set status of selected'), {
      target: { value: 'RESOLVED' },
    });

    // The user is told exactly how many failed — no silent drop.
    expect(await screen.findByText(/1 of 2 could not be updated/)).toBeInTheDocument();
  });
});
