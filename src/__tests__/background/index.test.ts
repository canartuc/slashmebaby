import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMessageRouter } from '../../entrypoints/background/index';
import type { SearchRequest, SmartSuggestionsRequest, ExecuteActionRequest, GetSettingsRequest } from '../../lib/messaging';

// ─── Chrome stub helpers ───────────────────────────────────────────────────

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
    groupId: -1,
    title: 'Test Tab',
    url: 'https://example.com',
    lastAccessed: Date.now(),
    mutedInfo: { muted: false },
    ...overrides,
  };
}

function makeChromeMock() {
  return {
    tabs: {
      query: vi.fn((_: object, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([
          makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com', lastAccessed: Date.now() }),
          makeFakeTab({ id: 2, title: 'Tab Two', url: 'https://two.com', lastAccessed: Date.now() - 1000 }),
        ])
      ),
      remove: vi.fn((_: number | number[], cb?: () => void) => cb?.()),
      create: vi.fn((_: object, cb?: (tab: chrome.tabs.Tab) => void) => cb?.(makeFakeTab({ id: 99 }))),
      duplicate: vi.fn((_: number, cb?: (tab: chrome.tabs.Tab) => void) => cb?.(makeFakeTab({ id: 100 }))),
      reload: vi.fn((_: number, __: object, cb?: () => void) => cb?.()),
      move: vi.fn((_: number | number[], __: object, cb?: (tabs: chrome.tabs.Tab | chrome.tabs.Tab[]) => void) => cb?.(makeFakeTab())),
      get: vi.fn((_: number, cb: (tab: chrome.tabs.Tab) => void) => cb(makeFakeTab())),
      update: vi.fn((_: number, __: object, cb?: (tab?: chrome.tabs.Tab) => void) => cb?.(makeFakeTab())),
      sendMessage: vi.fn(),
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
            children: [
              { id: 'bm1', title: 'Bookmark One', url: 'https://bookmark-one.com', index: 0, dateAdded: Date.now() - 2000 },
              { id: 'bm2', title: 'Bookmark Two', url: 'https://bookmark-two.com', index: 1, dateAdded: Date.now() - 3000 },
            ],
            index: 0,
          },
        ])
      ),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
    },
    history: {
      search: vi.fn((_: chrome.history.HistoryQuery, cb: (results: chrome.history.HistoryItem[]) => void) =>
        cb([
          { id: 'h1', title: 'History One', url: 'https://history-one.com', lastVisitTime: Date.now() - 4000, visitCount: 3, typedCount: 1 },
        ])
      ),
    },
    windows: {
      create: vi.fn((_: object, cb?: (win: chrome.windows.Window) => void) =>
        cb?.({ id: 200, focused: true, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' })
      ),
    },
    sessions: {
      getRecentlyClosed: vi.fn((cb: (sessions: chrome.sessions.Session[]) => void) => cb([])),
      restore: vi.fn((_?: string, cb?: (session: chrome.sessions.Session) => void) =>
        cb?.({ lastModified: 0 })
      ),
    },
    runtime: {
      openOptionsPage: vi.fn((cb?: () => void) => cb?.()),
      getURL: vi.fn((path: string) => `chrome-extension://fake/${path}`),
      onMessage: { addListener: vi.fn() },
    },
    storage: {
      sync: {
        get: vi.fn((_: string, cb: (result: Record<string, unknown>) => void) => cb({})),
        set: vi.fn((_: Record<string, unknown>, cb?: () => void) => cb?.()),
      },
    },
    commands: {
      onCommand: { addListener: vi.fn() },
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('createMessageRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', makeChromeMock());
  });

  it('returns a function (the message handler)', async () => {
    const router = await createMessageRouter();
    expect(typeof router).toBe('function');
  });

  it('loads tabs, bookmarks and history during initialization', async () => {
    const chromeMock = makeChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    await createMessageRouter();

    expect(chromeMock.tabs.query).toHaveBeenCalled();
    expect(chromeMock.bookmarks.getTree).toHaveBeenCalled();
    expect(chromeMock.history.search).toHaveBeenCalled();
  });

  describe('SEARCH message', () => {
    it('returns grouped search results for tabs', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const request: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'Tab', sources: ['tabs'] },
      };

      const response = await router(request) as { groups: unknown[] };
      expect(response).toHaveProperty('groups');
      expect(Array.isArray(response.groups)).toBe(true);
    });

    it('always includes actions regardless of sources', async () => {
      const router = await createMessageRouter();
      const request: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'close', sources: ['tabs'] },
      };

      const response = await router(request) as { groups: Array<{ category: string }> };
      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
    });

    it('searches across multiple sources', async () => {
      const router = await createMessageRouter();
      const request: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'one', sources: ['tabs', 'bookmarks', 'history'] },
      };

      const response = await router(request) as { groups: Array<{ category: string }> };
      expect(response.groups.length).toBeGreaterThan(0);
    });
  });

  describe('SMART_SUGGESTIONS message', () => {
    it('returns groups for smart suggestions', async () => {
      const router = await createMessageRouter();
      const request: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };

      const response = await router(request) as { groups: unknown[] };
      expect(response).toHaveProperty('groups');
      expect(Array.isArray(response.groups)).toBe(true);
    });

    it('returns at most 3 tabs in smart suggestions', async () => {
      const chromeMock = makeChromeMock();
      // Mock 5 tabs
      chromeMock.tabs.query = vi.fn((_: object, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([
          makeFakeTab({ id: 1, title: 'Tab 1', url: 'https://t1.com', lastAccessed: Date.now() }),
          makeFakeTab({ id: 2, title: 'Tab 2', url: 'https://t2.com', lastAccessed: Date.now() - 100 }),
          makeFakeTab({ id: 3, title: 'Tab 3', url: 'https://t3.com', lastAccessed: Date.now() - 200 }),
          makeFakeTab({ id: 4, title: 'Tab 4', url: 'https://t4.com', lastAccessed: Date.now() - 300 }),
          makeFakeTab({ id: 5, title: 'Tab 5', url: 'https://t5.com', lastAccessed: Date.now() - 400 }),
        ])
      );
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const request: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };

      const response = await router(request) as { groups: Array<{ category: string; items: unknown[] }> };
      const tabGroup = response.groups.find((g) => g.category === 'tabs');
      if (tabGroup) {
        expect(tabGroup.items.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('EXECUTE_ACTION message', () => {
    it('executes an action and returns success', async () => {
      const router = await createMessageRouter();
      const request: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'action-new-tab' },
      };

      const response = await router(request) as { success: boolean };
      expect(response.success).toBe(true);
    });

    it('strips "action-" prefix before delegating to registry', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const request: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'action-new-tab' },
      };

      await router(request);
      expect(chromeMock.tabs.create).toHaveBeenCalled();
    });

    it('forwards targetTabId to registry', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const request: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'action-close-tab', targetTabId: 42 },
      };

      await router(request);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
    });
  });

  describe('GET_SETTINGS message', () => {
    it('returns settings object', async () => {
      const router = await createMessageRouter();
      const request: GetSettingsRequest = { type: 'GET_SETTINGS' };

      const response = await router(request) as { settings: unknown };
      expect(response).toHaveProperty('settings');
      expect(response.settings).toBeTruthy();
    });

    it('returns default settings when storage is empty', async () => {
      const router = await createMessageRouter();
      const request: GetSettingsRequest = { type: 'GET_SETTINGS' };

      const response = await router(request) as { settings: { shortcut: string } };
      expect(response.settings.shortcut).toBe('Ctrl+Shift+Space');
    });
  });

  describe('unknown message type', () => {
    it('returns error for unknown message type', async () => {
      const router = await createMessageRouter();
      const response = await router({ type: 'UNKNOWN_TYPE' }) as { error: string };
      expect(response).toHaveProperty('error');
      expect(response.error).toBeTruthy();
    });
  });

  describe('SWITCH_TAB message', () => {
    it('returns success when switching to a valid tab', async () => {
      // Build a fresh chrome mock with promise-returning update/get/windows.update
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          update: vi.fn(() => Promise.resolve(makeFakeTab())),
          get: vi.fn(() => Promise.resolve(makeFakeTab({ windowId: 1 }))),
        },
        windows: {
          ...baseMock.windows,
          update: vi.fn(() => Promise.resolve()),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SWITCH_TAB', payload: { tabId: 1 } }) as { success: boolean };
      expect(response.success).toBe(true);
    });

    it('returns failure when switching throws an error', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          update: vi.fn(() => Promise.reject(new Error('Tab not found'))),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SWITCH_TAB', payload: { tabId: 999 } }) as { success: boolean; error: string };
      expect(response.success).toBe(false);
      expect(response.error).toContain('Tab not found');
    });
  });

  describe('NAVIGATE message', () => {
    it('updates active tab URL when active tab exists', async () => {
      const baseMock = makeChromeMock();
      // For NAVIGATE, tabs.query needs to return a Promise (the router uses await)
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          // initialization (callback style) + navigate (promise style)
          query: vi.fn((queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
            if (cb) {
              // callback-style call (used by TabCache.refresh in init)
              cb([makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com', lastAccessed: Date.now() })]);
              return;
            }
            // Promise-style call (used by NAVIGATE handler)
            return Promise.resolve([makeFakeTab({ id: 5, active: true })]);
          }),
          update: vi.fn(() => Promise.resolve(makeFakeTab())),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'NAVIGATE', payload: { url: 'https://example.com' } }) as { success: boolean };
      expect(response.success).toBe(true);
    });

    it('creates new tab when no active tab exists', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: vi.fn((queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
            if (cb) {
              cb([makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com', lastAccessed: Date.now() })]);
              return;
            }
            return Promise.resolve([]);
          }),
          create: vi.fn((props: object, cb?: (tab: chrome.tabs.Tab) => void) => {
            if (cb) { cb(makeFakeTab({ id: 99 })); return; }
            return Promise.resolve(makeFakeTab({ id: 99 }));
          }),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'NAVIGATE', payload: { url: 'https://newpage.com' } }) as { success: boolean };
      expect(response.success).toBe(true);
    });

    it('returns failure when navigate throws an error', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: vi.fn((queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
            if (cb) {
              cb([makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com', lastAccessed: Date.now() })]);
              return;
            }
            return Promise.reject(new Error('Query failed'));
          }),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'NAVIGATE', payload: { url: 'https://example.com' } }) as { success: boolean; error: string };
      expect(response.success).toBe(false);
      expect(response.error).toContain('Query failed');
    });
  });

  describe('EXECUTE_ACTION without action- prefix', () => {
    it('executes action without action- prefix stripping', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const request: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'new-tab' }, // no 'action-' prefix
      };

      const response = await router(request) as { success: boolean };
      expect(response.success).toBe(true);
      expect(chromeMock.tabs.create).toHaveBeenCalled();
    });
  });

  describe('SEARCH with different source combinations', () => {
    it('returns results with only bookmarks source', async () => {
      const router = await createMessageRouter();
      const request: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'Bookmark', sources: ['bookmarks'] },
      };

      const response = await router(request) as { groups: unknown[] };
      expect(response).toHaveProperty('groups');
    });

    it('returns results with only history source', async () => {
      const router = await createMessageRouter();
      const request: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'History', sources: ['history'] },
      };

      const response = await router(request) as { groups: unknown[] };
      expect(response).toHaveProperty('groups');
    });

    it('returns results with empty sources array (actions only)', async () => {
      const router = await createMessageRouter();
      const request: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'tab', sources: [] },
      };

      const response = await router(request) as { groups: Array<{ category: string }> };
      expect(response).toHaveProperty('groups');
      // Only actions should be present
      const nonActionGroups = response.groups.filter((g) => g.category !== 'actions');
      expect(nonActionGroups).toHaveLength(0);
    });
  });
});
