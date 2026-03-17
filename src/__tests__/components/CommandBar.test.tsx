// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CommandBar } from '../../components/CommandBar/CommandBar';

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
        } else if (message.type === 'GET_ALL_TABS' && callback) {
          callback({
            groups: [
              {
                label: 'Window 1',
                type: 'window',
                tabs: [
                  { id: 1, title: 'Gmail', url: 'https://mail.google.com', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                  { id: 2, title: 'GitHub', url: 'https://github.com', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                ],
              },
            ],
          });
        } else if (message.type === 'GET_BOOKMARK_TREE' && callback) {
          callback({
            tree: [
              {
                id: '1',
                title: 'Bookmarks Bar',
                children: [
                  { id: '2', title: 'React Docs', url: 'https://react.dev' },
                ],
              },
            ],
          });
        } else if (message.type === 'EXECUTE_ACTION') {
          if (callback) callback({ success: true });
        } else if (message.type === 'SWITCH_TAB' || message.type === 'NAVIGATE') {
          if (callback) callback({ success: true });
        }
        return undefined as unknown as Promise<unknown>;
      }
    );
  });

  it('renders in jump mode by default with jump placeholder', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    const input = screen.getByPlaceholderText('Press / to search');
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

  it('renders tab grid with open tabs', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      // Tabs are now shown in a grid under "Open Tabs", not as tree groups
      expect(screen.getByText('Open Tabs')).toBeTruthy();
    });
  });

  it('renders tree view with bookmark folders', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Bookmarks Bar')).toBeTruthy();
    });
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
    dialog.click();
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

  it('loads settings on mount', () => {
    render(<CommandBar onDismiss={() => {}} />);
    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const settingsCall = calls.find(
      (c) => (c[0] as { type: string }).type === 'GET_SETTINGS'
    );
    expect(settingsCall).toBeTruthy();
  });

  it('switches to search mode when / key is dispatched', async () => {
    render(<CommandBar onDismiss={() => {}} />);

    // Initially in jump mode
    expect(screen.getByPlaceholderText('Press / to search')).toBeTruthy();

    // Dispatch custom event to switch mode
    document.dispatchEvent(new CustomEvent('smb-keydown', {
      detail: { key: '/', shiftKey: false },
    }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy();
    });
  });

  it('executes action when action key is dispatched', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);

    // Dispatch 'c' key (close tab action)
    document.dispatchEvent(new CustomEvent('smb-keydown', {
      detail: { key: 'c', shiftKey: false },
    }));

    await waitFor(() => {
      const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
      const actionCall = calls.find(
        (c) => (c[0] as { type: string }).type === 'EXECUTE_ACTION'
      );
      expect(actionCall).toBeTruthy();
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it('renders the TreeView component (has listbox role)', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeTruthy();
    });
  });

  it('has input readonly in jump mode', () => {
    render(<CommandBar onDismiss={() => {}} />);
    const input = screen.getByPlaceholderText('Press / to search') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});
