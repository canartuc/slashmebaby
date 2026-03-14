// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandBar } from '../../components/CommandBar/CommandBar';
import type { ResultGroup } from '../../lib/messaging';

const mockGroups: ResultGroup[] = [
  {
    category: 'tabs',
    items: [
      { id: 'tab-1', title: 'Gmail', url: 'https://mail.google.com', score: 0.9 },
      { id: 'tab-2', title: 'GitHub', url: 'https://github.com', score: 0.8 },
    ],
  },
  {
    category: 'bookmarks',
    items: [
      { id: 'bm-1', title: 'React Docs', url: 'https://react.dev', score: 0.85 },
    ],
  },
];

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

describe('CommandBar', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();

    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (response: unknown) => void) => {
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
        } else if (
          message.type === 'SMART_SUGGESTIONS' ||
          message.type === 'SEARCH'
        ) {
          if (callback) callback({ groups: mockGroups });
        } else if (message.type === 'EXECUTE_ACTION') {
          if (callback) callback({ success: true });
        } else if (message.type === 'SWITCH_TAB' || message.type === 'NAVIGATE') {
          if (callback) callback({ success: true });
        }
        return undefined as unknown as Promise<unknown>;
      }
    );
  });

  it('renders the search input', () => {
    render(<CommandBar onDismiss={() => {}} />);
    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    expect(input).toBeTruthy();
  });

  it('renders the backdrop', () => {
    const { container } = render(<CommandBar onDismiss={() => {}} />);
    const backdrop = container.querySelector('.smb-backdrop');
    expect(backdrop).toBeTruthy();
  });

  it('renders the container with dialog role', () => {
    render(<CommandBar onDismiss={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toBe('Command palette');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders results from search', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
      expect(screen.getByText('GitHub')).toBeTruthy();
      expect(screen.getByText('React Docs')).toBeTruthy();
    });
  });

  // Escape is handled in content script (document-level listener), tested in E2E

  it('does not dismiss when pressing Backspace on empty query', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('switches tab on Enter key', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const switchCall = calls.find(
      (c) => (c[0] as { type: string }).type === 'SWITCH_TAB'
    );
    expect(switchCall).toBeTruthy();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the backdrop', async () => {
    const onDismiss = vi.fn();
    const { container } = render(<CommandBar onDismiss={onDismiss} />);
    const backdrop = container.querySelector('.smb-backdrop')!;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when clicking inside the container', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('applies the correct position class', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.classList.contains('smb-container--center')).toBe(true);
    });
  });

  it('applies theme data attribute', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('sends SWITCH_TAB and dismisses when clicking a tab item', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    fireEvent.click(screen.getByText('Gmail'));

    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const switchCall = calls.find(
      (c) => (c[0] as { type: string }).type === 'SWITCH_TAB'
    );
    expect(switchCall).toBeTruthy();
    expect((switchCall![0] as { payload: { tabId: number } }).payload.tabId).toBe(1);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows live region with result count', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
    });
  });
});
