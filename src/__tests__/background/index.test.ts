import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import backgroundEntrypoint, { createMessageRouter, registerBackgroundListeners } from '../../entrypoints/background/index';
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
      getManifest: vi.fn(() => ({ action: { default_popup: 'popup.html' } })),
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    action: {
      setPopup: vi.fn((_: object, cb?: () => void) => cb?.()),
      openPopup: vi.fn(() => Promise.resolve()),
      onClicked: { addListener: vi.fn() },
    },
    extension: {
      isAllowedFileSchemeAccess: vi.fn((cb: (allowed: boolean) => void) => cb(false)),
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

    it('returns the 2 most recently added bookmarks (dateAdded desc, not tree order)', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.bookmarks.getTree = vi.fn((cb: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) =>
        cb([
          {
            id: 'root',
            title: 'Root',
            children: [
              // Tree order deliberately differs from dateAdded order.
              { id: 'old', title: 'Oldest', url: 'https://oldest.com', index: 0, dateAdded: 1000, syncing: false },
              { id: 'new', title: 'Newest', url: 'https://newest.com', index: 1, dateAdded: 5000, syncing: false },
              { id: 'mid', title: 'Middle', url: 'https://middle.com', index: 2, dateAdded: 3000, syncing: false },
            ],
            index: 0,
            syncing: false,
          },
        ])
      );
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: Array<{ id: string; title: string }> }>;
      };
      const bookmarkGroup = response.groups.find((g) => g.category === 'bookmarks');
      expect(bookmarkGroup).toBeDefined();
      expect(bookmarkGroup!.items.map((i) => i.id)).toEqual(['bookmark-new', 'bookmark-mid']);
    });

    it('suggests contextual actions for the sender tab (Unpin for a pinned tab)', async () => {
      const router = await createMessageRouter();
      const sender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 7, pinned: true, audible: false, mutedInfo: { muted: false } }),
      } as chrome.runtime.MessageSender;

      const response = await router({ type: 'SMART_SUGGESTIONS' }, sender) as {
        groups: Array<{ category: string; items: Array<{ id: string; title: string }> }>;
      };
      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
      expect(actionGroup!.items).toHaveLength(2);
      const pin = actionGroup!.items.find((i) => i.id === 'action-pin-tab');
      expect(pin).toBeDefined();
      expect(pin!.title).toBe('Unpin Tab');
    });

    it('suggests Unmute first when the sender tab is muted', async () => {
      const router = await createMessageRouter();
      const sender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 7, pinned: false, audible: false, mutedInfo: { muted: true } }),
      } as chrome.runtime.MessageSender;

      const response = await router({ type: 'SMART_SUGGESTIONS' }, sender) as {
        groups: Array<{ category: string; items: Array<{ id: string; title: string }> }>;
      };
      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup!.items[0].id).toBe('action-mute-tab');
      expect(actionGroup!.items[0].title).toBe('Unmute Tab');
    });

    it('falls back to the active tab for context when there is no sender tab', async () => {
      // Default mock: active tab 1 is unpinned and silent → Pin Tab + New Tab.
      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: Array<{ id: string; title: string }> }>;
      };
      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
      expect(actionGroup!.items.map((i) => i.id)).toEqual(['action-pin-tab', 'action-new-tab']);
      expect(actionGroup!.items.map((i) => i.title)).toEqual(['Pin Tab', 'New Tab']);
    });

    // ── Settings "Search Sources" toggles apply to suggestions too ──────────

    function stubStoredSearchSources(
      chromeMock: ReturnType<typeof makeChromeMock>,
      searchSources: { tabs: boolean; bookmarks: boolean; history: boolean }
    ) {
      chromeMock.storage.sync.get = vi.fn(
        (_: string, cb: (result: Record<string, unknown>) => void) =>
          cb({ settings: { searchSources } })
      );
    }

    it('omits the tabs group when searchSources.tabs is toggled off', async () => {
      const chromeMock = makeChromeMock();
      stubStoredSearchSources(chromeMock, { tabs: false, bookmarks: true, history: true });
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: unknown[] }>;
      };
      expect(response.groups.find((g) => g.category === 'tabs')).toBeUndefined();
      expect(response.groups.find((g) => g.category === 'bookmarks')).toBeDefined();
      expect(response.groups.find((g) => g.category === 'actions')).toBeDefined();
    });

    it('omits the bookmarks group when searchSources.bookmarks is toggled off', async () => {
      const chromeMock = makeChromeMock();
      stubStoredSearchSources(chromeMock, { tabs: true, bookmarks: false, history: true });
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: unknown[] }>;
      };
      expect(response.groups.find((g) => g.category === 'bookmarks')).toBeUndefined();
      expect(response.groups.find((g) => g.category === 'tabs')).toBeDefined();
      expect(response.groups.find((g) => g.category === 'actions')).toBeDefined();
    });

    it('still suggests actions when every search source is toggled off', async () => {
      const chromeMock = makeChromeMock();
      stubStoredSearchSources(chromeMock, { tabs: false, bookmarks: false, history: false });
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: unknown[] }>;
      };
      expect(response.groups.find((g) => g.category === 'tabs')).toBeUndefined();
      expect(response.groups.find((g) => g.category === 'bookmarks')).toBeUndefined();
      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
      expect(actionGroup!.items.length).toBeGreaterThan(0);
    });

    // ── Self-referential suggestions (the extension's own pages) ────────────

    it("excludes the extension's own chrome-extension:// pages from tab suggestions", async () => {
      const chromeMock = makeChromeMock();
      (chromeMock.runtime as { id?: string }).id = 'fake-ext-id';
      chromeMock.tabs.query = vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        const tabs = [
          makeFakeTab({ id: 1, title: 'SlashMeBaby Settings', url: 'chrome-extension://fake-ext-id/settings.html', lastAccessed: Date.now() }),
          makeFakeTab({ id: 2, title: 'Tab Two', url: 'https://two.com', lastAccessed: Date.now() - 1000 }),
          makeFakeTab({ id: 3, title: 'Tab Three', url: 'https://three.com', lastAccessed: Date.now() - 2000 }),
          makeFakeTab({ id: 4, title: 'Tab Four', url: 'https://four.com', lastAccessed: Date.now() - 3000 }),
        ];
        cb?.(tabs);
        return Promise.resolve(tabs);
      });
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: Array<{ id: string; url?: string }> }>;
      };
      const tabGroup = response.groups.find((g) => g.category === 'tabs');
      expect(tabGroup).toBeDefined();
      // The own-extension page (most recent!) is skipped; the next 3 fill the slots.
      expect(tabGroup!.items.map((i) => i.id)).toEqual(['tab-2', 'tab-3', 'tab-4']);
    });

    it("keeps other extensions' pages in tab suggestions (only its own are filtered)", async () => {
      const chromeMock = makeChromeMock();
      (chromeMock.runtime as { id?: string }).id = 'fake-ext-id';
      chromeMock.tabs.query = vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        const tabs = [
          makeFakeTab({ id: 1, title: 'Other Extension', url: 'chrome-extension://other-ext-id/page.html', lastAccessed: Date.now() }),
          makeFakeTab({ id: 2, title: 'Tab Two', url: 'https://two.com', lastAccessed: Date.now() - 1000 }),
        ];
        cb?.(tabs);
        return Promise.resolve(tabs);
      });
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'SMART_SUGGESTIONS' }) as {
        groups: Array<{ category: string; items: Array<{ id: string }> }>;
      };
      const tabGroup = response.groups.find((g) => g.category === 'tabs');
      expect(tabGroup!.items.map((i) => i.id)).toEqual(['tab-1', 'tab-2']);
    });
  });

  describe('SEARCH contextual action labels (F09)', () => {
    it('labels the pin action "Unpin Tab" when the sender tab is pinned', async () => {
      const router = await createMessageRouter();
      const sender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 7, pinned: true, audible: false, mutedInfo: { muted: false } }),
      } as chrome.runtime.MessageSender;

      const response = await router(
        { type: 'SEARCH', payload: { query: 'pin', sources: [] } },
        sender
      ) as { groups: Array<{ category: string; items: Array<{ id: string; title: string }> }> };

      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
      const pin = actionGroup!.items.find((i) => i.id === 'action-pin-tab');
      expect(pin).toBeDefined();
      expect(pin!.title).toBe('Unpin Tab');
    });

    it('omits the mute action when the sender tab is silent and unmuted', async () => {
      const router = await createMessageRouter();
      const sender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 7, pinned: false, audible: false, mutedInfo: { muted: false } }),
      } as chrome.runtime.MessageSender;

      const response = await router(
        { type: 'SEARCH', payload: { query: 'mute', sources: [] } },
        sender
      ) as { groups: Array<{ category: string; items: Array<{ id: string }> }> };

      for (const group of response.groups) {
        expect(group.items.find((i) => i.id === 'action-mute-tab')).toBeUndefined();
      }
    });

    it('uses default action labels when no tab context can be resolved', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          // Callback style (cache init) succeeds; promise style (the
          // active-tab context lookup) rejects, e.g. no window focused.
          query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
            if (cb) { cb([]); return; }
            return Promise.reject(new Error('no active tab'));
          }),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router(
        { type: 'SEARCH', payload: { query: 'mute', sources: [] } }
      ) as { groups: Array<{ category: string; items: Array<{ id: string; title: string }> }> };

      // Without a context the mute action stays visible with its default label.
      const actionGroup = response.groups.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
      const mute = actionGroup!.items.find((i) => i.id === 'action-mute-tab');
      expect(mute).toBeDefined();
      expect(mute!.title).toBe('Mute Tab');
    });

    it('rebuilds action labels when the tab context changes between searches', async () => {
      const router = await createMessageRouter();
      const pinnedSender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 7, pinned: true }),
      } as chrome.runtime.MessageSender;
      const unpinnedSender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 8, pinned: false }),
      } as chrome.runtime.MessageSender;

      const first = await router(
        { type: 'SEARCH', payload: { query: 'pin', sources: [] } },
        pinnedSender
      ) as { groups: Array<{ category: string; items: Array<{ id: string; title: string }> }> };
      const second = await router(
        { type: 'SEARCH', payload: { query: 'pin', sources: [] } },
        unpinnedSender
      ) as { groups: Array<{ category: string; items: Array<{ id: string; title: string }> }> };

      const firstPin = first.groups.find((g) => g.category === 'actions')!
        .items.find((i) => i.id === 'action-pin-tab');
      const secondPin = second.groups.find((g) => g.category === 'actions')!
        .items.find((i) => i.id === 'action-pin-tab');
      expect(firstPin!.title).toBe('Unpin Tab');
      expect(secondPin!.title).toBe('Pin Tab');
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

    it('falls back to the sender tab as the target when no explicit targetTabId is given', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const sender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 42 }),
      } as chrome.runtime.MessageSender;

      const response = await router(
        { type: 'EXECUTE_ACTION', payload: { actionId: 'action-close-tab' } },
        sender
      ) as { success: boolean };

      expect(response.success).toBe(true);
      // The sender's own tab (42) is closed, not the active tab (1).
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

  describe('OPEN_NEW_TAB message', () => {
    it('creates a new tab for a safe http(s) url', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({
        type: 'OPEN_NEW_TAB',
        payload: { url: 'https://example.com/' },
      }) as { success: boolean };

      expect(response.success).toBe(true);
      expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com/' });
    });

    it('returns failure when tabs.create rejects', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          create: vi.fn(() => Promise.reject(new Error('create failed'))),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({
        type: 'OPEN_NEW_TAB',
        payload: { url: 'https://example.com/' },
      }) as { success: boolean; error: string };

      expect(response.success).toBe(false);
      expect(response.error).toContain('create failed');
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
      const r = await router({ type: 'NAVIGATE', payload: { url: 42 } }) as { success?: boolean };
      expect(r.success).not.toBe(true);
    });
  });

  describe('SWITCH_TAB payload validation', () => {
    it('rejects a negative tabId before calling chrome.tabs.update', async () => {
      const baseMock = makeChromeMock();
      const updateMock = vi.fn(() => Promise.resolve(makeFakeTab()));
      const chromeMock = { ...baseMock, tabs: { ...baseMock.tabs, update: updateMock } };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const r = await router({ type: 'SWITCH_TAB', payload: { tabId: -1 } }) as { success?: boolean };
      expect(r.success).not.toBe(true);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects a non-integer tabId', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'SWITCH_TAB', payload: { tabId: 1.5 } }) as { success?: boolean };
      expect(r.success).not.toBe(true);
    });

    it('rejects a missing payload', async () => {
      vi.stubGlobal('chrome', makeChromeMock());
      const router = await createMessageRouter();
      const r = await router({ type: 'SWITCH_TAB' }) as { success?: boolean };
      expect(r.success).not.toBe(true);
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

    it('skips windows with no tabs when grouping by window', async () => {
      const baseMock = makeChromeMock();
      // All tabs live in window 1; window 2 is empty (e.g. devtools popout).
      const tabs = [
        makeFakeTab({ id: 1, windowId: 1, title: 'Tab One', groupId: -1 }),
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
      const response = await router({ type: 'GET_ALL_TABS' }) as { groups: Array<{ label: string; tabs: unknown[] }> };

      expect(response.groups).toHaveLength(1);
      expect(response.groups[0].label).toBe('Window 1');
      expect(response.groups[0].tabs).toHaveLength(1);
    });

    it('skips empty windows and labels ungrouped tabs per window when tab groups exist', async () => {
      const baseMock = makeChromeMock();
      // Window 1 holds a tab group plus an ungrouped tab; window 2 is empty.
      const tabs = [
        makeFakeTab({ id: 1, windowId: 1, title: 'Grouped One', groupId: 10 }),
        makeFakeTab({ id: 2, windowId: 1, title: 'Grouped Two', groupId: 10 }),
        makeFakeTab({ id: 3, windowId: 1, title: 'Loose', groupId: -1 }),
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

      // Only window 1 produces sections; the empty window 2 is skipped.
      expect(response.groups).toHaveLength(2);
      expect(response.groups.map((g) => g.label)).toEqual(['My Group', 'Window 1 — Ungrouped']);
    });

    it('surfaces an error when a queried tab has no id (mapTab guard)', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          query: makeDualQueryMock([makeFakeTab({ id: undefined })]),
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
      // The rejection is converted to an { error } response by the onMessage
      // listener's catch in registerBackgroundListeners.
      await expect(router({ type: 'GET_ALL_TABS' })).rejects.toThrow(
        'mapTab called with tab.id === undefined'
      );
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

    it('drops bookmark leaves with non-navigable schemes', async () => {
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
                { id: 'bm1', title: 'Safe Site', url: 'https://safe.com', index: 0 },
                { id: 'bm2', title: 'Bookmarklet', url: 'javascript:alert(1)', index: 1 },
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
      const response = await router({ type: 'GET_BOOKMARK_TREE' }) as {
        tree: Array<{ children?: Array<{ id: string }> }>;
      };

      // The javascript: bookmarklet is stripped; the safe leaf survives.
      expect(response.tree).toHaveLength(1);
      expect(response.tree[0].children!.map((c) => c.id)).toEqual(['bm1']);
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

  // ─── GET_HISTORY_ITEMS tests (F04 overlay history) ─────────────────────────

  describe('GET_HISTORY_ITEMS message', () => {
    it('returns the cached history items in a typed shape', async () => {
      const chromeMock = makeChromeMock();
      const now = Date.now();
      chromeMock.history.search = vi.fn(
        (_: chrome.history.HistoryQuery, cb: (results: chrome.history.HistoryItem[]) => void) =>
          cb([
            { id: 'h1', title: 'History One', url: 'https://history-one.com', lastVisitTime: now - 4000, visitCount: 3, typedCount: 1 },
            { id: 'h2', title: 'History Two', url: 'https://history-two.com', lastVisitTime: now - 8000, visitCount: 1, typedCount: 0 },
          ])
      );
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_HISTORY_ITEMS' }) as {
        items: Array<{ id: string; title: string; url: string; lastVisitTime?: number }>;
      };

      expect(response).toHaveProperty('items');
      expect(response.items).toHaveLength(2);
      expect(response.items[0]).toEqual({
        id: 'history-h1',
        title: 'History One',
        url: 'https://history-one.com',
        lastVisitTime: now - 4000,
      });
    });

    it('returns an empty list when there is no history', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.history.search = vi.fn(
        (_: chrome.history.HistoryQuery, cb: (results: chrome.history.HistoryItem[]) => void) => cb([])
      );
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_HISTORY_ITEMS' }) as { items: unknown[] };
      expect(response.items).toEqual([]);
    });
  });

  // ─── GET_ACTIONS tests (F12 overlay action mode) ───────────────────────────

  describe('GET_ACTIONS message', () => {
    it('returns the action list with ids and titles', async () => {
      const router = await createMessageRouter();
      const response = await router({ type: 'GET_ACTIONS' }) as {
        actions: Array<{ id: string; title: string }>;
      };

      expect(response).toHaveProperty('actions');
      expect(response.actions.length).toBeGreaterThan(0);
      const newTab = response.actions.find((a) => a.id === 'action-new-tab');
      expect(newTab).toBeDefined();
      expect(newTab!.title).toBe('New Tab');
    });

    it('contextualizes action labels to the sender tab (Unpin for pinned)', async () => {
      const router = await createMessageRouter();
      const sender = {
        id: 'real-ext-id',
        tab: makeFakeTab({ id: 7, pinned: true, audible: false, mutedInfo: { muted: false } }),
      } as chrome.runtime.MessageSender;

      const response = await router({ type: 'GET_ACTIONS' }, sender) as {
        actions: Array<{ id: string; title: string }>;
      };
      const pin = response.actions.find((a) => a.id === 'action-pin-tab');
      expect(pin).toBeDefined();
      expect(pin!.title).toBe('Unpin Tab');
      // Silent, unmuted tab → mute action hidden (F09)
      expect(response.actions.find((a) => a.id === 'action-mute-tab')).toBeUndefined();
    });

    it('falls back to default labels when the active-tab lookup fails', async () => {
      const baseMock = makeChromeMock();
      const chromeMock = {
        ...baseMock,
        tabs: {
          ...baseMock.tabs,
          // Callback style (cache init) succeeds; promise style (the
          // active-tab context lookup) rejects, e.g. no window focused.
          query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
            if (cb) { cb([]); return; }
            return Promise.reject(new Error('no active tab'));
          }),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const router = await createMessageRouter();
      const response = await router({ type: 'GET_ACTIONS' }) as {
        actions: Array<{ id: string; title: string }>;
      };

      // No context available → all 12 actions with their default labels.
      expect(response.actions).toHaveLength(12);
      expect(response.actions.find((a) => a.id === 'action-pin-tab')!.title).toBe('Pin Tab');
      expect(response.actions.find((a) => a.id === 'action-mute-tab')!.title).toBe('Mute Tab');
    });
  });

  describe('GET_FAVICON message', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.stubGlobal('chrome', makeChromeMock()); // restore chrome for other tests
    });

    it('returns a data: url for a fetchable favicon', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new Uint8Array([0, 255]).buffer,
      }));
      const router = await createMessageRouter();
      const res = await router({ type: 'GET_FAVICON', payload: { url: 'https://a.com/f.png' } });
      expect(res).toEqual({ dataUrl: 'data:image/png;base64,AP8=' });
    });

    it('returns { dataUrl: null } when the fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      const router = await createMessageRouter();
      const res = await router({ type: 'GET_FAVICON', payload: { url: 'https://a.com/f.png' } });
      expect(res).toEqual({ dataUrl: null });
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
        onStartup: { addListener: vi.fn() },
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

  // Harness for the command/action-routing wiring tests: captures the
  // onCommand listener and provides the action + extension APIs the routing
  // module needs. `lastError` controls whether callbacks see a runtime error.
  function makeCommandHarness(opts: { lastError?: boolean } = {}) {
    const commandListeners: Array<(cmd: string, tab?: chrome.tabs.Tab) => void> = [];
    let lastErrorReads = 0;
    const actionApi = {
      setPopup: vi.fn((_: object, cb?: () => void) => cb?.()),
      openPopup: vi.fn(() => Promise.resolve()),
      onClicked: { addListener: vi.fn() },
    };
    const activeTab = makeFakeTab({ id: 7, url: 'https://one.com' });
    const chromeMock = {
      runtime: {
        id: 'real-ext-id',
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        getURL: vi.fn((p: string) => `chrome-extension://fake/${p}`),
        getManifest: vi.fn(() => ({ action: { default_popup: 'popup.html' } })),
        get lastError() {
          lastErrorReads += 1;
          return opts.lastError
            ? { message: 'Could not establish connection. Receiving end does not exist.' }
            : undefined;
        },
      },
      commands: {
        onCommand: {
          addListener: vi.fn((cb: (cmd: string, tab?: chrome.tabs.Tab) => void) =>
            commandListeners.push(cb)
          ),
        },
      },
      action: actionApi,
      extension: {
        isAllowedFileSchemeAccess: vi.fn((cb: (allowed: boolean) => void) => cb(false)),
      },
      tabs: {
        query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
          cb?.([activeTab]);
          return Promise.resolve([activeTab]);
        }),
        get: vi.fn((_: number, cb?: (tab?: chrome.tabs.Tab) => void) => cb?.(activeTab)),
        sendMessage: vi.fn((_tabId: number, _msg: unknown, cb?: () => void) => cb?.()),
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
      history: { search: vi.fn((_: object, cb: (r: chrome.history.HistoryItem[]) => void) => cb([])) },
      storage: {
        sync: {
          get: vi.fn((_: string, cb: (r: Record<string, unknown>) => void) => cb({})),
          set: vi.fn(),
        },
      },
      alarms: { create: vi.fn(), clear: vi.fn(), onAlarm: { addListener: vi.fn() } },
    };
    vi.stubGlobal('chrome', chromeMock);
    registerBackgroundListeners();
    // The register() sweep touches setPopup/query; clear so tests assert
    // only what the command handler itself does.
    actionApi.setPopup.mockClear();
    chromeMock.tabs.query.mockClear();
    return {
      chromeMock,
      actionApi,
      commandListeners,
      readLastErrorCount: () => lastErrorReads,
    };
  }

  it('registers action click routing synchronously', () => {
    const { actionApi, chromeMock } = makeCommandHarness();
    expect(actionApi.onClicked.addListener).toHaveBeenCalledTimes(1);
    expect(chromeMock.tabs.onUpdated.addListener).toHaveBeenCalled();
    expect(chromeMock.tabs.onActivated.addListener).toHaveBeenCalled();
  });

  it('sweeps popup routing from onInstalled and onStartup, not from plain registration', () => {
    const { chromeMock } = makeCommandHarness();
    // Registration alone must not rewrite per-tab popup state (mockClear in
    // the harness ran after registerBackgroundListeners — query only fires
    // for warm-up caches, and setPopup was untouched by then; assert the
    // wired triggers instead).
    const installedListener = (
      chromeMock.runtime.onInstalled.addListener as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as (d: chrome.runtime.InstalledDetails) => void;
    installedListener({ reason: 'update' } as chrome.runtime.InstalledDetails);
    expect(chromeMock.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));

    chromeMock.tabs.query.mockClear();
    const startupListener = (
      chromeMock.runtime.onStartup.addListener as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as () => void;
    startupListener();
    expect(chromeMock.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
  });

  it('toggle-command-bar with a scriptable tab arg sends typed TOGGLE_OVERLAY without tabs.query', () => {
    const { chromeMock, commandListeners } = makeCommandHarness();
    expect(commandListeners).toHaveLength(1);

    commandListeners[0]('toggle-command-bar', makeFakeTab({ id: 7, url: 'https://one.com' }));
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: 'TOGGLE_OVERLAY' },
      expect.any(Function)
    );
    expect(chromeMock.tabs.query).not.toHaveBeenCalled();
  });

  it('toggle-command-bar with a restricted tab arg calls action.openPopup synchronously', () => {
    const { chromeMock, actionApi, commandListeners } = makeCommandHarness();

    commandListeners[0]('toggle-command-bar', makeFakeTab({ id: 8, url: 'chrome://newtab/' }));
    expect(actionApi.openPopup).toHaveBeenCalledTimes(1);
    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
    expect(chromeMock.tabs.query).not.toHaveBeenCalled();
  });

  it('toggle-command-bar without a tab arg falls back to tabs.query (legacy Chrome)', () => {
    const { chromeMock, commandListeners } = makeCommandHarness();

    commandListeners[0]('toggle-command-bar');
    expect(chromeMock.tabs.query).toHaveBeenCalledWith(
      { active: true, currentWindow: true },
      expect.any(Function)
    );
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: 'TOGGLE_OVERLAY' },
      expect.any(Function)
    );
  });

  it('toggle-command-bar recovers through the default popup when the content script is unreachable', () => {
    const { chromeMock, actionApi, commandListeners, readLastErrorCount } = makeCommandHarness({
      lastError: true,
    });

    commandListeners[0]('toggle-command-bar', makeFakeTab({ id: 7, url: 'https://one.com' }));
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledTimes(1);
    // The sendMessage callback must read chrome.runtime.lastError (otherwise
    // Chrome logs "Unchecked runtime.lastError").
    expect(readLastErrorCount()).toBeGreaterThan(0);
    expect(actionApi.setPopup).toHaveBeenCalledWith(
      { tabId: 7, popup: 'popup.html' },
      expect.any(Function)
    );
    expect(actionApi.openPopup).toHaveBeenCalledTimes(1);
  });

  it('unknown command is a no-op', () => {
    const { chromeMock, actionApi, commandListeners } = makeCommandHarness();

    commandListeners[0]('something-else', makeFakeTab({ id: 7, url: 'https://one.com' }));
    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
    expect(actionApi.openPopup).not.toHaveBeenCalled();
  });

  it('onInstalled with reason "install" opens the onboarding tab', async () => {
    const installListeners: Array<(d: chrome.runtime.InstalledDetails) => void> = [];
    const tabsCreate = vi.fn();
    const chromeMock = {
      runtime: {
        id: 'real-ext-id',
        onMessage: { addListener: vi.fn() },
        onInstalled: {
          addListener: vi.fn((cb: (d: chrome.runtime.InstalledDetails) => void) => installListeners.push(cb)),
        },
        onStartup: { addListener: vi.fn() },
        getURL: vi.fn((p: string) => `chrome-extension://fake/${p}`),
      },
      commands: { onCommand: { addListener: vi.fn() } },
      tabs: {
        create: tabsCreate,
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
      history: { search: vi.fn((_: object, cb: (r: chrome.history.HistoryItem[]) => void) => cb([])) },
      storage: {
        sync: {
          get: vi.fn((_: string, cb: (r: Record<string, unknown>) => void) => cb({})),
          set: vi.fn(),
        },
      },
      alarms: { create: vi.fn(), clear: vi.fn(), onAlarm: { addListener: vi.fn() } },
    };
    vi.stubGlobal('chrome', chromeMock);

    registerBackgroundListeners();
    expect(installListeners).toHaveLength(1);

    installListeners[0]({ reason: 'install' } as chrome.runtime.InstalledDetails);
    // WXT emits the onboarding entrypoint at the bundle root as
    // "onboarding.html" — NOT "onboarding/index.html" (the source layout).
    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'chrome-extension://fake//onboarding.html',
    });

    // Update reason should not open onboarding.
    tabsCreate.mockClear();
    installListeners[0]({ reason: 'update' } as chrome.runtime.InstalledDetails);
    expect(tabsCreate).not.toHaveBeenCalled();
  });

  // Helper for the routing tests below: a minimal chrome mock whose cache
  // init succeeds, capturing registered onMessage listeners.
  function makeListenerHarness(opts: { tabsQuery?: ReturnType<typeof vi.fn> } = {}) {
    const onMessageListeners: Array<
      (m: unknown, s: unknown, r: (resp: unknown) => void) => boolean | void
    > = [];
    const chromeMock = {
      runtime: {
        id: 'real-ext-id',
        onMessage: { addListener: vi.fn((fn) => onMessageListeners.push(fn)) },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        getURL: vi.fn((p: string) => `chrome-extension://fake/${p}`),
      },
      commands: { onCommand: { addListener: vi.fn() } },
      tabs: {
        query:
          opts.tabsQuery ??
          vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
            cb?.([]);
            return Promise.resolve([]);
          }),
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
      history: { search: vi.fn((_: object, cb: (r: chrome.history.HistoryItem[]) => void) => cb([])) },
      storage: {
        sync: {
          get: vi.fn((_: string, cb: (r: Record<string, unknown>) => void) => cb({})),
          set: vi.fn(),
        },
      },
      alarms: { create: vi.fn(), clear: vi.fn(), onAlarm: { addListener: vi.fn() } },
    };
    return { chromeMock, onMessageListeners };
  }

  it('routes a same-extension message through the router and responds asynchronously', async () => {
    const { chromeMock, onMessageListeners } = makeListenerHarness();
    vi.stubGlobal('chrome', chromeMock);

    registerBackgroundListeners();
    expect(onMessageListeners).toHaveLength(1);

    const response = await new Promise<unknown>((resolve) => {
      const kept = onMessageListeners[0]({ type: 'GET_SETTINGS' }, { id: 'real-ext-id' }, resolve);
      // true keeps the channel open for the async sendResponse.
      expect(kept).toBe(true);
    });
    expect(response).toHaveProperty('settings');
  });

  it('responds with an error when router initialization keeps failing', async () => {
    const failingQuery = vi.fn(() => {
      throw new Error('init boom');
    });
    const { chromeMock, onMessageListeners } = makeListenerHarness({ tabsQuery: failingQuery });
    vi.stubGlobal('chrome', chromeMock);

    registerBackgroundListeners();

    const response = await new Promise<unknown>((resolve) => {
      onMessageListeners[0]({ type: 'GET_SETTINGS' }, { id: 'real-ext-id' }, resolve);
    });
    expect(response).toEqual({ error: expect.stringContaining('init boom') });
  });

  it('resets the router after a failed warm-up so the next message retries initialization', async () => {
    let failInit = true;
    const flakyQuery = vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
      if (failInit) throw new Error('warm-up boom');
      cb?.([]);
      return Promise.resolve([]);
    });
    const { chromeMock, onMessageListeners } = makeListenerHarness({ tabsQuery: flakyQuery });
    vi.stubGlobal('chrome', chromeMock);

    registerBackgroundListeners();
    // Let the warm-up fail and the routerPromise reset take effect.
    await new Promise((r) => setTimeout(r, 0));
    expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(1);

    // The next message re-runs createMessageRouter and succeeds.
    failInit = false;
    const response = await new Promise<unknown>((resolve) => {
      onMessageListeners[0]({ type: 'GET_SETTINGS' }, { id: 'real-ext-id' }, resolve);
    });
    expect(response).toHaveProperty('settings');
    expect(chromeMock.bookmarks.getTree).toHaveBeenCalledTimes(2);
  });
});

describe('background entrypoint (default export)', () => {
  it('registers the background listeners when the entrypoint main runs', () => {
    const onMessageAddListener = vi.fn();
    const onCommandAddListener = vi.fn();
    const onInstalledAddListener = vi.fn();
    const chromeMock = {
      runtime: {
        id: 'real-ext-id',
        onMessage: { addListener: onMessageAddListener },
        onInstalled: { addListener: onInstalledAddListener },
        onStartup: { addListener: vi.fn() },
        getURL: vi.fn((p: string) => `chrome-extension://fake/${p}`),
      },
      commands: { onCommand: { addListener: onCommandAddListener } },
      tabs: {
        query: vi.fn((_: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
          cb?.([]);
          return Promise.resolve([]);
        }),
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
      history: { search: vi.fn((_: object, cb: (r: chrome.history.HistoryItem[]) => void) => cb([])) },
      storage: {
        sync: {
          get: vi.fn((_: string, cb: (r: Record<string, unknown>) => void) => cb({})),
          set: vi.fn(),
        },
      },
      alarms: { create: vi.fn(), clear: vi.fn(), onAlarm: { addListener: vi.fn() } },
    };
    vi.stubGlobal('chrome', chromeMock);

    // The test setup stubs WXT's defineBackground as (fn) => fn, so the
    // module's default export is the entrypoint's main function itself.
    (backgroundEntrypoint as unknown as () => void)();

    expect(onMessageAddListener).toHaveBeenCalledTimes(1);
    expect(onCommandAddListener).toHaveBeenCalledTimes(1);
    expect(onInstalledAddListener).toHaveBeenCalledTimes(1);
  });
});

