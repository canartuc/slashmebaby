// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTreeData } from '../../hooks/useTreeData';
import type {
  GetAllTabsResponse,
  GetBookmarkTreeResponse,
  GetHistoryItemsResponse,
} from '../../lib/messaging';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockTabsResponse: GetAllTabsResponse = {
  groups: [
    {
      label: 'Window 1',
      type: 'window',
      tabs: [
        {
          id: 101,
          title: 'Gmail',
          url: 'https://mail.google.com',
          favIconUrl: 'https://mail.google.com/favicon.ico',
          windowId: 1,
          pinned: false,
          audible: false,
          muted: false,
        },
        {
          id: 102,
          title: 'GitHub',
          url: 'https://github.com',
          windowId: 1,
          pinned: false,
          audible: false,
          muted: false,
        },
      ],
    },
    {
      label: 'Window 2',
      type: 'window',
      tabs: [
        {
          id: 201,
          title: 'Reddit',
          url: 'https://reddit.com',
          windowId: 2,
          pinned: false,
          audible: false,
          muted: false,
        },
      ],
    },
  ],
};

const mockBookmarkResponse: GetBookmarkTreeResponse = {
  tree: [
    {
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: 'Example', url: 'https://example.com' },
        {
          id: '20',
          title: 'Dev',
          children: [
            { id: '21', title: 'MDN', url: 'https://developer.mozilla.org' },
          ],
        },
      ],
    },
  ],
};

const mockHistoryResponse: GetHistoryItemsResponse = {
  items: [
    {
      id: 'history-h1',
      title: 'Old Docs Page',
      url: 'https://docs.example.com/guide',
      lastVisitTime: 1700000000000,
    },
    {
      id: 'history-h2',
      title: 'News Article',
      url: 'https://news.example.com/story',
      lastVisitTime: 1700000001000,
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupSendMessage(
  tabsResp: GetAllTabsResponse = mockTabsResponse,
  bookmarkResp: GetBookmarkTreeResponse = mockBookmarkResponse,
  historyResp: GetHistoryItemsResponse = mockHistoryResponse
) {
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
    msg: unknown,
    callback?: (response: unknown) => void
  ) => {
      const m = msg as { type: string };
      if (m.type === 'GET_ALL_TABS' && callback) {
        callback(tabsResp);
      } else if (m.type === 'GET_BOOKMARK_TREE' && callback) {
        callback(bookmarkResp);
      } else if (m.type === 'GET_HISTORY_ITEMS' && callback) {
        callback(historyResp);
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useTreeData', () => {
  it('passes discarded through to grid tab items', async () => {
    setupSendMessage({
      groups: [
        {
          label: 'Window 1',
          type: 'window',
          tabs: [
            { id: 1, title: 'Sleeping', url: 'https://sleep.example', windowId: 1, pinned: false, audible: false, muted: false, discarded: true },
            { id: 2, title: 'Awake', url: 'https://awake.example', windowId: 1, pinned: false, audible: false, muted: false },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useTreeData());
    await waitFor(() => expect(result.current.allTabs.length).toBe(2));
    expect(result.current.allTabs.find(t => t.title === 'Sleeping')?.discarded).toBe(true);
    expect(result.current.allTabs.find(t => t.title === 'Awake')?.discarded).toBeFalsy();
  });

  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
  });

  it('starts in a loading state', () => {
    // Never resolve the callbacks
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (() => undefined as unknown as Promise<unknown>) as unknown as typeof chrome.runtime.sendMessage
    );

    const { result } = renderHook(() => useTreeData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.visibleItems).toEqual([]);
  });

  it('sets isLoading to false after both responses arrive', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('shows only bookmark folders in visibleItems (tabs are in allTabs)', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const items = result.current.visibleItems;

    // visibleItems only contains bookmarks tree — tabs are in allTabs
    // Should have: folder-1 (Bookmarks Bar)
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('folder-1');
    expect(items[0].type).toBe('folder');
    expect(items[0].title).toBe('Bookmarks Bar');
    expect(items[0].depth).toBe(0);
    expect(items[0].isExpanded).toBe(false);
  });

  it('allTabs contains all unpinned tabs as a flat list', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const tabs = result.current.allTabs;

    // Should have 3 unpinned tabs: Gmail, GitHub, Reddit
    expect(tabs).toHaveLength(3);
    expect(tabs[0].id).toBe('tab-101');
    expect(tabs[0].type).toBe('tab');
    expect(tabs[0].title).toBe('Gmail');
    expect(tabs[0].depth).toBe(0);
    expect(tabs[1].id).toBe('tab-102');
    expect(tabs[1].type).toBe('tab');
    expect(tabs[2].id).toBe('tab-201');
    expect(tabs[2].type).toBe('tab');
    expect(tabs[2].title).toBe('Reddit');
  });

  it('expanding nested bookmark folders shows correct depth', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Expand top-level bookmark folder
    act(() => {
      result.current.toggleExpand('folder-1');
    });

    let items = result.current.visibleItems;
    // folder-1 (expanded), bookmark-10, folder-20
    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('folder-1');
    expect(items[0].isExpanded).toBe(true);
    expect(items[1].id).toBe('bookmark-10');
    expect(items[1].depth).toBe(1);
    expect(items[1].type).toBe('bookmark');
    expect(items[2].id).toBe('folder-20');
    expect(items[2].depth).toBe(1);
    expect(items[2].type).toBe('folder');
    expect(items[2].childCount).toBe(1);

    // Expand nested folder
    act(() => {
      result.current.toggleExpand('folder-20');
    });

    items = result.current.visibleItems;
    // 4 items now: folder-1 (expanded), bookmark-10, folder-20 (expanded), bookmark-21
    expect(items).toHaveLength(4);
    expect(items[3].id).toBe('bookmark-21');
    expect(items[3].depth).toBe(2);
    expect(items[3].title).toBe('MDN');
    expect(items[3].url).toBe('https://developer.mozilla.org');
  });

  it('collapsing a bookmark folder hides its children', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Expand then collapse folder-1
    act(() => {
      result.current.toggleExpand('folder-1');
    });

    // folder-1 (expanded), bookmark-10, folder-20
    expect(result.current.visibleItems).toHaveLength(3);

    act(() => {
      result.current.toggleExpand('folder-1');
    });

    // Back to just folder-1 collapsed
    expect(result.current.visibleItems).toHaveLength(1);
    expect(result.current.visibleItems[0].isExpanded).toBe(false);
  });

  it('sends GET_ALL_TABS and GET_BOOKMARK_TREE messages on mount', () => {
    setupSendMessage();

    renderHook(() => useTreeData());

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_ALL_TABS' },
      expect.any(Function)
    );
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_BOOKMARK_TREE' },
      expect.any(Function)
    );
  });

  it('handles empty responses gracefully', async () => {
    setupSendMessage(
      { groups: [] },
      { tree: [] }
    );

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.allTabs).toEqual([]);
  });

  it('sends GET_HISTORY_ITEMS on mount', () => {
    setupSendMessage();

    renderHook(() => useTreeData());

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_HISTORY_ITEMS' },
      expect.any(Function)
    );
  });

  it('exposes history items as TreeItems of type "history"', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.historyItems).toHaveLength(2);
    });

    const [first, second] = result.current.historyItems;
    expect(first.id).toBe('history-h1');
    expect(first.type).toBe('history');
    expect(first.title).toBe('Old Docs Page');
    expect(first.url).toBe('https://docs.example.com/guide');
    expect(first.depth).toBe(0);
    expect(second.id).toBe('history-h2');
  });

  it('history items never appear in visibleItems (tree view stays history-free)', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.historyItems).toHaveLength(2);
    });

    expect(
      result.current.visibleItems.find((i) => i.type === 'history')
    ).toBeUndefined();
  });

  it('handles a missing GET_HISTORY_ITEMS response gracefully', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        const m = msg as { type: string };
        if (m.type === 'GET_ALL_TABS' && callback) {
          callback(mockTabsResponse);
        } else if (m.type === 'GET_BOOKMARK_TREE' && callback) {
          callback(mockBookmarkResponse);
        } else if (m.type === 'GET_HISTORY_ITEMS' && callback) {
          callback(undefined);
        }
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.historyItems).toEqual([]);
  });

  it('checks runtime.lastError on a failed GET_HISTORY_ITEMS, logs once, and keeps the UI stable', async () => {
    // A dead message channel: the callback fires with `undefined` and
    // chrome.runtime.lastError set for its duration. Leaving lastError
    // unread makes Chrome log "Unchecked runtime.lastError" on the page.
    const lastErrorReads: unknown[] = [];
    const runtime = chrome.runtime as unknown as { lastError?: { message: string } };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        const m = msg as { type: string };
        if (m.type === 'GET_ALL_TABS' && callback) {
          callback(mockTabsResponse);
        } else if (m.type === 'GET_BOOKMARK_TREE' && callback) {
          callback(mockBookmarkResponse);
        } else if (m.type === 'GET_HISTORY_ITEMS' && callback) {
          const descriptor = { message: 'The message port closed before a response was received.' };
          Object.defineProperty(runtime, 'lastError', {
            configurable: true,
            get() {
              lastErrorReads.push(descriptor);
              return descriptor;
            },
          });
          try {
            callback(undefined);
          } finally {
            delete runtime.lastError;
          }
        }
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );

    try {
      const { result } = renderHook(() => useTreeData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // lastError was actually read inside the callback (nothing unchecked).
      expect(lastErrorReads.length).toBeGreaterThan(0);
      // Logged exactly once, and the UI stays stable with no history rows.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0].join(' '))).toContain('history');
      expect(result.current.historyItems).toEqual([]);
      expect(result.current.visibleItems.length).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('tab items in allTabs include icon from favIconUrl', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const tabs = result.current.allTabs;

    const gmail = tabs.find((t) => t.id === 'tab-101');
    expect(gmail).toBeDefined();
    expect(gmail!.icon).toBe('https://mail.google.com/favicon.ico');

    // Tab without favIconUrl has no icon
    const github = tabs.find((t) => t.id === 'tab-102');
    expect(github).toBeDefined();
    expect(github!.icon).toBeUndefined();
  });
});
