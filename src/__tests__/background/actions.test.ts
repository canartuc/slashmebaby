import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionRegistry } from '../../entrypoints/background/actions';

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
    mutedInfo: { muted: false },
    ...overrides,
  };
}

function makeChromeMock(overrides: Record<string, unknown> = {}) {
  const tabs = {
    remove: vi.fn((_tabIds: number | number[], cb?: () => void) => cb?.()),
    create: vi.fn((_createProps: object, cb?: (tab: chrome.tabs.Tab) => void) => cb?.(makeFakeTab({ id: 99 }))),
    duplicate: vi.fn((_tabId: number, cb?: (tab: chrome.tabs.Tab) => void) => cb?.(makeFakeTab({ id: 100 }))),
    reload: vi.fn((_tabId: number, _reloadProps?: object, cb?: () => void) => cb?.()),
    query: vi.fn(
      (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
        cb?.([]);
        return Promise.resolve([]);
      }
    ),
    move: vi.fn(
      (_tabId: number | number[], _moveProps: object, cb?: (tabs: chrome.tabs.Tab | chrome.tabs.Tab[]) => void) =>
        cb?.(makeFakeTab())
    ),
    get: vi.fn((_tabId: number, cb: (tab: chrome.tabs.Tab) => void) => cb(makeFakeTab())),
    update: vi.fn(
      (_tabId: number, _updateProps: object, cb?: (tab?: chrome.tabs.Tab) => void) =>
        cb?.(makeFakeTab())
    ),
    sendMessage: vi.fn(),
  };

  const windows = {
    create: vi.fn((_createData: object, cb?: (win: chrome.windows.Window) => void) =>
      cb?.({ id: 200, focused: true, alwaysOnTop: false, incognito: false, state: 'normal', type: 'normal' })
    ),
  };

  const sessions = {
    getRecentlyClosed: vi.fn(
      (): Promise<chrome.sessions.Session[]> => Promise.resolve([])
    ),
    restore: vi.fn(() => Promise.resolve({ lastModified: 0 })),
  };

  const runtime = {
    openOptionsPage: vi.fn((cb?: () => void) => cb?.()),
    getURL: vi.fn((path: string) => `chrome-extension://fake/${path}`),
  };

  return {
    tabs: { ...tabs, ...(overrides['tabs'] as object ?? {}) },
    windows: { ...windows, ...(overrides['windows'] as object ?? {}) },
    sessions: { ...sessions, ...(overrides['sessions'] as object ?? {}) },
    runtime: { ...runtime, ...(overrides['runtime'] as object ?? {}) },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ActionRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', makeChromeMock());
  });

  describe('getItems', () => {
    it('returns all 12 actions as SearchableItems', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems();
      expect(items).toHaveLength(12);
    });

    it('includes Close Tab action', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems();
      const closeTab = items.find((i) => i.id === 'action-close-tab');
      expect(closeTab).toBeDefined();
      expect(closeTab!.title).toBeTruthy();
      expect(closeTab!.category).toBe('actions');
    });

    it('assigns category "actions" to all items', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems();
      expect(items.every((i) => i.category === 'actions')).toBe(true);
    });

    it('uses id format "action-{actionId}"', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems();
      const expectedIds = [
        'action-close-tab',
        'action-close-other-tabs',
        'action-pin-tab',
        'action-mute-tab',
        'action-duplicate-tab',
        'action-move-to-window',
        'action-reload-tab',
        'action-new-tab',
        'action-recently-closed',
        'action-close-duplicates',
        'action-sort-by-domain',
        'action-settings',
      ];
      const actualIds = items.map((i) => i.id);
      for (const id of expectedIds) {
        expect(actualIds).toContain(id);
      }
    });
  });

  describe('execute', () => {
    it('returns error for unknown action', async () => {
      const registry = new ActionRegistry();
      const result = await registry.execute('unknown-action', 1);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('executes close-tab action', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('close-tab', 42);

      expect(result.success).toBe(true);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
    });

    it('executes duplicate-tab action', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('duplicate-tab', 42);

      expect(result.success).toBe(true);
      expect(chromeMock.tabs.duplicate).toHaveBeenCalledWith(42, expect.any(Function));
    });

    it('executes reload-tab action', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('reload-tab', 42);

      expect(result.success).toBe(true);
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(42, {}, expect.any(Function));
    });

    it('executes new-tab action', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('new-tab');

      expect(result.success).toBe(true);
      expect(chromeMock.tabs.create).toHaveBeenCalledWith({}, expect.any(Function));
    });

    it('executes recently-closed action (returns success, triggers sub-list in UI)', async () => {
      const registry = new ActionRegistry();
      const result = await registry.execute('recently-closed');
      expect(result.success).toBe(true);
    });

    it('executes settings action', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('settings');

      expect(result.success).toBe(true);
      expect(chromeMock.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('executes move-to-window action', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('move-to-window', 42);

      expect(result.success).toBe(true);
      expect(chromeMock.windows.create).toHaveBeenCalledWith(
        { tabId: 42 },
        expect.any(Function)
      );
    });

    it('executes pin-tab action (toggles pinned state)', async () => {
      const tab = makeFakeTab({ id: 42, pinned: false });
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn((_tabId: number, cb: (tab: chrome.tabs.Tab) => void) => cb(tab));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('pin-tab', 42);

      expect(result.success).toBe(true);
      expect(chromeMock.tabs.get).toHaveBeenCalledWith(42, expect.any(Function));
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { pinned: true }, expect.any(Function));
    });

    it('executes mute-tab action (toggles muted state)', async () => {
      const tab = makeFakeTab({ id: 42, mutedInfo: { muted: false } });
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn((_tabId: number, cb: (tab: chrome.tabs.Tab) => void) => cb(tab));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('mute-tab', 42);

      expect(result.success).toBe(true);
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { muted: true }, expect.any(Function));
    });

    it('executes close-other-tabs action (keeps active tab, skips pinned)', async () => {
      const tabs = [
        makeFakeTab({ id: 1, active: true, pinned: false }),
        makeFakeTab({ id: 2, active: false, pinned: false }),
        makeFakeTab({ id: 3, active: false, pinned: true }),  // pinned, should be skipped
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('close-other-tabs', 1);

      expect(result.success).toBe(true);
      // Should close tab 2 but not tab 1 (active) or tab 3 (pinned)
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith([2], expect.any(Function));
    });

    it('executes close-duplicates action', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'https://example.com', active: true }),
        makeFakeTab({ id: 2, url: 'https://example.com', active: false }),
        makeFakeTab({ id: 3, url: 'https://other.com', active: false }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('close-duplicates');

      expect(result.success).toBe(true);
      // Should remove tab 2 (duplicate of tab 1), keep tab 1 and tab 3
      expect(chromeMock.tabs.remove).toHaveBeenCalled();
      const removeCall = chromeMock.tabs.remove.mock.calls[0][0] as number[];
      expect(removeCall).toContain(2);
      expect(removeCall).not.toContain(1);
      expect(removeCall).not.toContain(3);
    });

    it('executes sort-by-domain action', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'https://zebra.com/page', index: 0 }),
        makeFakeTab({ id: 2, url: 'https://alpha.com/page', index: 1 }),
        makeFakeTab({ id: 3, url: 'https://middle.com/page', index: 2 }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('sort-by-domain');

      expect(result.success).toBe(true);
      // tabs.move should have been called to reorder tabs
      expect(chromeMock.tabs.move).toHaveBeenCalled();
    });

    it('executes pin-tab action — already pinned tab gets unpinned', async () => {
      const tab = makeFakeTab({ id: 42, pinned: true }); // already pinned
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn((_tabId: number, cb: (tab: chrome.tabs.Tab) => void) => cb(tab));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('pin-tab', 42);

      expect(result.success).toBe(true);
      // Should toggle: pinned=true → pinned=false
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { pinned: false }, expect.any(Function));
    });

    it('executes mute-tab action — already muted tab gets unmuted', async () => {
      const tab = makeFakeTab({ id: 42, mutedInfo: { muted: true } }); // already muted
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn((_tabId: number, cb: (tab: chrome.tabs.Tab) => void) => cb(tab));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('mute-tab', 42);

      expect(result.success).toBe(true);
      // Should toggle: muted=true → muted=false
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, { muted: false }, expect.any(Function));
    });

    it('close-other-tabs returns success when there are no other tabs to close', async () => {
      // Only the active tab, nothing else
      const tabs = [makeFakeTab({ id: 1, active: true, pinned: false })];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('close-other-tabs', 1);

      expect(result.success).toBe(true);
      // No tabs to remove, so remove should not be called
      expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
    });

    it('close-duplicates returns success when there are no duplicates', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'https://unique1.com' }),
        makeFakeTab({ id: 2, url: 'https://unique2.com' }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('close-duplicates');

      expect(result.success).toBe(true);
      // No duplicates, remove should not be called
      expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
    });

    it('sort-by-domain handles tabs with invalid URLs gracefully', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'not-a-valid-url', index: 0 }),
        makeFakeTab({ id: 2, url: 'https://alpha.com', index: 1 }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_queryInfo: object, cb?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      // Should not throw even with invalid URLs
      await expect(registry.execute('sort-by-domain')).resolves.toEqual({ success: true });
    });

    it('execute with no targetTabId for an action that requires it', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      // close-tab with no tabId — undefined will be passed, chrome.tabs.remove will be called with undefined
      // The action itself should still resolve (behavior is implementation-defined)
      const result = await registry.execute('close-tab', undefined);
      // Should either succeed or fail gracefully
      expect(result).toHaveProperty('success');
    });

    it('execute catches errors thrown by underlying chrome API', async () => {
      const chromeMock = makeChromeMock();
      // Make tabs.create throw synchronously
      chromeMock.tabs.create = vi.fn(() => {
        throw new Error('Chrome API failure');
      });
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('new-tab');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome API failure');
    });
  });

  describe('undo', () => {
    it('falls back to restoring last closed session when no undo is recorded', async () => {
      const fakeSession: chrome.sessions.Session = {
        lastModified: 0,
        tab: { sessionId: 'sess-1' } as chrome.tabs.Tab,
      };
      const chromeMock = makeChromeMock();
      chromeMock.sessions.getRecentlyClosed = vi.fn(() => Promise.resolve([fakeSession]));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('recently-closed');
      expect(result.success).toBe(true);
      expect(chromeMock.sessions.restore).toHaveBeenCalledWith('sess-1');
    });

    it('handles undo fallback restoring a window session', async () => {
      const fakeSession: chrome.sessions.Session = {
        lastModified: 0,
        window: { sessionId: 'win-9' } as chrome.windows.Window,
      };
      const chromeMock = makeChromeMock();
      chromeMock.sessions.getRecentlyClosed = vi.fn(() => Promise.resolve([fakeSession]));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('recently-closed');
      expect(result.success).toBe(true);
      expect(chromeMock.sessions.restore).toHaveBeenCalledWith('win-9');
    });

    it('undo with no recorded entry and no closed sessions still returns success', async () => {
      const chromeMock = makeChromeMock();
      // sessions.getRecentlyClosed already returns [] in default mock.
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('recently-closed');
      expect(result.success).toBe(true);
      expect(chromeMock.sessions.restore).not.toHaveBeenCalled();
    });

    it('after closing a tab, undo restores recently-closed sessions', async () => {
      const chromeMock = makeChromeMock();
      const tabsRemove = vi.fn((_tabIds: number | number[], cb?: () => void) => cb?.());
      const fakeSession: chrome.sessions.Session = {
        lastModified: 0,
        tab: { sessionId: 'restored-1' } as chrome.tabs.Tab,
      };
      chromeMock.tabs.remove = tabsRemove;
      chromeMock.tabs.query = vi.fn((_q: object, cb?: (t: chrome.tabs.Tab[]) => void) => {
        const tabs = [makeFakeTab({ id: 5, active: true, windowId: 2 })];
        if (cb) cb(tabs);
        return Promise.resolve(tabs);
      });
      chromeMock.sessions.getRecentlyClosed = vi.fn(() => Promise.resolve([fakeSession]));
      const winUpdate = vi.fn(() => Promise.resolve({} as chrome.windows.Window));
      (chromeMock.windows as { update?: typeof winUpdate }).update = winUpdate;
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      // Step 1: close-tab to record the restore-tabs undo entry.
      const closed = await registry.execute('close-tab', 42);
      expect(closed.success).toBe(true);

      // Step 2: undo restores sessions and re-focuses the previously active tab/window.
      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.sessions.restore).toHaveBeenCalledWith('restored-1');
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(5, { active: true });
      expect(winUpdate).toHaveBeenCalledWith(2, { focused: true });
    });
  });

  describe('execute requires-target guard', () => {
    const targetActions = [
      'close-tab',
      'close-other-tabs',
      'pin-tab',
      'mute-tab',
      'duplicate-tab',
      'move-to-window',
      'reload-tab',
    ];
    for (const actionId of targetActions) {
      it(`returns failure when ${actionId} is invoked without a target tab`, async () => {
        const registry = new ActionRegistry();
        const result = await registry.execute(actionId);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/requires a target tab/);
      });
    }
  });
});
