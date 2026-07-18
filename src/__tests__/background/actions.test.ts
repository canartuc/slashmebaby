import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionRegistry } from '../../entrypoints/background/actions';
import { makeFakeTab } from '../helpers/fake-tab';

// ─── Chrome stub helpers ───────────────────────────────────────────────────


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

    it('with a pinned-tab context, labels the pin action "Unpin Tab"', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems({ pinned: true, audible: false, muted: false });
      const pin = items.find((i) => i.id === 'action-pin-tab');
      expect(pin).toBeDefined();
      expect(pin!.title).toBe('Unpin Tab');
    });

    it('with an unpinned-tab context, labels the pin action "Pin Tab"', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems({ pinned: false, audible: true, muted: false });
      const pin = items.find((i) => i.id === 'action-pin-tab');
      expect(pin!.title).toBe('Pin Tab');
    });

    it('hides the mute action when the tab is neither audible nor muted', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems({ pinned: false, audible: false, muted: false });
      expect(items.find((i) => i.id === 'action-mute-tab')).toBeUndefined();
      expect(items).toHaveLength(11);
    });

    it('shows "Mute Tab" when the tab is audible and not muted', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems({ pinned: false, audible: true, muted: false });
      const mute = items.find((i) => i.id === 'action-mute-tab');
      expect(mute).toBeDefined();
      expect(mute!.title).toBe('Mute Tab');
    });

    it('shows "Unmute Tab" when the tab is already muted (even if silent)', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems({ pinned: false, audible: false, muted: true });
      const mute = items.find((i) => i.id === 'action-mute-tab');
      expect(mute).toBeDefined();
      expect(mute!.title).toBe('Unmute Tab');
    });

    it('without a context, returns all 12 actions with default labels', () => {
      const registry = new ActionRegistry();
      const items = registry.getItems();
      expect(items).toHaveLength(12);
      expect(items.find((i) => i.id === 'action-pin-tab')!.title).toBe('Pin Tab');
      expect(items.find((i) => i.id === 'action-mute-tab')!.title).toBe('Mute Tab');
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

  describe('getContextualItems (F08 smart-suggestion actions)', () => {
    it('returns "Unmute Tab" first for a muted tab', () => {
      const registry = new ActionRegistry();
      const items = registry.getContextualItems({ pinned: false, audible: false, muted: true });
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('action-mute-tab');
      expect(items[0].title).toBe('Unmute Tab');
    });

    it('returns "Mute Tab" first for an audible tab', () => {
      const registry = new ActionRegistry();
      const items = registry.getContextualItems({ pinned: false, audible: true, muted: false });
      expect(items[0].id).toBe('action-mute-tab');
      expect(items[0].title).toBe('Mute Tab');
    });

    it('offers "Unpin Tab" for a pinned tab', () => {
      const registry = new ActionRegistry();
      const items = registry.getContextualItems({ pinned: true, audible: false, muted: false });
      const pin = items.find((i) => i.id === 'action-pin-tab');
      expect(pin).toBeDefined();
      expect(pin!.title).toBe('Unpin Tab');
    });

    it('never suggests the mute action for a silent unmuted tab', () => {
      const registry = new ActionRegistry();
      const items = registry.getContextualItems({ pinned: false, audible: false, muted: false });
      expect(items).toHaveLength(2);
      expect(items.find((i) => i.id === 'action-mute-tab')).toBeUndefined();
    });

    it('returns 2 default actions with category "actions" when no context is known', () => {
      const registry = new ActionRegistry();
      const items = registry.getContextualItems();
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.category === 'actions')).toBe(true);
      expect(items.find((i) => i.id === 'action-mute-tab')).toBeUndefined();
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

    it('close-duplicates skips tabs without a url or id', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'https://example.com' }),
        makeFakeTab({ id: 2, url: undefined }), // no url — cannot be a duplicate
        makeFakeTab({ id: 3, url: 'https://example.com' }),
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
      // Only tab 3 duplicates tab 1; the url-less tab 2 must survive.
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith([3], expect.any(Function));
    });

    it('sort-by-domain skips tabs without an id', async () => {
      const tabs = [
        makeFakeTab({ id: undefined, url: 'https://alpha.com', index: 0 }),
        makeFakeTab({ id: 2, url: 'https://zebra.com', index: 1 }),
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
      // Only the tab with an id is moved; the id-less tab is left alone.
      expect(chromeMock.tabs.move).toHaveBeenCalledTimes(1);
      expect(chromeMock.tabs.move).toHaveBeenCalledWith(2, { index: 0 }, expect.any(Function));
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

    it('after closing a tab, undo restores a whole-window session when that is what was closed', async () => {
      const fakeSession: chrome.sessions.Session = {
        lastModified: 0,
        window: { sessionId: 'win-42' } as chrome.windows.Window,
      };
      const chromeMock = makeChromeMock();
      chromeMock.sessions.getRecentlyClosed = vi.fn(() => Promise.resolve([fakeSession]));
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      // Step 1: close-tab records a restore-tabs undo entry.
      const closed = await registry.execute('close-tab', 42);
      expect(closed.success).toBe(true);

      // Step 2: the most recently closed session is a window → restore it.
      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.sessions.restore).toHaveBeenCalledWith('win-42');
    });

    it('after pin-tab, undo re-toggles the pin state instead of touching sessions', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      await registry.execute('pin-tab', 42);
      // Mocked tabs.get always reports pinned: false, so both calls pin.
      expect(chromeMock.tabs.update).toHaveBeenCalledTimes(1);

      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.tabs.update).toHaveBeenCalledTimes(2);
      expect(chromeMock.tabs.update).toHaveBeenLastCalledWith(42, { pinned: true }, expect.any(Function));
      expect(chromeMock.sessions.restore).not.toHaveBeenCalled();
    });

    it('after mute-tab, undo re-toggles the mute state instead of touching sessions', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      await registry.execute('mute-tab', 42);
      // Mocked tabs.get always reports muted: false, so both calls mute.
      expect(chromeMock.tabs.update).toHaveBeenCalledTimes(1);

      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.tabs.update).toHaveBeenCalledTimes(2);
      expect(chromeMock.tabs.update).toHaveBeenLastCalledWith(42, { muted: true }, expect.any(Function));
      expect(chromeMock.sessions.restore).not.toHaveBeenCalled();
    });

    it('after new-tab, undo closes the tab that was just created', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      // Mocked tabs.create reports the new tab as id 99.
      await registry.execute('new-tab');

      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(99);
      expect(chromeMock.sessions.restore).not.toHaveBeenCalled();
    });

    it('after duplicate-tab, undo closes the duplicated tab', async () => {
      const chromeMock = makeChromeMock();
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      // Mocked tabs.duplicate reports the new tab as id 100.
      await registry.execute('duplicate-tab', 1);

      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(100);
      expect(chromeMock.sessions.restore).not.toHaveBeenCalled();
    });
  });

  describe('execute — chrome.runtime.lastError propagation (callback APIs)', () => {
    type RuntimeWithLastError = { lastError?: { message?: string } };

    /**
     * Wraps a callback-style chrome API mock so chrome.runtime.lastError is
     * set for exactly the duration of the callback — the same window in which
     * real Chrome exposes it.
     */
    function failDuringCallback<A extends unknown[]>(
      chromeMock: ReturnType<typeof makeChromeMock>,
      message: string,
      invokeCallback: (...args: A) => void
    ): (...args: A) => void {
      const runtime = chromeMock.runtime as RuntimeWithLastError;
      return (...args: A) => {
        runtime.lastError = { message };
        try {
          invokeCallback(...args);
        } finally {
          delete runtime.lastError;
        }
      };
    }

    it('close-tab resolves failure when tabs.remove sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.remove = vi.fn(
        failDuringCallback(chromeMock, 'No tab with id: 42.', (_ids: number | number[], cb?: () => void) => cb?.())
      );
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('close-tab', 42);
      expect(result).toEqual({ success: false, error: 'No tab with id: 42.' });
    });

    it('close-other-tabs resolves failure when tabs.query sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        failDuringCallback(chromeMock, 'query denied', (_q: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => cb?.([]))
      ) as unknown as typeof chromeMock.tabs.query;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('close-other-tabs', 1);
      expect(result).toEqual({ success: false, error: 'query denied' });
    });

    it('close-other-tabs resolves failure when tabs.remove sets lastError', async () => {
      const tabs = [
        makeFakeTab({ id: 1, active: true, pinned: false }),
        makeFakeTab({ id: 2, active: false, pinned: false }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_q: object, cb?: (t: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      chromeMock.tabs.remove = vi.fn(
        failDuringCallback(chromeMock, 'remove blew up', (_ids: number | number[], cb?: () => void) => cb?.())
      );
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('close-other-tabs', 1);
      expect(result).toEqual({ success: false, error: 'remove blew up' });
    });

    it('pin-tab resolves failure when tabs.get sets lastError (no crash on missing tab)', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn(
        failDuringCallback(chromeMock, 'No tab with id: 42.', (_id: number, cb: (tab?: chrome.tabs.Tab) => void) =>
          cb(undefined)
        )
      ) as unknown as typeof chromeMock.tabs.get;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('pin-tab', 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No tab with id: 42.');
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('pin-tab resolves failure when tabs.update sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.update = vi.fn(
        failDuringCallback(chromeMock, 'cannot pin', (_id: number, _p: object, cb?: (tab?: chrome.tabs.Tab) => void) =>
          cb?.(undefined)
        )
      ) as unknown as typeof chromeMock.tabs.update;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('pin-tab', 42);
      expect(result).toEqual({ success: false, error: 'cannot pin' });
    });

    it('mute-tab resolves failure when tabs.get sets lastError (no crash on missing tab)', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn(
        failDuringCallback(chromeMock, 'tab gone', (_id: number, cb: (tab?: chrome.tabs.Tab) => void) => cb(undefined))
      ) as unknown as typeof chromeMock.tabs.get;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('mute-tab', 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain('tab gone');
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('mute-tab resolves failure when tabs.update sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.update = vi.fn(
        failDuringCallback(chromeMock, 'cannot mute', (_id: number, _p: object, cb?: (tab?: chrome.tabs.Tab) => void) =>
          cb?.(undefined)
        )
      ) as unknown as typeof chromeMock.tabs.update;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('mute-tab', 42);
      expect(result).toEqual({ success: false, error: 'cannot mute' });
    });

    it('duplicate-tab resolves failure when tabs.duplicate sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.duplicate = vi.fn(
        failDuringCallback(chromeMock, 'cannot duplicate', (_id: number, cb?: (tab?: chrome.tabs.Tab) => void) =>
          cb?.(undefined)
        )
      ) as unknown as typeof chromeMock.tabs.duplicate;
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('duplicate-tab', 42);
      expect(result).toEqual({ success: false, error: 'cannot duplicate' });

      // A failed duplicate must not record a close-tab undo entry.
      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
    });

    it('move-to-window resolves failure when windows.create sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.windows.create = vi.fn(
        failDuringCallback(chromeMock, 'no window for you', (_p: object, cb?: (win?: chrome.windows.Window) => void) =>
          cb?.(undefined)
        )
      ) as unknown as typeof chromeMock.windows.create;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('move-to-window', 42);
      expect(result).toEqual({ success: false, error: 'no window for you' });
    });

    it('reload-tab resolves failure when tabs.reload sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.reload = vi.fn(
        failDuringCallback(chromeMock, 'reload denied', (_id: number, _p?: object, cb?: () => void) => cb?.())
      ) as unknown as typeof chromeMock.tabs.reload;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('reload-tab', 42);
      expect(result).toEqual({ success: false, error: 'reload denied' });
    });

    it('new-tab resolves failure when tabs.create sets lastError (and records no undo)', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.create = vi.fn(
        failDuringCallback(chromeMock, 'cannot create tab', (_p: object, cb?: (tab?: chrome.tabs.Tab) => void) =>
          cb?.(undefined)
        )
      ) as unknown as typeof chromeMock.tabs.create;
      vi.stubGlobal('chrome', chromeMock);

      const registry = new ActionRegistry();
      const result = await registry.execute('new-tab');
      expect(result).toEqual({ success: false, error: 'cannot create tab' });

      const undone = await registry.execute('recently-closed');
      expect(undone.success).toBe(true);
      expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
    });

    it('close-duplicates resolves failure when tabs.query sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        failDuringCallback(chromeMock, 'query denied', (_q: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => cb?.([]))
      ) as unknown as typeof chromeMock.tabs.query;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('close-duplicates');
      expect(result).toEqual({ success: false, error: 'query denied' });
    });

    it('close-duplicates resolves failure when tabs.remove sets lastError', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'https://example.com' }),
        makeFakeTab({ id: 2, url: 'https://example.com' }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_q: object, cb?: (t: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      chromeMock.tabs.remove = vi.fn(
        failDuringCallback(chromeMock, 'remove blew up', (_ids: number | number[], cb?: () => void) => cb?.())
      );
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('close-duplicates');
      expect(result).toEqual({ success: false, error: 'remove blew up' });
    });

    it('sort-by-domain resolves failure when tabs.query sets lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        failDuringCallback(chromeMock, 'query denied', (_q: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => cb?.([]))
      ) as unknown as typeof chromeMock.tabs.query;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('sort-by-domain');
      expect(result).toEqual({ success: false, error: 'query denied' });
      expect(chromeMock.tabs.move).not.toHaveBeenCalled();
    });

    it('pin-tab resolves failure when tabs.get returns no tab without lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn(
        (_id: number, cb: (tab?: chrome.tabs.Tab) => void) => cb(undefined)
      ) as unknown as typeof chromeMock.tabs.get;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('pin-tab', 42);
      expect(result).toEqual({ success: false, error: 'Tab 42 not found' });
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('mute-tab resolves failure when tabs.get returns no tab without lastError', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.tabs.get = vi.fn(
        (_id: number, cb: (tab?: chrome.tabs.Tab) => void) => cb(undefined)
      ) as unknown as typeof chromeMock.tabs.get;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('mute-tab', 42);
      expect(result).toEqual({ success: false, error: 'Tab 42 not found' });
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('sort-by-domain resolves failure when a tabs.move sets lastError', async () => {
      const tabs = [
        makeFakeTab({ id: 1, url: 'https://zebra.com', index: 0 }),
        makeFakeTab({ id: 2, url: 'https://alpha.com', index: 1 }),
      ];
      const chromeMock = makeChromeMock();
      chromeMock.tabs.query = vi.fn(
        (_q: object, cb?: (t: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
          cb?.(tabs);
          return Promise.resolve(tabs);
        }
      );
      chromeMock.tabs.move = vi.fn(
        failDuringCallback(
          chromeMock,
          'tabs cannot be edited right now',
          (_id: number | number[], _p: object, cb?: (t: chrome.tabs.Tab | chrome.tabs.Tab[]) => void) =>
            cb?.(makeFakeTab())
        )
      ) as unknown as typeof chromeMock.tabs.move;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('sort-by-domain');
      expect(result).toEqual({ success: false, error: 'tabs cannot be edited right now' });
    });

    it('settings resolves failure when openOptionsPage rejects', async () => {
      const chromeMock = makeChromeMock();
      chromeMock.runtime.openOptionsPage = vi.fn(() =>
        Promise.reject(new Error('no options page'))
      ) as unknown as typeof chromeMock.runtime.openOptionsPage;
      vi.stubGlobal('chrome', chromeMock);

      const result = await new ActionRegistry().execute('settings');
      expect(result.success).toBe(false);
      expect(result.error).toContain('no options page');
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
