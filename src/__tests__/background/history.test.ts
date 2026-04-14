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

  it('startPeriodicRefresh prefers chrome.alarms when available', async () => {
    const historyApi = makeHistoryApi([]);
    let registeredAlarm: { name: string; periodInMinutes: number } | null = null;
    let alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null;

    vi.stubGlobal('chrome', {
      history: historyApi,
      alarms: {
        create: vi.fn((name: string, opts: { periodInMinutes: number }) => {
          registeredAlarm = { name, periodInMinutes: opts.periodInMinutes };
        }),
        clear: vi.fn(),
        onAlarm: {
          addListener: vi.fn((cb: (alarm: chrome.alarms.Alarm) => void) => {
            alarmListener = cb;
          }),
          removeListener: vi.fn(),
        },
      },
    });

    const cache = new HistoryCache();
    cache.startPeriodicRefresh(120000); // 2 min
    await Promise.resolve();

    expect(registeredAlarm).not.toBeNull();
    expect(registeredAlarm!.periodInMinutes).toBe(2);
    expect(alarmListener).not.toBeNull();

    // Trigger the alarm and verify it triggers a refresh.
    const initialCalls = historyApi.search.mock.calls.length;
    alarmListener!({ name: 'slashmebaby-history-refresh' } as chrome.alarms.Alarm);
    await Promise.resolve();
    expect(historyApi.search.mock.calls.length).toBeGreaterThan(initialCalls);

    // An alarm with a different name should NOT trigger a refresh.
    const beforeOther = historyApi.search.mock.calls.length;
    alarmListener!({ name: 'someone-else' } as chrome.alarms.Alarm);
    await Promise.resolve();
    expect(historyApi.search.mock.calls.length).toBe(beforeOther);

    cache.stopPeriodicRefresh();
  });

  it('stopPeriodicRefresh clears the chrome.alarms listener and alarm', async () => {
    const historyApi = makeHistoryApi([]);
    const removeListener = vi.fn();
    const clearAlarm = vi.fn();

    vi.stubGlobal('chrome', {
      history: historyApi,
      alarms: {
        create: vi.fn(),
        clear: clearAlarm,
        onAlarm: {
          addListener: vi.fn(),
          removeListener,
        },
      },
    });

    const cache = new HistoryCache();
    cache.startPeriodicRefresh(60000);
    cache.stopPeriodicRefresh();

    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(clearAlarm).toHaveBeenCalledWith('slashmebaby-history-refresh');
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
