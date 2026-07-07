import { describe, it, expect } from 'vitest';
import {
  isSearchRequest,
  isExecuteActionRequest,
  isToggleOverlayCommand,
  isSmartSuggestionsRequest,
  isGetSettingsRequest,
  DEFAULT_SETTINGS,
} from '../../lib/messaging';
import type {
  SearchRequest,
  ExecuteActionRequest,
  ToggleOverlayCommand,
  SmartSuggestionsRequest,
  GetSettingsRequest,
  Message,
} from '../../lib/messaging';

describe('Type Guards', () => {
  describe('isSearchRequest', () => {
    it('returns true for a valid SearchRequest', () => {
      const msg: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'hello', sources: ['tabs'] },
      };
      expect(isSearchRequest(msg)).toBe(true);
    });

    it('returns false for a non-SearchRequest message', () => {
      const msg: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };
      expect(isSearchRequest(msg)).toBe(false);
    });

    it('returns false for an arbitrary object', () => {
      expect(isSearchRequest({ type: 'OTHER' })).toBe(false);
    });

    it('returns false for null', () => {
      expect(isSearchRequest(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isSearchRequest(undefined)).toBe(false);
    });
  });

  describe('isExecuteActionRequest', () => {
    it('returns true for a valid ExecuteActionRequest', () => {
      const msg: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'open-tab' },
      };
      expect(isExecuteActionRequest(msg)).toBe(true);
    });

    it('returns true with optional targetTabId', () => {
      const msg: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'open-tab', targetTabId: 42 },
      };
      expect(isExecuteActionRequest(msg)).toBe(true);
    });

    it('returns false for a SearchRequest', () => {
      const msg: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'hello', sources: ['bookmarks'] },
      };
      expect(isExecuteActionRequest(msg)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isExecuteActionRequest(null)).toBe(false);
    });
  });

  describe('isToggleOverlayCommand', () => {
    it('returns true for a valid ToggleOverlayCommand', () => {
      const msg: ToggleOverlayCommand = { type: 'TOGGLE_OVERLAY' };
      expect(isToggleOverlayCommand(msg)).toBe(true);
    });

    it('returns false for a SearchRequest', () => {
      const msg: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'q', sources: ['history'] },
      };
      expect(isToggleOverlayCommand(msg)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isToggleOverlayCommand(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isToggleOverlayCommand(undefined)).toBe(false);
    });
  });

  describe('isSmartSuggestionsRequest', () => {
    it('returns true for a valid SmartSuggestionsRequest', () => {
      const msg: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };
      expect(isSmartSuggestionsRequest(msg)).toBe(true);
    });

    it('returns false for a ToggleOverlayCommand', () => {
      const msg: ToggleOverlayCommand = { type: 'TOGGLE_OVERLAY' };
      expect(isSmartSuggestionsRequest(msg)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isSmartSuggestionsRequest(null)).toBe(false);
    });
  });

  describe('isGetSettingsRequest', () => {
    it('returns true for a valid GetSettingsRequest', () => {
      const msg: GetSettingsRequest = { type: 'GET_SETTINGS' };
      expect(isGetSettingsRequest(msg)).toBe(true);
    });

    it('returns false for a SmartSuggestionsRequest', () => {
      const msg: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };
      expect(isGetSettingsRequest(msg)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isGetSettingsRequest(null)).toBe(false);
    });
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has the correct shortcut', () => {
    expect(DEFAULT_SETTINGS.shortcut).toBe('Ctrl+Shift+Space');
  });

  it('has position center', () => {
    expect(DEFAULT_SETTINGS.position).toBe('center');
  });

  it('has theme system', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
  });

  it('has maxResultsPerGroup of 5', () => {
    expect(DEFAULT_SETTINGS.maxResultsPerGroup).toBe(5);
  });

  it('has showFavicons true', () => {
    expect(DEFAULT_SETTINGS.showFavicons).toBe(true);
  });

  it('has all searchSources enabled', () => {
    expect(DEFAULT_SETTINGS.searchSources).toEqual({
      tabs: true,
      bookmarks: true,
      history: true,
    });
  });
});

describe('Message union type exhaustiveness', () => {
  it('can assign each message type to Message union', () => {
    const messages: Message[] = [
      { type: 'SEARCH', payload: { query: 'q', sources: ['tabs'] } },
      { type: 'SMART_SUGGESTIONS' },
      { type: 'EXECUTE_ACTION', payload: { actionId: 'x' } },
      { type: 'GET_SETTINGS' },
      { type: 'TOGGLE_OVERLAY' },
    ];
    expect(messages).toHaveLength(5);
  });
});

// ─── New Tree View Message Types ───────────────────────────────────────────

import {
  isGetAllTabsRequest,
  isGetBookmarkTreeRequest,
} from '../../lib/messaging';
import type {
  GetAllTabsRequest,
  GetBookmarkTreeRequest,
} from '../../lib/messaging';

describe('isGetAllTabsRequest', () => {
  it('returns true for a valid GetAllTabsRequest', () => {
    const msg: GetAllTabsRequest = { type: 'GET_ALL_TABS' };
    expect(isGetAllTabsRequest(msg)).toBe(true);
  });

  it('returns false for a different type', () => {
    expect(isGetAllTabsRequest({ type: 'SEARCH' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGetAllTabsRequest(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGetAllTabsRequest(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isGetAllTabsRequest({})).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isGetAllTabsRequest('GET_ALL_TABS')).toBe(false);
  });
});

describe('isGetBookmarkTreeRequest', () => {
  it('returns true for a valid GetBookmarkTreeRequest', () => {
    const msg: GetBookmarkTreeRequest = { type: 'GET_BOOKMARK_TREE' };
    expect(isGetBookmarkTreeRequest(msg)).toBe(true);
  });

  it('returns false for a different type', () => {
    expect(isGetBookmarkTreeRequest({ type: 'GET_ALL_TABS' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGetBookmarkTreeRequest(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGetBookmarkTreeRequest(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isGetBookmarkTreeRequest({})).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isGetBookmarkTreeRequest('GET_BOOKMARK_TREE')).toBe(false);
  });
});

// ─── Action-route guards (SWITCH_TAB / OPEN_NEW_TAB / NAVIGATE) ────────────

import {
  isSwitchTabRequest,
  isOpenNewTabRequest,
  isNavigateRequest,
  isGetFaviconRequest,
} from '../../lib/messaging';
import type {
  SwitchTabRequest,
  OpenNewTabRequest,
  NavigateRequest,
} from '../../lib/messaging';

describe('isSwitchTabRequest', () => {
  it('returns true for a valid SwitchTabRequest', () => {
    const msg: SwitchTabRequest = { type: 'SWITCH_TAB', payload: { tabId: 42 } };
    expect(isSwitchTabRequest(msg)).toBe(true);
  });

  it('returns true for tabId 0', () => {
    expect(isSwitchTabRequest({ type: 'SWITCH_TAB', payload: { tabId: 0 } })).toBe(true);
  });

  it('returns false for negative tabId', () => {
    expect(isSwitchTabRequest({ type: 'SWITCH_TAB', payload: { tabId: -1 } })).toBe(false);
  });

  it('returns false for non-integer tabId', () => {
    expect(isSwitchTabRequest({ type: 'SWITCH_TAB', payload: { tabId: 1.5 } })).toBe(false);
  });

  it('returns false for string tabId', () => {
    expect(isSwitchTabRequest({ type: 'SWITCH_TAB', payload: { tabId: '5' } })).toBe(false);
  });

  it('returns false for missing payload', () => {
    expect(isSwitchTabRequest({ type: 'SWITCH_TAB' })).toBe(false);
  });

  it('returns false for wrong type', () => {
    expect(isSwitchTabRequest({ type: 'NAVIGATE', payload: { tabId: 1 } })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSwitchTabRequest(null)).toBe(false);
  });
});

describe('isOpenNewTabRequest', () => {
  it('returns true for a valid OpenNewTabRequest', () => {
    const msg: OpenNewTabRequest = { type: 'OPEN_NEW_TAB', payload: { url: 'https://example.com' } };
    expect(isOpenNewTabRequest(msg)).toBe(true);
  });

  it('returns false for empty url', () => {
    expect(isOpenNewTabRequest({ type: 'OPEN_NEW_TAB', payload: { url: '' } })).toBe(false);
  });

  it('returns false for non-string url', () => {
    expect(isOpenNewTabRequest({ type: 'OPEN_NEW_TAB', payload: { url: 123 } })).toBe(false);
  });

  it('returns false for url longer than 4096 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(4100);
    expect(isOpenNewTabRequest({ type: 'OPEN_NEW_TAB', payload: { url: longUrl } })).toBe(false);
  });

  it('returns false for missing payload', () => {
    expect(isOpenNewTabRequest({ type: 'OPEN_NEW_TAB' })).toBe(false);
  });

  it('returns false for wrong type', () => {
    expect(isOpenNewTabRequest({ type: 'NAVIGATE', payload: { url: 'https://example.com' } })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isOpenNewTabRequest(null)).toBe(false);
  });
});

describe('isNavigateRequest', () => {
  it('returns true for a valid NavigateRequest', () => {
    const msg: NavigateRequest = { type: 'NAVIGATE', payload: { url: 'https://example.com' } };
    expect(isNavigateRequest(msg)).toBe(true);
  });

  it('returns false for empty url', () => {
    expect(isNavigateRequest({ type: 'NAVIGATE', payload: { url: '' } })).toBe(false);
  });

  it('returns false for non-string url', () => {
    expect(isNavigateRequest({ type: 'NAVIGATE', payload: { url: null } })).toBe(false);
  });

  it('returns false for missing payload', () => {
    expect(isNavigateRequest({ type: 'NAVIGATE' })).toBe(false);
  });

  it('returns false for wrong type', () => {
    expect(isNavigateRequest({ type: 'OPEN_NEW_TAB', payload: { url: 'https://example.com' } })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNavigateRequest(null)).toBe(false);
  });
});

describe('Message union type with new types', () => {
  it('can assign GET_ALL_TABS to Message union', () => {
    const msg: GetAllTabsRequest = { type: 'GET_ALL_TABS' };
    // Just verifying type compiles correctly
    expect(msg.type).toBe('GET_ALL_TABS');
  });

  it('can assign GET_BOOKMARK_TREE to Message union', () => {
    const msg: GetBookmarkTreeRequest = { type: 'GET_BOOKMARK_TREE' };
    expect(msg.type).toBe('GET_BOOKMARK_TREE');
  });
});

// ─── Edge cases for type guards ────────────────────────────────────────────

describe('Type guard edge cases', () => {
  describe('isSearchRequest with edge inputs', () => {
    it('returns false for empty object', () => {
      expect(isSearchRequest({})).toBe(false);
    });

    it('returns false for object with wrong type field', () => {
      expect(isSearchRequest({ type: 'WRONG' })).toBe(false);
    });

    it('returns false for number', () => {
      expect(isSearchRequest(42)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isSearchRequest('SEARCH')).toBe(false);
    });
  });

  describe('isExecuteActionRequest with edge inputs', () => {
    it('returns false for empty object', () => {
      expect(isExecuteActionRequest({})).toBe(false);
    });

    it('returns false for object with wrong type field', () => {
      expect(isExecuteActionRequest({ type: 'SEARCH' })).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isExecuteActionRequest(undefined)).toBe(false);
    });

    it('returns false for missing payload', () => {
      expect(isExecuteActionRequest({ type: 'EXECUTE_ACTION' })).toBe(false);
    });

    it('returns false for empty actionId', () => {
      expect(
        isExecuteActionRequest({ type: 'EXECUTE_ACTION', payload: { actionId: '' } })
      ).toBe(false);
    });

    it('returns false for actionId longer than 128 chars', () => {
      expect(
        isExecuteActionRequest({
          type: 'EXECUTE_ACTION',
          payload: { actionId: 'a'.repeat(129) },
        })
      ).toBe(false);
    });

    it('returns false for negative targetTabId', () => {
      expect(
        isExecuteActionRequest({
          type: 'EXECUTE_ACTION',
          payload: { actionId: 'x', targetTabId: -1 },
        })
      ).toBe(false);
    });

    it('returns false for non-integer targetTabId', () => {
      expect(
        isExecuteActionRequest({
          type: 'EXECUTE_ACTION',
          payload: { actionId: 'x', targetTabId: 1.5 },
        })
      ).toBe(false);
    });
  });

  describe('isSearchRequest payload-shape edges', () => {
    it('returns false for missing payload', () => {
      expect(isSearchRequest({ type: 'SEARCH' })).toBe(false);
    });

    it('returns false for non-string query', () => {
      expect(isSearchRequest({ type: 'SEARCH', payload: { query: 7, sources: [] } })).toBe(false);
    });

    it('returns false for query longer than 2048 chars', () => {
      expect(
        isSearchRequest({
          type: 'SEARCH',
          payload: { query: 'x'.repeat(2049), sources: [] },
        })
      ).toBe(false);
    });

    it('returns false for non-array sources', () => {
      expect(
        isSearchRequest({ type: 'SEARCH', payload: { query: 'q', sources: 'tabs' } })
      ).toBe(false);
    });

    it('returns false for sources array longer than 16', () => {
      expect(
        isSearchRequest({
          type: 'SEARCH',
          payload: { query: 'q', sources: new Array(17).fill('tabs') },
        })
      ).toBe(false);
    });

    it('returns false for unknown source value', () => {
      expect(
        isSearchRequest({ type: 'SEARCH', payload: { query: 'q', sources: ['evil'] } })
      ).toBe(false);
    });
  });

  describe('isToggleOverlayCommand with edge inputs', () => {
    it('returns false for empty object', () => {
      expect(isToggleOverlayCommand({})).toBe(false);
    });

    it('returns false for object with wrong type field', () => {
      expect(isToggleOverlayCommand({ type: 'SEARCH' })).toBe(false);
    });
  });

  describe('isSmartSuggestionsRequest with edge inputs', () => {
    it('returns false for empty object', () => {
      expect(isSmartSuggestionsRequest({})).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isSmartSuggestionsRequest(undefined)).toBe(false);
    });
  });

  describe('isGetSettingsRequest with edge inputs', () => {
    it('returns false for empty object', () => {
      expect(isGetSettingsRequest({})).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isGetSettingsRequest(undefined)).toBe(false);
    });

    it('returns false for object with wrong type field', () => {
      expect(isGetSettingsRequest({ type: 'WRONG' })).toBe(false);
    });
  });
});

describe('isGetFaviconRequest', () => {
  it('returns true for a valid http GET_FAVICON request', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'https://a.com/f.ico' } })
    ).toBe(true);
  });

  it('returns true for a data: url', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'data:image/png;base64,AAAA' } })
    ).toBe(true);
  });

  it('returns false for the wrong type', () => {
    expect(isGetFaviconRequest({ type: 'SEARCH', payload: { url: 'https://a.com' } })).toBe(false);
  });

  it('returns false when url is missing', () => {
    expect(isGetFaviconRequest({ type: 'GET_FAVICON', payload: {} })).toBe(false);
  });

  it('returns false when payload is not an object', () => {
    expect(isGetFaviconRequest({ type: 'GET_FAVICON' })).toBe(false);
    expect(isGetFaviconRequest({ type: 'GET_FAVICON', payload: 'https://a.com' })).toBe(false);
  });

  it('returns false for a non-string url', () => {
    expect(isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 123 } })).toBe(false);
  });

  it('returns false for a disallowed scheme', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'javascript:alert(1)' } })
    ).toBe(false);
  });

  it('returns false for an over-length url', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'https://a.com/' + 'x'.repeat(5000) } })
    ).toBe(false);
  });

  it('returns false for a malformed url that new URL() cannot parse', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'not a parseable url' } })
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGetFaviconRequest(null)).toBe(false);
  });
});

// ─── Overlay data guards (GET_HISTORY_ITEMS / GET_ACTIONS) ─────────────────

import {
  isGetHistoryItemsRequest,
  isGetActionsRequest,
} from '../../lib/messaging';
import type {
  GetHistoryItemsRequest,
  GetActionsRequest,
} from '../../lib/messaging';

describe('isGetHistoryItemsRequest', () => {
  it('returns true for a valid GetHistoryItemsRequest', () => {
    const msg: GetHistoryItemsRequest = { type: 'GET_HISTORY_ITEMS' };
    expect(isGetHistoryItemsRequest(msg)).toBe(true);
  });

  it('returns false for a different type', () => {
    expect(isGetHistoryItemsRequest({ type: 'GET_ALL_TABS' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGetHistoryItemsRequest(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGetHistoryItemsRequest(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isGetHistoryItemsRequest({})).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isGetHistoryItemsRequest('GET_HISTORY_ITEMS')).toBe(false);
  });
});

describe('isGetActionsRequest', () => {
  it('returns true for a valid GetActionsRequest', () => {
    const msg: GetActionsRequest = { type: 'GET_ACTIONS' };
    expect(isGetActionsRequest(msg)).toBe(true);
  });

  it('returns false for a different type', () => {
    expect(isGetActionsRequest({ type: 'EXECUTE_ACTION' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGetActionsRequest(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGetActionsRequest(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isGetActionsRequest({})).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isGetActionsRequest('GET_ACTIONS')).toBe(false);
  });
});
