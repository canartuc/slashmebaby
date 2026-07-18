// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// TS-096: shortcut labels must show ⌘ on macOS and Ctrl elsewhere. isMac is
// a module-scope const derived from navigator.userAgent, so each case stubs
// the UA and re-imports the component fresh.

async function renderShortcutPickerWithUA(userAgent: string) {
  vi.resetModules();
  vi.stubGlobal('navigator', { ...navigator, userAgent });
  const { ShortcutPicker } = await import('../../components/Onboarding/ShortcutPicker');
  return render(
    React.createElement(ShortcutPicker, {
      selectedShortcut: 'Ctrl+Shift+Space',
      onSelect: () => {},
    })
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('platform shortcut labels (TS-096)', () => {
  it('shows ⌘ labels on macOS', async () => {
    await renderShortcutPickerWithUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );
    expect(screen.getByText('⌘ + Shift + Space')).toBeTruthy();
    expect(screen.queryByText('Ctrl + Shift + Space')).toBeNull();
  });

  it('shows Ctrl labels on non-mac platforms', async () => {
    await renderShortcutPickerWithUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );
    expect(screen.getByText('Ctrl + Shift + Space')).toBeTruthy();
    expect(screen.queryByText('⌘ + Shift + Space')).toBeNull();
  });
});
