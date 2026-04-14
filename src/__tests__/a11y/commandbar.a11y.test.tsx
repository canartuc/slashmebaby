// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import axe from 'axe-core';
import { Popup } from '../../entrypoints/popup/Popup';
import { CommandBar } from '../../components/CommandBar/CommandBar';

async function runAxe(container: HTMLElement) {
  return axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
}

function stubChrome() {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn((_: unknown, cb?: (r: unknown) => void) => {
        cb?.({
          settings: {
            shortcut: 'Ctrl+Shift+Space',
            position: 'center',
            theme: 'light',
            maxResultsPerGroup: 5,
            showFavicons: true,
            searchSources: { tabs: true, bookmarks: true, history: true },
          },
          groups: [],
          tree: [],
        });
      }),
    },
    storage: {
      sync: {
        get: vi.fn((_: unknown, cb: (r: Record<string, unknown>) => void) => cb({})),
        set: vi.fn(),
      },
    },
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('accessibility', () => {
  it('Popup renders with no detectable a11y violations', async () => {
    stubChrome();
    const { container } = render(<Popup />);
    // color-contrast skipped: Shadow DOM stylesheet never loads under jsdom.
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
    cleanup();
  });

  it('CommandBar renders with no detectable a11y violations', async () => {
    stubChrome();
    const { container } = render(<CommandBar onDismiss={() => {}} />);
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
    cleanup();
  });
});
