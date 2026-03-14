// Stub WXT auto-imported globals so they don't throw in the test environment
import { vi } from 'vitest';

// defineBackground is auto-imported by WXT but not available in Node test env
vi.stubGlobal('defineBackground', (fn: () => void) => fn);

// defineContentScript is auto-imported by WXT for content scripts
vi.stubGlobal(
  'defineContentScript',
  (config: { matches: string[]; main: () => void }) => config
);

// ─── Chrome API stub ─────────────────────────────────────────────────────────
// Provides a minimal chrome global so that tests in both node and jsdom
// environments can mock chrome.runtime.sendMessage, chrome.storage, etc.
// Individual test files can override specific methods via vi.mocked().

if (typeof globalThis.chrome === 'undefined') {
  const noop = vi.fn();
  const noopListener = { addListener: vi.fn(), removeListener: vi.fn() };

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: noopListener,
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    },
    storage: {
      sync: {
        get: vi.fn((_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({})),
        set: vi.fn((_items: unknown, cb?: () => void) => cb?.()),
      },
      local: {
        get: vi.fn((_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({})),
        set: vi.fn((_items: unknown, cb?: () => void) => cb?.()),
      },
    },
    tabs: {
      query: vi.fn(),
      update: vi.fn(),
      onCreated: noopListener,
      onRemoved: noopListener,
      onUpdated: noopListener,
      onActivated: noopListener,
    },
    bookmarks: {
      getTree: vi.fn(),
      onCreated: noopListener,
      onRemoved: noopListener,
      onChanged: noopListener,
    },
    history: {
      search: vi.fn(),
    },
    commands: {
      onCommand: noopListener,
    },
  });
}
