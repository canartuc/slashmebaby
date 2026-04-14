import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabCache } from '../../entrypoints/background/tabs';

// ─── Chrome stub helpers ───────────────────────────────────────────────────

function makeTabsApi(tabs: chrome.tabs.Tab[] = []) {
  return {
    query: vi.fn((_queryInfo: object, cb: (tabs: chrome.tabs.Tab[]) => void) => {
      cb(tabs);
    }),
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
  };
}

function makeFakeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: true,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    groupId: -1,
    title: 'Test Tab',
    url: 'https://example.com',
    lastAccessed: 1700000000000,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('TabCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array before refresh', () => {
    const tabsApi = makeTabsApi([makeFakeTab()]);
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    expect(cache.getItems()).toEqual([]);
  });

  it('loads tabs after refresh', async () => {
    const tab = makeFakeTab({ id: 42, title: 'Google', url: 'https://google.com', lastAccessed: 1700000000000 });
    const tabsApi = makeTabsApi([tab]);
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('tab-42');
    expect(items[0].title).toBe('Google');
    expect(items[0].url).toBe('https://google.com');
    expect(items[0].category).toBe('tabs');
    expect(items[0].timestamp).toBe(1700000000000);
  });

  it('converts multiple tabs to SearchableItem format', async () => {
    const tabs = [
      makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com', lastAccessed: 1700000001000 }),
      makeFakeTab({ id: 2, title: 'Tab Two', url: 'https://two.com', lastAccessed: 1700000002000 }),
    ];
    const tabsApi = makeTabsApi(tabs);
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('tab-1');
    expect(items[1].id).toBe('tab-2');
  });

  it('queries all tabs (no filter)', async () => {
    const tabsApi = makeTabsApi([]);
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    await cache.refresh();

    expect(tabsApi.query).toHaveBeenCalledWith({}, expect.any(Function));
  });

  it('skips tabs without id', async () => {
    const tabs = [
      makeFakeTab({ id: undefined, title: 'No ID Tab', url: 'https://noid.com' }),
      makeFakeTab({ id: 5, title: 'Valid Tab', url: 'https://valid.com' }),
    ];
    const tabsApi = makeTabsApi(tabs);
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    await cache.refresh();

    const items = cache.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('tab-5');
  });

  it('sets up listeners on all four tab events', () => {
    const tabsApi = makeTabsApi([]);
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    const onUpdate = vi.fn();
    cache.setupListeners(onUpdate);

    expect(tabsApi.onCreated.addListener).toHaveBeenCalledTimes(1);
    expect(tabsApi.onRemoved.addListener).toHaveBeenCalledTimes(1);
    expect(tabsApi.onUpdated.addListener).toHaveBeenCalledTimes(1);
    expect(tabsApi.onActivated.addListener).toHaveBeenCalledTimes(1);
  });

  it('calls refresh and onUpdate callback when tab event fires', async () => {
    let onCreatedCallback: (() => void) | null = null;

    const tabsApi = {
      query: vi.fn((_: object, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([])),
      onCreated: {
        addListener: vi.fn((cb: () => void) => {
          onCreatedCallback = cb;
        }),
      },
      onRemoved: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
    };

    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    const onUpdate = vi.fn();
    cache.setupListeners(onUpdate);

    // Simulate a tab created event
    onCreatedCallback!();

    // Allow async refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tabsApi.query).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('updates cached items after refresh is called again', async () => {
    let storedTabs: chrome.tabs.Tab[] = [];
    const tabsApi = {
      query: vi.fn((_: object, cb: (tabs: chrome.tabs.Tab[]) => void) => cb(storedTabs)),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
    };
    vi.stubGlobal('chrome', { tabs: tabsApi });

    const cache = new TabCache();
    await cache.refresh();
    expect(cache.getItems()).toHaveLength(0);

    storedTabs = [makeFakeTab({ id: 10, title: 'New Tab', url: 'https://new.com' })];
    await cache.refresh();
    expect(cache.getItems()).toHaveLength(1);
  });
});
