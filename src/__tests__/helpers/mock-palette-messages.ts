import { vi } from 'vitest';
import type {
  GetSettingsResponse,
  GetAllTabsResponse,
  GetBookmarkTreeResponse,
  GetHistoryItemsResponse,
  GetActionsResponse,
} from '../../lib/messaging';

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
  /** Appends one hibernated tab (id 3, 'Sleeping Docs', discarded: true). */
  withDiscardedTab?: boolean;
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
        } satisfies GetSettingsResponse);
      } else if (message.type === 'GET_ALL_TABS' && callback) {
        const makeTab = (
          id: number,
          title: string,
          url: string,
          pinned = false,
          discarded = false
        ) => ({
          id,
          title,
          url,
          favIconUrl: '',
          windowId: 1,
          pinned,
          audible: false,
          muted: false,
          discarded,
        });
        const extra = Array.from({ length: options.extraTabs ?? 0 }, (_, i) =>
          makeTab(101 + i, `Tab ${String(i + 1).padStart(2, '0')}`, `https://tab-${101 + i}.example/`)
        );
        callback({
          groups: [
            {
              label: 'Window 1',
              type: 'window',
              tabs: [
                ...(options.withPinnedTab
                  ? [makeTab(9, 'Pinned Mail', 'https://pinned.example', true)]
                  : []),
                makeTab(1, 'Gmail', 'https://mail.google.com'),
                makeTab(2, 'GitHub', 'https://github.com'),
                ...(options.withDiscardedTab
                  ? [makeTab(3, 'Sleeping Docs', 'https://sleep.example', false, true)]
                  : []),
                ...extra,
              ],
            },
          ],
        } satisfies GetAllTabsResponse);
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
        } satisfies GetBookmarkTreeResponse);
      } else if (message.type === 'GET_HISTORY_ITEMS' && callback) {
        callback({ items: [] } satisfies GetHistoryItemsResponse);
      } else if (message.type === 'GET_ACTIONS' && callback) {
        callback({
          actions: options.actions ?? [
            { id: 'action-close-tab', title: 'Close Tab' },
            { id: 'action-pin-tab', title: 'Pin Tab' },
            { id: 'action-new-tab', title: 'New Tab' },
          ],
        } satisfies GetActionsResponse);
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
