import { useCallback, useEffect, useRef, useState } from 'react';

// A drop-in replacement for useState that persists the value to sessionStorage
// under `key`. This keeps view state (e.g. inbox filters) alive when a page
// component unmounts and remounts — which happens whenever the user navigates
// between the app's tabs, or switches browser tabs and comes back. Without it,
// state reverts to the initial value and the user loses their filters.
//
// Storage is best-effort: a corrupt or unavailable store (private mode,
// disabled storage) falls back to in-memory state rather than throwing.
export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const read = useCallback((): T => {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw === null ? initialValue : (JSON.parse(raw) as T);
    } catch {
      return initialValue;
    }
    // initialValue is only used on first read; re-reading on identity changes
    // would clobber a persisted value, so it is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [value, setValue] = useState<T>(read);

  // If the key changes, re-hydrate from the new key's stored value.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setValue(read());
  }, [read]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write failures; state still lives in memory for this session.
    }
  }, [key, value]);

  return [value, setValue];
}
