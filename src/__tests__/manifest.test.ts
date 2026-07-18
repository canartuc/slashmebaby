import { describe, it, expect } from 'vitest';
import wxtConfig from '../../wxt.config';

// The manifest key in wxt.config.ts is the function form so permissions and
// version floors can vary per target browser. These tests pin the floors the
// palette's fallback paths rely on.

type ManifestFn = (env: { browser: 'chrome' | 'firefox' }) => {
  minimum_chrome_version?: string;
  action?: { default_popup?: string };
  commands?: Record<string, unknown>;
  permissions?: string[];
  browser_specific_settings?: { gecko?: { strict_min_version?: string } };
};

function getManifestFn(): ManifestFn {
  const manifest = (wxtConfig as { manifest?: unknown }).manifest;
  if (typeof manifest !== 'function') {
    throw new Error('wxt.config.ts manifest is expected to be the function form');
  }
  return manifest as ManifestFn;
}

describe('manifest configuration', () => {
  it('chrome manifest requires minimum_chrome_version 127 for action.openPopup', () => {
    const manifest = getManifestFn()({ browser: 'chrome' });
    // chrome.action.openPopup() is undefined for normal installs before 127;
    // the restricted-page shortcut fallback depends on it.
    expect(manifest.minimum_chrome_version).toBe('127');
  });

  it('firefox manifest pins gecko strict_min_version 126.0 for the onCommand tab argument', () => {
    const manifest = getManifestFn()({ browser: 'firefox' });
    // commands.onCommand only passes the active tab from Firefox 126; the
    // handler needs it to call openPopup synchronously (pre-149 gesture rule).
    expect(manifest.browser_specific_settings?.gecko?.strict_min_version).toBe('126.0');
  });

  it('both manifests keep the default popup and the toggle command', () => {
    for (const browser of ['chrome', 'firefox'] as const) {
      const manifest = getManifestFn()({ browser });
      expect(manifest.action?.default_popup).toBe('popup/index.html');
      expect(manifest.commands).toHaveProperty('toggle-command-bar');
    }
  });
});
