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

  it('drops history entries with javascript: URLs', async () => {
    const items = [
      makeFakeHistoryItem({ id: 'safe', title: 'Safe', url: 'https://example.com' }),
      makeFakeHistoryItem({ id: 'xss', title: 'XSS', url: 'javascript:alert(1)' }),
    ];
    const historyApi = makeHistoryApi(items);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    await cache.refresh();

    const result = cache.getItems();
    expect(result.map((i) => i.id)).toEqual(['history-safe']);
  });

  it('drops history entries with chrome: URLs', async () => {
    const items = [
      makeFakeHistoryItem({ id: 'internal', title: 'Settings', url: 'chrome://settings' }),
    ];
    const historyApi = makeHistoryApi(items);
    vi.stubGlobal('chrome', { history: historyApi });

    const cache = new HistoryCache();
    await cache.refresh();

    expect(cache.getItems()).toHaveLength(0);
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

  it('uses setInterval even when chrome.alarms is present (no alarms permission)', async () => {
    // The extension does NOT request the "alarms" permission, so the cache
    // must never rely on chrome.alarms — even if the API object exists.
    const historyApi = makeHistoryApi([]);
    const alarmsCreate = vi.fn();
    const alarmsAddListener = vi.fn();

    vi.stubGlobal('chrome', {
      history: historyApi,
      alarms: {
        create: alarmsCreate,
        clear: vi.fn(),
        onAlarm: {
          addListener: alarmsAddListener,
          removeListener: vi.fn(),
        },
      },
    });

    const cache = new HistoryCache();
    cache.startPeriodicRefresh(1000);
    await Promise.resolve();

    expect(alarmsCreate).not.toHaveBeenCalled();
    expect(alarmsAddListener).not.toHaveBeenCalled();

    // The interval path must still drive refreshes.
    const firstCallCount = historyApi.search.mock.calls.length;
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(historyApi.search.mock.calls.length).toBeGreaterThan(firstCallCount);

    cache.stopPeriodicRefresh();
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

describe('HistoryCache — visit listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function makeHistoryApiWithEvents(items: chrome.history.HistoryItem[] = []) {
    const visitedListeners: Array<() => void> = [];
    const removedListeners: Array<() => void> = [];
    const api = {
      ...makeHistoryApi(items),
      onVisited: { addListener: vi.fn((fn: () => void) => visitedListeners.push(fn)) },
      onVisitRemoved: { addListener: vi.fn((fn: () => void) => removedListeners.push(fn)) },
    };
    return { api, visitedListeners, removedListeners };
  }

  it('setupListeners subscribes onVisited and onVisitRemoved', () => {
    const { api } = makeHistoryApiWithEvents();
    vi.stubGlobal('chrome', { history: api });
    const cache = new HistoryCache();
    cache.setupListeners();
    expect(api.onVisited.addListener).toHaveBeenCalledTimes(1);
    expect(api.onVisitRemoved.addListener).toHaveBeenCalledTimes(1);
  });

  it('a visit refreshes the cache after the debounce window', async () => {
    const { api, visitedListeners } = makeHistoryApiWithEvents([makeFakeHistoryItem()]);
    vi.stubGlobal('chrome', { history: api });
    const cache = new HistoryCache();
    cache.setupListeners();
    expect(cache.getItems()).toHaveLength(0);

    visitedListeners[0]();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.search).toHaveBeenCalledTimes(1);
    expect(cache.getItems()).toHaveLength(1);
  });

  it('a burst of visits coalesces into one refresh', async () => {
    const { api, visitedListeners } = makeHistoryApiWithEvents([makeFakeHistoryItem()]);
    vi.stubGlobal('chrome', { history: api });
    const cache = new HistoryCache();
    cache.setupListeners();

    visitedListeners[0]();
    visitedListeners[0]();
    visitedListeners[0]();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.search).toHaveBeenCalledTimes(1);
  });

  it('a removed visit also refreshes the cache', async () => {
    const { api, removedListeners } = makeHistoryApiWithEvents([makeFakeHistoryItem()]);
    vi.stubGlobal('chrome', { history: api });
    const cache = new HistoryCache();
    cache.setupListeners();

    removedListeners[0]();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.search).toHaveBeenCalledTimes(1);
  });

  it('setupListeners is a no-op when the events are unavailable', () => {
    vi.stubGlobal('chrome', { history: makeHistoryApi() });
    const cache = new HistoryCache();
    expect(() => cache.setupListeners()).not.toThrow();
  });
});
