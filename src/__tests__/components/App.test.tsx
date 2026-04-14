// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../entrypoints/content/App';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('App', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        const message = msg as { type: string };
        if (message.type === 'GET_SETTINGS' && callback) {
          callback({
            settings: {
              shortcut: 'Ctrl+Shift+Space',
              position: 'center',
              theme: 'dark',
              maxResultsPerGroup: 5,
              showFavicons: true,
              searchSources: { tabs: true, bookmarks: true, history: true },
            },
          });
        } else if (message.type === 'GET_ALL_TABS' && callback) {
          callback({ groups: [] });
        } else if (message.type === 'GET_BOOKMARK_TREE' && callback) {
          callback({ tree: [] });
        }
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );
  });

  it('renders the CommandBar inside App', () => {
    render(<App onDismiss={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
  });

  it('renders the search input in jump mode', () => {
    render(<App onDismiss={() => {}} />);
    const input = screen.getByPlaceholderText('Press / to search');
    expect(input).toBeTruthy();
  });

  it('passes onDismiss to CommandBar', () => {
    const onDismiss = vi.fn();
    const { container } = render(<App onDismiss={onDismiss} />);
    // Clicking the backdrop should trigger onDismiss
    const backdrop = container.querySelector('.smb-backdrop')!;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
