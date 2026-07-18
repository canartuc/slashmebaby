import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMessageRouter } from '../../entrypoints/background/index';
import * as searchLib from '../../lib/search';
import { makeFakeTab } from '../helpers/fake-tab';

// Spy on createSearchEngine while preserving its real behavior, so we can
// assert how often the router rebuilds the Fuse index.
vi.mock('../../lib/search', { spy: true });


function makeChromeMock() {
  return {
    tabs: {
      query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        const tabs = [
          makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com' }),
          makeFakeTab({ id: 2, title: 'Tab Two', url: 'https://two.com' }),
        ];
        if (cb) cb(tabs);
        return Promise.resolve(tabs);
      }),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
    },
    bookmarks: {
      getTree: vi.fn((cb: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) =>
        cb([
          {
            id: 'root',
            title: 'Root',
            index: 0,
            syncing: false,
            children: [
              { id: 'bm1', title: 'Bookmark One', url: 'https://bookmark-one.com', index: 0, dateAdded: Date.now(), syncing: false },
            ],
          },
        ])
      ),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
    },
    history: {
      search: vi.fn((_: chrome.history.HistoryQuery, cb: (results: chrome.history.HistoryItem[]) => void) =>
        cb([{ id: 'h1', title: 'History One', url: 'https://history-one.com', lastVisitTime: Date.now(), visitCount: 1, typedCount: 0 }])
      ),
    },
    storage: {
      sync: {
        get: vi.fn((_: string, cb: (result: Record<string, unknown>) => void) => cb({})),
        set: vi.fn((_: Record<string, unknown>, cb?: () => void) => cb?.()),
      },
    },
  };
}

const ALL_SOURCES = ['tabs', 'bookmarks', 'history'];

describe('SEARCH engine caching', () => {
  let chromeMock: ReturnType<typeof makeChromeMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock = makeChromeMock();
    vi.stubGlobal('chrome', chromeMock);
  });

  it('reuses the search engine across consecutive searches with unchanged data', async () => {
    const router = await createMessageRouter();

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    await router({ type: 'SEARCH', payload: { query: 'two', sources: ALL_SOURCES } });
    await router({ type: 'SEARCH', payload: { query: 'tab', sources: ALL_SOURCES } });

    expect(searchLib.createSearchEngine).toHaveBeenCalledTimes(1);
  });

  it('returns identical results whether or not the engine was cached', async () => {
    const router = await createMessageRouter();

    // Recency scores derive from Date.now() at search time; freeze it so a
    // millisecond elapsing between the two calls can't drift the scores.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    try {
      const first = await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
      const second = await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });

      expect(second).toEqual(first);
      expect(first).toHaveProperty('groups');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rebuilds the engine after a bookmark change refreshes the cache', async () => {
    const router = await createMessageRouter();

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    expect(searchLib.createSearchEngine).toHaveBeenCalledTimes(1);

    // Fire the captured bookmark-created listener and let refresh settle.
    const bookmarkListener = chromeMock.bookmarks.onCreated.addListener.mock.calls[0][0] as () => void;
    bookmarkListener();
    await new Promise((r) => setTimeout(r, 0));

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    expect(searchLib.createSearchEngine).toHaveBeenCalledTimes(2);
  });

  it('rebuilds the engine after a tab update refreshes the cache', async () => {
    const router = await createMessageRouter();

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    expect(searchLib.createSearchEngine).toHaveBeenCalledTimes(1);

    const tabListener = chromeMock.tabs.onUpdated.addListener.mock.calls[0][0] as () => void;
    tabListener();
    await new Promise((r) => setTimeout(r, 0));

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    expect(searchLib.createSearchEngine).toHaveBeenCalledTimes(2);
  });

  it('rebuilds the engine when the requested sources change', async () => {
    const router = await createMessageRouter();

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    await router({ type: 'SEARCH', payload: { query: 'one', sources: ['tabs'] } });

    expect(searchLib.createSearchEngine).toHaveBeenCalledTimes(2);
  });

  it('excludes disabled sources from results even when a cached engine exists', async () => {
    const router = await createMessageRouter();

    await router({ type: 'SEARCH', payload: { query: 'one', sources: ALL_SOURCES } });
    const tabsOnly = (await router({
      type: 'SEARCH',
      payload: { query: 'one', sources: ['tabs'] },
    })) as { groups: Array<{ category: string }> };

    const categories = tabsOnly.groups.map((g) => g.category);
    expect(categories).not.toContain('bookmarks');
    expect(categories).not.toContain('history');
  });
});
