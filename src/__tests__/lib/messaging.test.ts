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
    expect(DEFAULT_SETTINGS.shortcut).toBe('Alt+Space');
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
