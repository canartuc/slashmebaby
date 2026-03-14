import { DEFAULT_SETTINGS } from './messaging';
import type { UserSettings } from './messaging';

// ─── Onboarding State ─────────────────────────────────────────────────────────

export interface OnboardingState {
  completedStep: number;
  completed: boolean;
}

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completedStep: 0,
  completed: false,
};

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Reads UserSettings from chrome.storage.sync and merges with DEFAULT_SETTINGS.
 */
export function getSettings(): Promise<UserSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      const stored = (result['settings'] as Partial<UserSettings>) ?? {};
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

/**
 * Persists UserSettings to chrome.storage.sync under the 'settings' key.
 */
export function saveSettings(settings: UserSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      resolve();
    });
  });
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

/**
 * Reads OnboardingState from chrome.storage.local and merges with defaults.
 */
export function getOnboardingState(): Promise<OnboardingState> {
  return new Promise((resolve) => {
    chrome.storage.local.get('onboarding', (result) => {
      const stored = (result['onboarding'] as Partial<OnboardingState>) ?? {};
      resolve({ ...DEFAULT_ONBOARDING_STATE, ...stored });
    });
  });
}

/**
 * Persists OnboardingState to chrome.storage.local under the 'onboarding' key.
 */
export function saveOnboardingState(state: OnboardingState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ onboarding: state }, () => {
      resolve();
    });
  });
}
