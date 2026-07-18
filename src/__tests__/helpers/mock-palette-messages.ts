import { vi } from 'vitest';

// Shared raw-data message mock for palette surfaces (overlay CommandBar and
// popup). Mirrors the background router's GET_* responses so both surfaces
// render from identical data — the foundation of the surface-parity suite.

export interface MockPaletteOptions {
  executeActionResponse?: unknown;
  /** Prepends one pinned tab (id 9, 'Pinned Mail'). */
  withPinnedTab?: boolean;
  /** Appends N generated unpinned tabs 'Tab 01'.. (ids 101..) AFTER the
   *  default Gmail/GitHub pair — used to push labels into two-char range. */
  extraTabs?: number;
  actions?: Array<{ id: string; title: string }>;
}

export function mockRawDataMessages(options: MockPaletteOptions = {}) {
  vi.mocked(chrome.runtime.sendMessage).mockReset();
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
    msg: unknown,
    callback?: (response: unknown) => void
  ) => {
      const message = msg as { type: string };
      if (message.type === 'GET_SETTINGS' && callback) {
        callback({
          settings: {
            shortcut: 'Ctrl+Shift+Space',
            position: 'center',
            theme: 'dark',
            maxResultsPerGroup: 5,
            showFavicons: true,
            searchSources: { tabs: true, bookmarks: true, history: true },
          },
        });
      } else if (message.type === 'GET_ALL_TABS' && callback) {
        const extra = Array.from({ length: options.extraTabs ?? 0 }, (_, i) => ({
          id: 101 + i,
          title: `Tab ${String(i + 1).padStart(2, '0')}`,
          url: `https://tab-${101 + i}.example/`,
          favIconUrl: '',
          windowId: 1,
          pinned: false,
          audible: false,
        }));
        callback({
          groups: [
            {
              label: 'Window 1',
              type: 'window',
              tabs: [
                ...(options.withPinnedTab
                  ? [{ id: 9, title: 'Pinned Mail', url: 'https://pinned.example', favIconUrl: '', windowId: 1, pinned: true, audible: false }]
                  : []),
                { id: 1, title: 'Gmail', url: 'https://mail.google.com', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                { id: 2, title: 'GitHub', url: 'https://github.com', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                ...extra,
              ],
            },
          ],
        });
      } else if (message.type === 'GET_BOOKMARK_TREE' && callback) {
        callback({
          tree: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              children: [
                { id: '2', title: 'React Docs', url: 'https://react.dev' },
              ],
            },
            {
              id: '4',
              title: 'Work Stuff',
              children: [{ id: '5', title: 'Jira', url: 'https://jira.example' }],
            },
          ],
        });
      } else if (message.type === 'GET_HISTORY_ITEMS' && callback) {
        callback({ items: [] });
      } else if (message.type === 'GET_ACTIONS' && callback) {
        callback({
          actions: options.actions ?? [
            { id: 'action-close-tab', title: 'Close Tab' },
            { id: 'action-pin-tab', title: 'Pin Tab' },
            { id: 'action-new-tab', title: 'New Tab' },
          ],
        });
      } else if (message.type === 'EXECUTE_ACTION' && callback) {
        callback(options.executeActionResponse ?? { success: true });
      } else if (
        (message.type === 'SWITCH_TAB' ||
          message.type === 'NAVIGATE' ||
          message.type === 'OPEN_NEW_TAB') &&
        callback
      ) {
        callback({ success: true });
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage
  );
}

export function findSentMessage(type: string) {
  return vi.mocked(chrome.runtime.sendMessage).mock.calls.find(
    (c) => (c[0] as unknown as { type: string }).type === type
  );
}
