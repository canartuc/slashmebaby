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

describe('CommandBar', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();

    // Default mock: respond to GET_SETTINGS and SMART_SUGGESTIONS
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

  it('calls onDismiss when clicking the backdrop', async () => {
    const onDismiss = vi.fn();
    const { container } = render(<CommandBar onDismiss={onDismiss} />);
    const backdrop = container.querySelector('.smb-backdrop')!;
    fireEvent.click(backdrop);
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

  it('sends EXECUTE_ACTION and dismisses when selecting an item', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);

    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Gmail'));

    // Verify EXECUTE_ACTION was sent (no callback passed)
    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const executeCall = calls.find(
      (c) => (c[0] as { type: string }).type === 'EXECUTE_ACTION'
    );
    expect(executeCall).toBeTruthy();
    expect((executeCall![0] as { payload: { actionId: string } }).payload.actionId).toBe('tab-1');
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
