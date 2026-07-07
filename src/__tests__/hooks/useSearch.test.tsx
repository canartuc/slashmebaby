// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSearch } from '../../hooks/useSearch';
import type { ResultGroup } from '../../lib/messaging';

const mockGroups: ResultGroup[] = [
  {
    category: 'tabs',
    items: [{ id: 'tab-1', title: 'Gmail', url: 'https://mail.google.com', score: 0.9 }],
  },
];

describe('useSearch', () => {
  beforeEach(() => {
    // Reset the mock before each test
    vi.mocked(chrome.runtime.sendMessage).mockReset();
  });

  it('sends SMART_SUGGESTIONS when query is empty', () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({ groups: mockGroups });
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    renderHook(() => useSearch(''));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SMART_SUGGESTIONS' },
      expect.any(Function)
    );
  });

  it('sends SEARCH with query and all sources when query is not empty', () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({ groups: mockGroups });
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    renderHook(() => useSearch('react'));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'SEARCH',
        payload: { query: 'react', sources: ['tabs', 'bookmarks', 'history', 'actions'] },
      },
      expect.any(Function)
    );
  });

  it('omits disabled sources from the SEARCH payload', () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({ groups: mockGroups });
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    renderHook(() =>
      useSearch('react', { tabs: true, bookmarks: false, history: true })
    );

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'SEARCH',
        payload: { query: 'react', sources: ['tabs', 'history', 'actions'] },
      },
      expect.any(Function)
    );
  });

  it('always includes actions even when all source toggles are off', () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({ groups: mockGroups });
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    renderHook(() =>
      useSearch('react', { tabs: false, bookmarks: false, history: false })
    );

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'SEARCH',
        payload: { query: 'react', sources: ['actions'] },
      },
      expect.any(Function)
    );
  });

  it('re-sends SEARCH when the source toggles change', () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({ groups: mockGroups });
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    const { rerender } = renderHook(
      ({ sources }) => useSearch('react', sources),
      { initialProps: { sources: { tabs: true, bookmarks: true, history: true } } }
    );

    rerender({ sources: { tabs: true, bookmarks: true, history: false } });

    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(
      {
        type: 'SEARCH',
        payload: { query: 'react', sources: ['tabs', 'bookmarks', 'actions'] },
      },
      expect.any(Function)
    );
  });

  it('returns groups from the response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({ groups: mockGroups });
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    const { result } = renderHook(() => useSearch('gmail'));

    await waitFor(() => {
      expect(result.current.groups).toEqual(mockGroups);
    });
  });

  it('returns empty groups when response has no groups', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        if (callback) callback({});
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    const { result } = renderHook(() => useSearch('xyz'));

    await waitFor(() => {
      expect(result.current.groups).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('sets isLoading to true during request and false after', async () => {
    let resolveCallback: ((response: unknown) => void) | undefined;

    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        resolveCallback = callback;
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    const { result } = renderHook(() => useSearch('test'));

    // isLoading should be true while waiting
    expect(result.current.isLoading).toBe(true);

    // Simulate the response arriving
    if (resolveCallback) {
      resolveCallback({ groups: mockGroups });
    }

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('cancels stale requests when query changes', async () => {
    let callCount = 0;
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      _msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        callCount++;
        if (callCount === 1) {
          // Don't call callback for the first (stale) request
          // Simulate it never resolving
        } else {
          if (callback) callback({ groups: mockGroups });
        }
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    const { result, rerender } = renderHook(
      ({ query }) => useSearch(query),
      { initialProps: { query: 'old' } }
    );

    // Rerender with new query - the old request should be cancelled
    rerender({ query: 'new' });

    await waitFor(() => {
      expect(result.current.groups).toEqual(mockGroups);
    });
  });
});
