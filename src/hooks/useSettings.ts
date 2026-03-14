import { useState, useEffect, useCallback } from 'react';
import type { UserSettings } from '../lib/messaging';
import { DEFAULT_SETTINGS } from '../lib/messaging';
import { getSettings, saveSettings } from '../lib/storage';

export interface UseSettingsResult {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  isLoading: boolean;
}

/**
 * Loads user settings from chrome.storage on mount and provides an optimistic
 * updater that writes changes back to storage.
 *
 * Returns DEFAULT_SETTINGS while the initial load is in progress.
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getSettings().then((stored) => {
      if (!cancelled) {
        setSettings(stored);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        // Fire-and-forget async save
        saveSettings(next);
        return next;
      });
    },
    []
  );

  return { settings, updateSetting, isLoading };
}
