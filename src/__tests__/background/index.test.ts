import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMessageRouter, registerBackgroundListeners } from '../../entrypoints/background/index';
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
    frozen: false,
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
      query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        const tabs = [
          makeFakeTab({ id: 1, title: 'Tab One', url: 'https://one.com', lastAccessed: Date.now() }),
          makeFakeTab({ id: 2, title: 'Tab Two', url: 'https://two.com', lastAccessed: Date.now() - 1000 }),
        ];
        if (cb) cb(tabs);
        return Promise.resolve(tabs);
      }),
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
              { id: 'bm1', title: 'Bookmark One', url: 'https://bookmark-one.com', index: 0, dateAdded: Date.now() - 2000, syncing: false },
              { id: 'bm2', title: 'Bookmark Two', url: 'https://bookmark-two.com', index: 1, dateAdded: Date.now() - 3000, syncing: false },
            ],
            index: 0,
            syncing: false,
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
      chromeMock.tabs.query = vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        const tabs = [
          makeFakeTab({ id: 1, title: 'Tab 1', url: 'https://t1.com', lastAccessed: Date.now() }),
          makeFakeTab({ id: 2, title: 'Tab 2', url: 'https://t2.com', lastAccessed: Date.now() - 100 }),
          makeFakeTab({ id: 3, title: 'Tab 3', url: 'https://t3.com', lastAccessed: Date.now() - 200 }),
          makeFakeTab({ id: 4, title: 'Tab 4', url: 'https://t4.com', lastAccessed: Date.now() - 300 }),
          makeFakeTab({ id: 5, title: 'Tab 5', url: 'https://t5.com', lastAccessed: Date.now() - 400 }),
        ];
        cb?.(tabs);
        return Promise.resolve(tabs);
      });
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

  describe('URL scheme validation', () => {
    it('rejects javascript: URLs in NAVIGATE without touching tabs.update', async () => {
      const baseMock = makeChromeMock();
      const updateMock = vi.fn(() => Promise.resolve(makeFakeTab()));
      const chromeMock = {
        ...baseMock,
        tabs: { ...baseMock.tabs, update: updateMock },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const r = await router({ type: 'NAVIGATE', payload: { url: 'javascript:alert(1)' } }) as { success: boolean; error?: string };
      expect(r.success).toBe(false);
      expect(r.error).toContain('unsafe url');
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects data: URLs in NAVIGATE', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'NAVIGATE', payload: { url: 'data:text/html,<script>alert(1)</script>' } }) as { success: boolean };
      expect(r.success).toBe(false);
    });

    it('rejects file: URLs in OPEN_NEW_TAB without touching tabs.create', async () => {
      const baseMock = makeChromeMock();
      const createMock = vi.fn(() => Promise.resolve(makeFakeTab()));
      const chromeMock = {
        ...baseMock,
        tabs: { ...baseMock.tabs, create: createMock },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const r = await router({ type: 'OPEN_NEW_TAB', payload: { url: 'file:///etc/passwd' } }) as { success: boolean };
      expect(r.success).toBe(false);
      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects chrome-extension: URLs in NAVIGATE', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'NAVIGATE', payload: { url: 'chrome-extension://abc/evil.html' } }) as { success: boolean };
      expect(r.success).toBe(false);
    });

    it('rejects non-string url in NAVIGATE payload', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'NAVIGATE', payload: { url: 42 } }) as { success: boolean };
      expect(r.success).toBe(false);
    });
  });

  describe('SWITCH_TAB payload validation', () => {
    it('rejects a negative tabId before calling chrome.tabs.update', async () => {
      const baseMock = makeChromeMock();
      const updateMock = vi.fn(() => Promise.resolve(makeFakeTab()));
      const chromeMock = { ...baseMock, tabs: { ...baseMock.tabs, update: updateMock } };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const r = await router({ type: 'SWITCH_TAB', payload: { tabId: -1 } }) as { success: boolean; error?: string };
      expect(r.success).toBe(false);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects a non-integer tabId', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'SWITCH_TAB', payload: { tabId: 1.5 } }) as { success: boolean };
      expect(r.success).toBe(false);
    });

    it('rejects a missing payload', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'SWITCH_TAB' }) as { success: boolean };
      expect(r.success).toBe(false);
    });
  });

  describe('NAVIGATE target tab selection', () => {
    it('prefers sender.tab.id over the active tab when forwarding', async () => {
      const baseMock = makeChromeMock();
      const updateMock = vi.fn(() => Promise.resolve(makeFakeTab()));
      const queryMock = vi.fn((queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        if (cb) {
          cb([makeFakeTab({ id: 1 })]);
          return;
        }
        return Promise.resolve([makeFakeTab({ id: 99, active: true })]);
      });
      const chromeMock = {
        ...baseMock,
        tabs: { ...baseMock.tabs, update: updateMock, query: queryMock },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      await router(
        { type: 'NAVIGATE', payload: { url: 'https://example.com' } },
        { id: chrome.runtime.id, tab: makeFakeTab({ id: 42 }) } as chrome.runtime.MessageSender
      );

      expect(updateMock).toHaveBeenCalledWith(42, { url: 'https://example.com' });
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

  // ─── GET_ALL_TABS tests ────────────────────────────────────────────────────

  // Helper: dual-mode tabs.query mock (callback for init, promise for handler)
  function makeDualQueryMock(tabs: chrome.tabs.Tab[]) {
    return vi.fn((_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
      if (cb) { cb(tabs); return; }
      return Promise.resolve(tabs);
    });
  }

  // Helper: dual-mode bookmarks.getTree mock. Accepts a loose fixture tree so
  // tests don't need to spell out every @types/chrome field (e.g. `syncing`)
  // on deeply-nested nodes — production code only reads id/title/url/children.
  type LooseBookmarkNode = Omit<chrome.bookmarks.BookmarkTreeNode, 'children' | 'syncing'> & {
    children?: LooseBookmarkNode[];
    syncing?: boolean;
  };
  function makeDualGetTreeMock(tree: LooseBookmarkNode[]) {
    const cast = tree as unknown as chrome.bookmarks.BookmarkTreeNode[];
    return vi.fn((cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
      if (cb) { cb(cast); return; }
      return Promise.resolve(cast);
    });
  }

  describe('GET_ALL_TABS message', () => {
    it('returns flat "Open Tabs" group for single window, no tab groups', async () => {
      const baseMock = makeChromeMock();
      const tabs = [
        makeFakeTab({ id: 1, windowId: 1, title: 'Tab One', url: 'https://one.com', groupId: -1 }),
        makeFakeTab({ id: 2, windowId: 1, title: 'Tab Two', url: 'https://two.com', groupId: -1 }),
      ];
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: makeDualQueryMock(tabs),
        },
        windows: {
          ...baseMock.windows,
          getAll: vi.fn(() =>
            Promise.resolve([
              { id: 1, focused: true, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' },
            ])
          ),
        },
        tabGroups: undefined, // Firefox / no tabGroups support
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_ALL_TABS' }) as { groups: Array<{ label: string; type: string; tabs: unknown[] }> };

      expect(response).toHaveProperty('groups');
      expect(response.groups).toHaveLength(1);
      expect(response.groups[0].label).toBe('Open Tabs');
      expect(response.groups[0].type).toBe('window');
      expect(response.groups[0].tabs).toHaveLength(2);
    });

    it('returns 0 groups when there are no tabs', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: makeDualQueryMock([]),
        },
        windows: {
          ...baseMock.windows,
          getAll: vi.fn(() =>
            Promise.resolve([
              { id: 1, focused: true, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' },
            ])
          ),
        },
        tabGroups: undefined,
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_ALL_TABS' }) as { groups: unknown[] };
      expect(response.groups).toHaveLength(0);
    });

    it('groups tabs by window when multiple windows exist', async () => {
      const baseMock = makeChromeMock();
      const tabs = [
        makeFakeTab({ id: 1, windowId: 1, title: 'Tab One', url: 'https://one.com', groupId: -1 }),
        makeFakeTab({ id: 2, windowId: 2, title: 'Tab Two', url: 'https://two.com', groupId: -1 }),
      ];
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: makeDualQueryMock(tabs),
        },
        windows: {
          ...baseMock.windows,
          getAll: vi.fn(() =>
            Promise.resolve([
              { id: 1, focused: true, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' },
              { id: 2, focused: false, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' },
            ])
          ),
        },
        tabGroups: undefined,
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_ALL_TABS' }) as { groups: Array<{ label: string; type: string; tabs: unknown[] }> };

      expect(response.groups).toHaveLength(2);
      expect(response.groups[0].label).toBe('Window 1');
      expect(response.groups[1].label).toBe('Window 2');
      expect(response.groups[0].tabs).toHaveLength(1);
      expect(response.groups[1].tabs).toHaveLength(1);
    });

    it('groups tabs by tab group when chrome.tabGroups is available', async () => {
      const baseMock = makeChromeMock();
      const tabs = [
        makeFakeTab({ id: 1, windowId: 1, title: 'Tab One', groupId: 10 }),
        makeFakeTab({ id: 2, windowId: 1, title: 'Tab Two', groupId: 10 }),
        makeFakeTab({ id: 3, windowId: 1, title: 'Ungrouped', groupId: -1 }),
      ];
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: makeDualQueryMock(tabs),
        },
        windows: {
          ...baseMock.windows,
          getAll: vi.fn(() =>
            Promise.resolve([
              { id: 1, focused: true, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' },
            ])
          ),
        },
        tabGroups: {
          query: vi.fn(() =>
            Promise.resolve([
              { id: 10, title: 'My Group', color: 'blue', windowId: 1, collapsed: false },
            ])
          ),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_ALL_TABS' }) as { groups: Array<{ label: string; type: string; tabs: unknown[] }> };

      expect(response.groups.length).toBeGreaterThanOrEqual(2);
      const myGroup = response.groups.find(g => g.label === 'My Group');
      expect(myGroup).toBeDefined();
      expect(myGroup!.type).toBe('tabGroup');
      expect(myGroup!.tabs).toHaveLength(2);

      const ungrouped = response.groups.find(g => g.label.includes('Ungrouped'));
      expect(ungrouped).toBeDefined();
      expect(ungrouped!.tabs).toHaveLength(1);
    });
  });

  // ─── GET_BOOKMARK_TREE tests ───────────────────────────────────────────────

  describe('GET_BOOKMARK_TREE message', () => {
    it('returns a tree of bookmark nodes', async () => {
      const baseMock = makeChromeMock();
      const tree = [
        {
          id: 'root',
          title: '',
          index: 0,
          children: [
            {
              id: 'f1',
              title: 'Bookmarks Bar',
              index: 0,
              children: [
                { id: 'bm1', title: 'Site A', url: 'https://a.com', dateAdded: 1000, index: 0 },
                { id: 'bm2', title: 'Site B', url: 'https://b.com', dateAdded: 2000, index: 1 },
              ],
            },
            {
              id: 'f2',
              title: 'Other Bookmarks',
              index: 1,
              children: [
                { id: 'bm3', title: 'Site C', url: 'https://c.com', dateAdded: 3000, index: 0 },
              ],
            },
          ],
        },
      ];
      const chromeMock = {
        ...baseMock,
        bookmarks: {
          ...baseMock.bookmarks,
          getTree: makeDualGetTreeMock(tree),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_BOOKMARK_TREE' }) as { tree: Array<{ id: string; title: string; children?: unknown[] }> };

      expect(response).toHaveProperty('tree');
      expect(response.tree).toHaveLength(2);
      expect(response.tree[0].title).toBe('Bookmarks Bar');
      expect(response.tree[0].children).toHaveLength(2);
    });

    it('filters out empty root folders', async () => {
      const baseMock = makeChromeMock();
      const tree = [
        {
          id: 'root',
          title: '',
          index: 0,
          children: [
            {
              id: 'f1',
              title: 'Bookmarks Bar',
              index: 0,
              children: [
                { id: 'bm1', title: 'Site A', url: 'https://a.com', index: 0 },
              ],
            },
            {
              id: 'f2',
              title: 'Mobile Bookmarks',
              index: 1,
              children: [], // empty — should be filtered
            },
          ],
        },
      ];
      const chromeMock = {
        ...baseMock,
        bookmarks: {
          ...baseMock.bookmarks,
          getTree: makeDualGetTreeMock(tree),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_BOOKMARK_TREE' }) as { tree: Array<{ id: string; title: string }> };

      expect(response.tree).toHaveLength(1);
      expect(response.tree[0].title).toBe('Bookmarks Bar');
    });

    it('handles nested folders correctly', async () => {
      const baseMock = makeChromeMock();
      const tree = [
        {
          id: 'root',
          title: '',
          index: 0,
          children: [
            {
              id: 'f1',
              title: 'Bookmarks Bar',
              index: 0,
              children: [
                {
                  id: 'sub1',
                  title: 'Subfolder',
                  index: 0,
                  children: [
                    { id: 'bm1', title: 'Deep Site', url: 'https://deep.com', index: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const chromeMock = {
        ...baseMock,
        bookmarks: {
          ...baseMock.bookmarks,
          getTree: makeDualGetTreeMock(tree),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_BOOKMARK_TREE' }) as { tree: Array<{ children?: Array<{ title: string; children?: unknown[] }> }> };

      expect(response.tree).toHaveLength(1);
      const folder = response.tree[0].children?.[0];
      expect(folder?.title).toBe('Subfolder');
      expect(folder?.children).toHaveLength(1);
    });

    it('returns empty tree when root has no children', async () => {
      const baseMock = makeChromeMock();
      const tree = [{ id: 'root', title: '', index: 0, children: [] }];
      const chromeMock = {
        ...baseMock,
        bookmarks: {
          ...baseMock.bookmarks,
          getTree: makeDualGetTreeMock(tree),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_BOOKMARK_TREE' }) as { tree: unknown[] };

      expect(response.tree).toHaveLength(0);
    });

  });
});

describe('registerBackgroundListeners', () => {
  it('rejects messages whose sender.id is not the extension id', async () => {
    const onMessageListeners: Array<(m: unknown, s: unknown, r: (resp: unknown) => void) => boolean | void> = [];
    const chromeMock = {
      runtime: {
        id: 'real-ext-id',
        onMessage: { addListener: vi.fn((fn) => onMessageListeners.push(fn)) },
        onInstalled: { addListener: vi.fn() },
        getURL: vi.fn((p: string) => `chrome-extension://fake/${p}`),
      },
      commands: { onCommand: { addListener: vi.fn() } },
      tabs: {
        query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => { cb?.([]); return Promise.resolve([]); }),
        onCreated: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
        onUpdated: { addListener: vi.fn() },
        onActivated: { addListener: vi.fn() },
      },
      bookmarks: {
        getTree: vi.fn((cb: (r: chrome.bookmarks.BookmarkTreeNode[]) => void) => cb([])),
        onCreated: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
        onChanged: { addListener: vi.fn() },
      },
      history: {
        search: vi.fn((_: object, cb: (r: chrome.history.HistoryItem[]) => void) => cb([])),
      },
      storage: {
        sync: {
          get: vi.fn((_: string, cb: (r: Record<string, unknown>) => void) => cb({})),
          set: vi.fn(),
        },
      },
      alarms: {
        create: vi.fn(),
        clear: vi.fn(),
        onAlarm: { addListener: vi.fn() },
      },
    };
    vi.stubGlobal('chrome', chromeMock);

    registerBackgroundListeners();
    expect(onMessageListeners.length).toBe(1);

    const fn = onMessageListeners[0];
    const responses: unknown[] = [];
    const sendResponse = (r: unknown) => responses.push(r);

    const kept = fn(
      { type: 'GET_SETTINGS' },
      { id: 'attacker-ext-id' },
      sendResponse
    );

    expect(kept).toBe(false);
    expect(responses).toHaveLength(1);
    expect(responses[0]).toEqual({ error: 'forbidden sender' });
  });
});

