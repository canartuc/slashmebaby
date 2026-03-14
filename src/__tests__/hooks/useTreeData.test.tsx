// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTreeData } from '../../hooks/useTreeData';
import type {
  GetAllTabsResponse,
  GetBookmarkTreeResponse,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupSendMessage(
  tabsResp: GetAllTabsResponse = mockTabsResponse,
  bookmarkResp: GetBookmarkTreeResponse = mockBookmarkResponse
) {
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(
    (msg: unknown, callback?: (response: unknown) => void) => {
      const m = msg as { type: string };
      if (m.type === 'GET_ALL_TABS' && callback) {
        callback(tabsResp);
      } else if (m.type === 'GET_BOOKMARK_TREE' && callback) {
        callback(bookmarkResp);
      }
      return undefined as unknown as Promise<unknown>;
    }
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useTreeData', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
  });

  it('starts in a loading state', () => {
    // Never resolve the callbacks
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      () => undefined as unknown as Promise<unknown>
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

  it('shows only top-level groups and folders when all collapsed', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const items = result.current.visibleItems;

    // Should have: group-Window 1, group-Window 2, folder-1
    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('group-Window 1');
    expect(items[0].type).toBe('group');
    expect(items[0].depth).toBe(0);
    expect(items[0].isExpanded).toBe(false);
    expect(items[0].childCount).toBe(2);

    expect(items[1].id).toBe('group-Window 2');
    expect(items[1].type).toBe('group');
    expect(items[1].childCount).toBe(1);

    expect(items[2].id).toBe('folder-1');
    expect(items[2].type).toBe('folder');
    expect(items[2].title).toBe('Bookmarks Bar');
  });

  it('expanding a group reveals its children', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.toggleExpand('group-Window 1');
    });

    const items = result.current.visibleItems;

    // group-Window 1 (expanded), tab-101, tab-102, group-Window 2, folder-1
    expect(items).toHaveLength(5);
    expect(items[0].id).toBe('group-Window 1');
    expect(items[0].isExpanded).toBe(true);
    expect(items[1].id).toBe('tab-101');
    expect(items[1].type).toBe('tab');
    expect(items[1].title).toBe('Gmail');
    expect(items[1].depth).toBe(1);
    expect(items[1].tabId).toBe(101);
    expect(items[2].id).toBe('tab-102');
    expect(items[2].type).toBe('tab');
    expect(items[3].id).toBe('group-Window 2');
  });

  it('collapsing a group hides its children', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Expand then collapse
    act(() => {
      result.current.toggleExpand('group-Window 1');
    });

    expect(result.current.visibleItems).toHaveLength(5);

    act(() => {
      result.current.toggleExpand('group-Window 1');
    });

    expect(result.current.visibleItems).toHaveLength(3);
    expect(result.current.visibleItems[0].isExpanded).toBe(false);
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
    // group-Window 1, group-Window 2, folder-1 (expanded), bookmark-10, folder-20
    expect(items).toHaveLength(5);
    expect(items[3].id).toBe('bookmark-10');
    expect(items[3].depth).toBe(1);
    expect(items[3].type).toBe('bookmark');
    expect(items[4].id).toBe('folder-20');
    expect(items[4].depth).toBe(1);
    expect(items[4].type).toBe('folder');
    expect(items[4].childCount).toBe(1);

    // Expand nested folder
    act(() => {
      result.current.toggleExpand('folder-20');
    });

    items = result.current.visibleItems;
    // 6 items now: ..., folder-20 (expanded), bookmark-21
    expect(items).toHaveLength(6);
    expect(items[5].id).toBe('bookmark-21');
    expect(items[5].depth).toBe(2);
    expect(items[5].title).toBe('MDN');
    expect(items[5].url).toBe('https://developer.mozilla.org');
  });

  it('getParentId returns correct parent for tabs', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getParentId('tab-101')).toBe('group-Window 1');
    expect(result.current.getParentId('tab-102')).toBe('group-Window 1');
    expect(result.current.getParentId('tab-201')).toBe('group-Window 2');
  });

  it('getParentId returns correct parent for bookmarks', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getParentId('bookmark-10')).toBe('folder-1');
    expect(result.current.getParentId('folder-20')).toBe('folder-1');
    expect(result.current.getParentId('bookmark-21')).toBe('folder-20');
  });

  it('getParentId returns undefined for top-level items', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getParentId('group-Window 1')).toBeUndefined();
    expect(result.current.getParentId('group-Window 2')).toBeUndefined();
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
  });

  it('tab items include icon from favIconUrl', async () => {
    setupSendMessage();

    const { result } = renderHook(() => useTreeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Expand to see tabs
    act(() => {
      result.current.toggleExpand('group-Window 1');
    });

    const gmail = result.current.visibleItems[1];
    expect(gmail.id).toBe('tab-101');
    expect(gmail.icon).toBe('https://mail.google.com/favicon.ico');

    // Tab without favIconUrl has no icon
    const github = result.current.visibleItems[2];
    expect(github.id).toBe('tab-102');
    expect(github.icon).toBeUndefined();
  });
});
