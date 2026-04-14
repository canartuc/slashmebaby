import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import type { UserSettings } from '../../lib/messaging';
import {
  getSettings,
  saveSettings,
  getOnboardingState,
  saveOnboardingState,
} from '../../lib/storage';

// ─── Chrome stub helpers ───────────────────────────────────────────────────

function makeSyncStore(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    get: vi.fn((keys: string | string[] | null, cb: (result: Record<string, unknown>) => void) => {
      if (keys === null) {
        cb({ ...store });
      } else {
        const k = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        k.forEach((key) => { if (key in store) result[key] = store[key]; });
        cb(result);
      }
    }),
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    }),
  };
}

function makeLocalStore(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    get: vi.fn((keys: string | string[] | null, cb: (result: Record<string, unknown>) => void) => {
      if (keys === null) {
        cb({ ...store });
      } else {
        const k = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        k.forEach((key) => { if (key in store) result[key] = store[key]; });
        cb(result);
      }
    }),
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('getSettings', () => {
  it('returns DEFAULT_SETTINGS when storage is empty', async () => {
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored settings with defaults', async () => {
    const stored: Partial<UserSettings> = { theme: 'dark', maxResultsPerGroup: 10 };
    const syncStore = makeSyncStore({ settings: stored });
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const settings = await getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.maxResultsPerGroup).toBe(10);
    // Non-overridden defaults remain
    expect(settings.shortcut).toBe(DEFAULT_SETTINGS.shortcut);
    expect(settings.position).toBe(DEFAULT_SETTINGS.position);
    expect(settings.showFavicons).toBe(DEFAULT_SETTINGS.showFavicons);
  });

  it('returns full DEFAULT_SETTINGS structure when storage returns no settings key', async () => {
    const syncStore = makeSyncStore({ someOtherKey: 'value' });
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('writes settings to chrome.storage.sync under "settings" key', async () => {
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const newSettings: UserSettings = { ...DEFAULT_SETTINGS, theme: 'light' };
    await saveSettings(newSettings);

    expect(syncStore.set).toHaveBeenCalledWith(
      { settings: newSettings },
      expect.any(Function)
    );
  });

  it('round-trips: saved settings are returned by getSettings', async () => {
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const newSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      shortcut: 'Ctrl+K',
      position: 'top',
    };
    await saveSettings(newSettings);
    const retrieved = await getSettings();

    expect(retrieved.shortcut).toBe('Ctrl+K');
    expect(retrieved.position).toBe('top');
  });
});

describe('getOnboardingState', () => {
  it('returns default state { completedStep: 0, completed: false } when empty', async () => {
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const state = await getOnboardingState();
    expect(state).toEqual({ completedStep: 0, completed: false });
  });

  it('returns stored onboarding state', async () => {
    const stored = { completedStep: 3, completed: true };
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore({ onboarding: stored });
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const state = await getOnboardingState();
    expect(state).toEqual(stored);
  });

  it('returns partial state merged with defaults', async () => {
    const stored = { completedStep: 2 };
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore({ onboarding: stored });
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const state = await getOnboardingState();
    expect(state.completedStep).toBe(2);
    expect(state.completed).toBe(false);
  });
});

describe('saveOnboardingState', () => {
  it('writes state to chrome.storage.local under "onboarding" key', async () => {
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const newState = { completedStep: 2, completed: false };
    await saveOnboardingState(newState);

    expect(localStore.set).toHaveBeenCalledWith(
      { onboarding: newState },
      expect.any(Function)
    );
  });

  it('round-trips: saved state is returned by getOnboardingState', async () => {
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const newState = { completedStep: 5, completed: true };
    await saveOnboardingState(newState);
    const retrieved = await getOnboardingState();

    expect(retrieved).toEqual(newState);
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────

describe('getSettings edge cases', () => {
  it('handles corrupted/partial settings object — falls back to defaults for missing fields', async () => {
    // Partial settings: only 'theme' is present, rest is missing
    const partialSettings = { theme: 'dark' };
    const syncStore = makeSyncStore({ settings: partialSettings });
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const settings = await getSettings();
    // Overridden field
    expect(settings.theme).toBe('dark');
    // Default fields should still be present
    expect(settings.shortcut).toBe(DEFAULT_SETTINGS.shortcut);
    expect(settings.position).toBe(DEFAULT_SETTINGS.position);
    expect(settings.maxResultsPerGroup).toBe(DEFAULT_SETTINGS.maxResultsPerGroup);
    expect(settings.showFavicons).toBe(DEFAULT_SETTINGS.showFavicons);
    expect(settings.searchSources).toEqual(DEFAULT_SETTINGS.searchSources);
  });

  it('handles completely empty settings object ({})', async () => {
    const syncStore = makeSyncStore({ settings: {} });
    const localStore = makeLocalStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('getOnboardingState edge cases', () => {
  it('returns default state when onboarding key is missing from storage', async () => {
    // Storage has keys, but not 'onboarding'
    const syncStore = makeSyncStore();
    const localStore = makeLocalStore({ someOtherKey: 'value' });
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const state = await getOnboardingState();
    expect(state).toEqual({ completedStep: 0, completed: false });
  });

  it('handles partially corrupted onboarding state', async () => {
    // Only completedStep present, completed missing
    const localStore = makeLocalStore({ onboarding: { completedStep: 4 } });
    const syncStore = makeSyncStore();
    vi.stubGlobal('chrome', { storage: { sync: syncStore, local: localStore } });

    const state = await getOnboardingState();
    expect(state.completedStep).toBe(4);
    expect(state.completed).toBe(false); // defaults
  });
});
