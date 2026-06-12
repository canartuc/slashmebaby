import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appendFileSync } from 'node:fs';
import { createMessageRouter } from '../../entrypoints/background/index';
import { createSearchEngine } from '../../lib/search';
import type { SearchableItem } from '../../lib/search';

const RESULTS_FILE = process.env.PERF_OUT ?? '/tmp/slashmebaby-perf.log';
function report(line: string): void {
  console.log(line);
  appendFileSync(RESULTS_FILE, `${new Date().toISOString()} ${line}\n`);
}

/**
 * Micro-benchmark for the background SEARCH hot path.
 *
 * Not part of the normal suite — run explicitly with:
 *   PERF=1 npx vitest run src/__tests__/perf/search-router.perf.test.ts
 *
 * Numbers are logged, not asserted, so the file can never flake CI.
 */

const SITES = [
  'github.com', 'developer.mozilla.org', 'news.ycombinator.com', 'stackoverflow.com',
  'sozcu.com.tr', 'wikipedia.org', 'reddit.com', 'twitter.com', 'linkedin.com', 'medium.com',
];

function fakeTab(i: number): chrome.tabs.Tab {
  return {
    id: i,
    index: i,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: i === 0,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    groupId: -1,
    title: `Tab ${i} — ${SITES[i % SITES.length]} page about topic ${i}`,
    url: `https://${SITES[i % SITES.length]}/page/${i}`,
    lastAccessed: Date.now() - i * 60_000,
    mutedInfo: { muted: false },
  };
}

function fakeBookmarkLeaves(count: number): chrome.bookmarks.BookmarkTreeNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bm${i}`,
    title: `Bookmark ${i} — ${SITES[i % SITES.length]} reference`,
    url: `https://${SITES[i % SITES.length]}/bookmark/${i}`,
    index: i,
    dateAdded: Date.now() - i * 3_600_000,
    syncing: false,
  }));
}

function fakeHistory(count: number): chrome.history.HistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${i}`,
    title: `History ${i} — visited ${SITES[i % SITES.length]} article ${i}`,
    url: `https://${SITES[i % SITES.length]}/article/${i}`,
    lastVisitTime: Date.now() - i * 600_000,
    visitCount: 1 + (i % 7),
    typedCount: i % 3,
  }));
}

const TAB_COUNT = 100;
const BOOKMARK_COUNT = 300;
const HISTORY_COUNT = 1000;

function makeChromeMock() {
  return {
    tabs: {
      query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        const tabs = Array.from({ length: TAB_COUNT }, (_, i) => fakeTab(i));
        if (cb) cb(tabs);
        return Promise.resolve(tabs);
      }),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
    },
    bookmarks: {
      // Dual-mode: callback style (BookmarkCache) and promise style (router).
      getTree: vi.fn((cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
        const tree: chrome.bookmarks.BookmarkTreeNode[] = [
          { id: 'root', title: 'Root', index: 0, syncing: false, children: fakeBookmarkLeaves(BOOKMARK_COUNT) },
        ];
        if (cb) cb(tree);
        return Promise.resolve(tree);
      }),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
    },
    history: {
      search: vi.fn((_: chrome.history.HistoryQuery, cb: (results: chrome.history.HistoryItem[]) => void) =>
        cb(fakeHistory(HISTORY_COUNT))
      ),
    },
    storage: {
      sync: {
        get: vi.fn((_: string, cb: (result: Record<string, unknown>) => void) => cb({})),
        set: vi.fn((_: Record<string, unknown>, cb?: () => void) => cb?.()),
      },
    },
    alarms: undefined,
  };
}

// Simulates a user typing "github" then "sozcu" character by character,
// repeated until SEARCHES_PER_RUN messages have been dispatched.
const TYPED_QUERIES = ['g', 'gi', 'git', 'gith', 'githu', 'github', 's', 'so', 'soz', 'sozc', 'sozcu'];
const SEARCHES_PER_RUN = 110;

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

describe.runIf(process.env.PERF === '1')('background SEARCH benchmark', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', makeChromeMock());
  });

  it('measures SEARCH round-trip through the message router', async () => {
    const router = await createMessageRouter();
    const search = (query: string) =>
      router({ type: 'SEARCH', payload: { query, sources: ['tabs', 'bookmarks', 'history'] } });

    // Warm-up (JIT, module init)
    for (const q of TYPED_QUERIES) await search(q);

    const timings: number[] = [];
    for (let i = 0; i < SEARCHES_PER_RUN; i++) {
      const q = TYPED_QUERIES[i % TYPED_QUERIES.length];
      const start = performance.now();
      const result = await search(q);
      timings.push(performance.now() - start);
      expect(result).toHaveProperty('groups');
    }

    timings.sort((a, b) => a - b);
    const total = timings.reduce((a, b) => a + b, 0);
    report(
      `[PERF] SEARCH router round-trip over ${SEARCHES_PER_RUN} keystrokes ` +
      `(corpus: ${TAB_COUNT} tabs + ${BOOKMARK_COUNT} bookmarks + ${HISTORY_COUNT} history): ` +
      `total ${total.toFixed(1)}ms | mean ${(total / timings.length).toFixed(3)}ms | ` +
      `p50 ${percentile(timings, 0.5).toFixed(3)}ms | p95 ${percentile(timings, 0.95).toFixed(3)}ms`
    );
  });

  it('measures GET_BOOKMARK_TREE round-trip with a large tree', async () => {
    // Replace the flat bookmark mock with a 60-folder x 25-leaf tree (1500 leaves).
    const bigTree: chrome.bookmarks.BookmarkTreeNode[] = [{
      id: 'root',
      title: 'Root',
      index: 0,
      syncing: false,
      children: Array.from({ length: 60 }, (_, f) => ({
        id: `folder-${f}`,
        title: `Folder ${f}`,
        index: f,
        syncing: false,
        children: Array.from({ length: 25 }, (_, i) => ({
          id: `bm-${f}-${i}`,
          title: `Bookmark ${f}/${i} — ${SITES[i % SITES.length]}`,
          url: `https://${SITES[i % SITES.length]}/bm/${f}/${i}`,
          index: i,
          dateAdded: Date.now() - i * 3_600_000,
          syncing: false,
        })),
      })),
    }];
    const mock = makeChromeMock();
    // Support both callback style (BookmarkCache) and promise style (router).
    mock.bookmarks.getTree = vi.fn((cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
      if (cb) cb(bigTree);
      return Promise.resolve(bigTree);
    });
    vi.stubGlobal('chrome', mock);

    const router = await createMessageRouter();
    const getTree = () => router({ type: 'GET_BOOKMARK_TREE' });

    for (let i = 0; i < 10; i++) await getTree(); // warm-up

    const N = 200;
    const timings: number[] = [];
    for (let i = 0; i < N; i++) {
      const start = performance.now();
      const result = await getTree();
      timings.push(performance.now() - start);
      expect(result).toHaveProperty('tree');
    }

    timings.sort((a, b) => a - b);
    const total = timings.reduce((a, b) => a + b, 0);
    report(
      `[PERF] GET_BOOKMARK_TREE x${N} (1500 bookmarks in 60 folders): ` +
      `total ${total.toFixed(1)}ms | mean ${(total / N).toFixed(3)}ms | ` +
      `p50 ${percentile(timings, 0.5).toFixed(3)}ms | p95 ${percentile(timings, 0.95).toFixed(3)}ms`
    );
  });

  it('measures bare Fuse engine construction cost', () => {
    const items: SearchableItem[] = Array.from({ length: 1412 }, (_, i) => ({
      id: `item-${i}`,
      title: `Item ${i} — ${SITES[i % SITES.length]} page about topic ${i}`,
      url: `https://${SITES[i % SITES.length]}/page/${i}`,
      category: 'history' as const,
      timestamp: Date.now() - i * 60_000,
    }));

    // Warm-up
    for (let i = 0; i < 10; i++) createSearchEngine(items);

    const N = 100;
    const start = performance.now();
    for (let i = 0; i < N; i++) createSearchEngine(items);
    const elapsed = performance.now() - start;
    report(
      `[PERF] createSearchEngine(1412 items) x${N}: total ${elapsed.toFixed(1)}ms | ` +
      `mean ${(elapsed / N).toFixed(3)}ms per construction`
    );
    expect(elapsed).toBeGreaterThan(0);
  });
});
