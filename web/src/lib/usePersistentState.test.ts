import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePersistentState } from './usePersistentState';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('usePersistentState', () => {
  it('starts from the initial value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistentState('k', { q: 'seed' }));
    expect(result.current[0]).toEqual({ q: 'seed' });
  });

  it('restores the last value across a remount (the FFSCRUM-16 bug)', () => {
    // First mount: the user sets a filter.
    const first = renderHook(() => usePersistentState<{ status?: string }>('inbox.filters', {}));
    act(() => first.result.current[1]({ status: 'RESOLVED' }));
    expect(first.result.current[0]).toEqual({ status: 'RESOLVED' });

    // Navigating away unmounts the page.
    first.unmount();

    // Coming back mounts a fresh hook with the same key: the filter is retained,
    // not reset to the initial empty value.
    const second = renderHook(() => usePersistentState<{ status?: string }>('inbox.filters', {}));
    expect(second.result.current[0]).toEqual({ status: 'RESOLVED' });
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => usePersistentState<{ q?: string; status?: string }>('k', {}));
    act(() => result.current[1]((prev) => ({ ...prev, q: 'hello' })));
    act(() => result.current[1]((prev) => ({ ...prev, status: 'NEW' })));
    expect(result.current[0]).toEqual({ q: 'hello', status: 'NEW' });
    expect(JSON.parse(window.sessionStorage.getItem('k')!)).toEqual({ q: 'hello', status: 'NEW' });
  });

  it('falls back to the initial value when stored JSON is corrupt', () => {
    window.sessionStorage.setItem('k', '{not valid json');
    const { result } = renderHook(() => usePersistentState('k', { q: 'fallback' }));
    expect(result.current[0]).toEqual({ q: 'fallback' });
  });
});
