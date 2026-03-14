import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkCache } from '../../entrypoints/background/bookmarks';

// ─── Chrome stub helpers ───────────────────────────────────────────────────

function makeBookmarksApi(tree: chrome.bookmarks.BookmarkTreeNode[] = []) {
  return {
    getTree: vi.fn((cb: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
      cb(tree);
    }),
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
  };
}

function makeFolder(
  id: string,
  title: string,
  children: chrome.bookmarks.BookmarkTreeNode[] = []
): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, children, index: 0, parentId: '0', dateAdded: 0 };
}

function makeBookmark(
  id: string,
  title: string,
  url: string,
  dateAdded = 1700000000000
): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, url, index: 0, parentId: '1', dateAdded };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('BookmarkCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array before refresh', () => {
    const bookmarksApi = makeBookmarksApi([]);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    expect(cache.getItems()).toEqual([]);
  });

  it('loads bookmarks after refresh', async () => {
    const bm = makeBookmark('bm1', 'Google', 'https://google.com', 1700000000000);
    const tree = [makeFolder('root', 'Bookmarks Bar', [bm])];
    const bookmarksApi = makeBookmarksApi(tree);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('bookmark-bm1');
    expect(items[0].title).toBe('Google');
    expect(items[0].url).toBe('https://google.com');
    expect(items[0].category).toBe('bookmarks');
    expect(items[0].timestamp).toBe(1700000000000);
  });

  it('flattens nested folder structure', async () => {
    const bm1 = makeBookmark('bm1', 'One', 'https://one.com');
    const bm2 = makeBookmark('bm2', 'Two', 'https://two.com');
    const bm3 = makeBookmark('bm3', 'Three', 'https://three.com');

    const subFolder = makeFolder('sub', 'Sub Folder', [bm2, bm3]);
    const root = makeFolder('root', 'Root', [bm1, subFolder]);
    const tree = [root];

    const bookmarksApi = makeBookmarksApi(tree);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(3);
    const ids = items.map((i) => i.id);
    expect(ids).toContain('bookmark-bm1');
    expect(ids).toContain('bookmark-bm2');
    expect(ids).toContain('bookmark-bm3');
  });

  it('skips folders (nodes without url)', async () => {
    const folder = makeFolder('folder1', 'Empty Folder', []);
    const bm = makeBookmark('bm1', 'Valid Bookmark', 'https://valid.com');
    const tree = [makeFolder('root', 'Root', [folder, bm])];

    const bookmarksApi = makeBookmarksApi(tree);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('bookmark-bm1');
  });

  it('assigns correct category "bookmarks" to all items', async () => {
    const bm1 = makeBookmark('bm1', 'Alpha', 'https://alpha.com');
    const bm2 = makeBookmark('bm2', 'Beta', 'https://beta.com');
    const tree = [makeFolder('root', 'Root', [bm1, bm2])];

    const bookmarksApi = makeBookmarksApi(tree);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items.every((i) => i.category === 'bookmarks')).toBe(true);
  });

  it('handles deeply nested bookmarks', async () => {
    const deepBm = makeBookmark('deep', 'Deep Bookmark', 'https://deep.com');
    const level3 = makeFolder('l3', 'Level 3', [deepBm]);
    const level2 = makeFolder('l2', 'Level 2', [level3]);
    const level1 = makeFolder('l1', 'Level 1', [level2]);
    const tree = [level1];

    const bookmarksApi = makeBookmarksApi(tree);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('bookmark-deep');
  });

  it('sets up listeners on created, removed, and changed events', () => {
    const bookmarksApi = makeBookmarksApi([]);
    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    const onUpdate = vi.fn();
    cache.setupListeners(onUpdate);

    expect(bookmarksApi.onCreated.addListener).toHaveBeenCalledTimes(1);
    expect(bookmarksApi.onRemoved.addListener).toHaveBeenCalledTimes(1);
    expect(bookmarksApi.onChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it('calls refresh and onUpdate when bookmark event fires', async () => {
    let onCreatedCallback: (() => void) | null = null;

    const bookmarksApi = {
      getTree: vi.fn((cb: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) => cb([])),
      onCreated: {
        addListener: vi.fn((cb: () => void) => {
          onCreatedCallback = cb;
        }),
      },
      onRemoved: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
    };

    vi.stubGlobal('chrome', { bookmarks: bookmarksApi });

    const cache = new BookmarkCache();
    const onUpdate = vi.fn();
    cache.setupListeners(onUpdate);

    onCreatedCallback!();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(bookmarksApi.getTree).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
