import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HistoryCache } from '../../entrypoints/background/history';

// ─── Chrome stub helpers ───────────────────────────────────────────────────

function makeHistoryApi(items: chrome.history.HistoryItem[] = []) {
  return {
    search: vi.fn(
      (
        _query: chrome.history.HistoryQuery,
        cb: (results: chrome.history.HistoryItem[]) => void
      ) => {
        cb(items);
      }
    ),
  };
}

function makeFakeHistoryItem(
  overrides: Partial<chrome.history.HistoryItem> = {}
): chrome.history.HistoryItem {
  return {
    id: 'h1',
    url: 'https://example.com',
    title: 'Example',
    lastVisitTime: 1700000000000,
    visitCount: 5,
    typedCount: 1,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('HistoryCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array before refresh', () => {
    const historyApi = makeHistoryApi([]);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    expect(cache.getItems()).toEqual([]);
  });

  it('loads history after refresh', async () => {
    const item = makeFakeHistoryItem({
      id: 'h42',
      title: 'GitHub',
      url: 'https://github.com',
      lastVisitTime: 1700000000000,
    });
    const historyApi = makeHistoryApi([item]);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('history-h42');
    expect(items[0].title).toBe('GitHub');
    expect(items[0].url).toBe('https://github.com');
    expect(items[0].category).toBe('history');
    expect(items[0].timestamp).toBe(1700000000000);
  });

  it('queries with correct parameters', async () => {
    const historyApi = makeHistoryApi([]);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    await cache.refresh();

    expect(historyApi.search).toHaveBeenCalledWith(
      { text: '', maxResults: 1000 },
      expect.any(Function)
    );
  });

  it('skips items without title', async () => {
    const items = [
      makeFakeHistoryItem({ id: 'h1', title: 'Valid', url: 'https://valid.com' }),
      makeFakeHistoryItem({ id: 'h2', title: '', url: 'https://notitle.com' }),
      makeFakeHistoryItem({ id: 'h3', title: undefined, url: 'https://undef.com' }),
    ];
    const historyApi = makeHistoryApi(items);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    await cache.refresh();

    const result = cache.getItems();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('history-h1');
  });

  it('converts multiple history items to SearchableItem format', async () => {
    const items = [
      makeFakeHistoryItem({ id: 'h1', title: 'First', url: 'https://first.com', lastVisitTime: 1700000001000 }),
      makeFakeHistoryItem({ id: 'h2', title: 'Second', url: 'https://second.com', lastVisitTime: 1700000002000 }),
    ];
    const historyApi = makeHistoryApi(items);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    await cache.refresh();

    const result = cache.getItems();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('history-h1');
    expect(result[1].id).toBe('history-h2');
    expect(result.every((i) => i.category === 'history')).toBe(true);
  });

  it('startPeriodicRefresh calls refresh at the given interval', async () => {
    const historyApi = makeHistoryApi([]);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    cache.startPeriodicRefresh(1000);

    // First call is immediate (initial refresh)
    await Promise.resolve();
    const firstCallCount = historyApi.search.mock.calls.length;

    // Advance timer to trigger periodic refresh
    vi.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(historyApi.search.mock.calls.length).toBeGreaterThan(firstCallCount);

    cache.stopPeriodicRefresh();
  });

  it('stopPeriodicRefresh stops periodic calls', async () => {
    const historyApi = makeHistoryApi([]);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    cache.startPeriodicRefresh(1000);
    await Promise.resolve();

    cache.stopPeriodicRefresh();

    const callCountAfterStop = historyApi.search.mock.calls.length;

    vi.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(historyApi.search.mock.calls.length).toBe(callCountAfterStop);
  });

  it('default interval is 5 minutes', async () => {
    const historyApi = makeHistoryApi([]);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    cache.startPeriodicRefresh(); // default = 5 min

    await Promise.resolve();
    const countAt0 = historyApi.search.mock.calls.length;

    // Just under 5 minutes — should NOT fire again
    vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
    await Promise.resolve();
    expect(historyApi.search.mock.calls.length).toBe(countAt0);

    // Full 5 minutes — should fire
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(historyApi.search.mock.calls.length).toBeGreaterThan(countAt0);

    cache.stopPeriodicRefresh();
  });
});
