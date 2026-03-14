// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from '../../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import type { UserSettings } from '../../lib/messaging';

describe('useSettings', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.sync.get).mockReset();
    vi.mocked(chrome.storage.sync.set).mockReset();

    // Default: return empty storage (so DEFAULT_SETTINGS are used)
    vi.mocked(chrome.storage.sync.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({});
      }
    );

    vi.mocked(chrome.storage.sync.set).mockImplementation(
      (_items: unknown, cb?: () => void) => {
        cb?.();
      }
    );
  });

  it('returns DEFAULT_SETTINGS while loading', () => {
    // Make storage.get never resolve during this test
    vi.mocked(chrome.storage.sync.get).mockImplementation(() => {
      // intentionally don't call callback
    });

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.current.isLoading).toBe(true);
  });

  it('loads settings from storage on mount', async () => {
    const customSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      position: 'top',
    };

    vi.mocked(chrome.storage.sync.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({ settings: customSettings });
      }
    );

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.position).toBe('top');
  });

  it('sets isLoading to false after load completes', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('updateSetting does optimistic local update', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSetting('theme', 'light');
    });

    expect(result.current.settings.theme).toBe('light');
  });

  it('updateSetting calls saveSettings with the updated settings', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSetting('position', 'bottom');
    });

    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      { settings: expect.objectContaining({ position: 'bottom' }) },
      expect.any(Function)
    );
  });

  it('updateSetting preserves other settings', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSetting('theme', 'dark');
    });

    // All other settings should still be defaults
    expect(result.current.settings.shortcut).toBe(DEFAULT_SETTINGS.shortcut);
    expect(result.current.settings.position).toBe(DEFAULT_SETTINGS.position);
    expect(result.current.settings.maxResultsPerGroup).toBe(DEFAULT_SETTINGS.maxResultsPerGroup);
  });

  it('cancels stale load on unmount', async () => {
    let resolveGet: ((result: Record<string, unknown>) => void) | undefined;

    vi.mocked(chrome.storage.sync.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        resolveGet = cb;
      }
    );

    const { result, unmount } = renderHook(() => useSettings());
    expect(result.current.isLoading).toBe(true);

    unmount();

    // Resolve after unmount — should not throw or update state
    if (resolveGet) {
      resolveGet({ settings: { ...DEFAULT_SETTINGS, theme: 'light' } });
    }

    // No assertion needed — just verifying no error is thrown
  });

  it('can update nested searchSources', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSetting('searchSources', {
        tabs: true,
        bookmarks: false,
        history: true,
      });
    });

    expect(result.current.settings.searchSources.bookmarks).toBe(false);
  });
});
