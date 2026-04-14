// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popup } from '../../entrypoints/popup/Popup';
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
  {
    category: 'actions',
    items: [
      { id: 'action-close-tab', title: 'Close Tab', score: 0.7 },
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

// Mock window.close
const mockClose = vi.fn();
Object.defineProperty(window, 'close', { value: mockClose, writable: true });

describe('Popup', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    vi.mocked(chrome.storage.sync.get).mockReset();
    vi.mocked(chrome.storage.sync.set).mockReset();
    mockClose.mockReset();

    // Mock storage to return default settings
    vi.mocked(chrome.storage.sync.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({});
      }
    );

    vi.mocked(chrome.storage.sync.set).mockImplementation(
      (_items: unknown, cb?: () => void) => {
        cb?.();
      }
    );

    // Mock runtime.sendMessage for search
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      callback?: (response: unknown) => void
    ) => {
        const message = msg as { type: string };
        if (
          message.type === 'SMART_SUGGESTIONS' ||
          message.type === 'SEARCH'
        ) {
          if (callback) callback({ groups: mockGroups });
        } else if (message.type === 'EXECUTE_ACTION') {
          if (callback) callback({ success: true });
        }
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
    );
  });

  it('renders the search input', () => {
    render(<Popup />);
    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    expect(input).toBeTruthy();
  });

  it('renders results from search', async () => {
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
      expect(screen.getByText('GitHub')).toBeTruthy();
      expect(screen.getByText('React Docs')).toBeTruthy();
    });
  });

  it('applies theme data attribute', async () => {
    const { container } = render(<Popup />);

    await waitFor(() => {
      const popup = container.querySelector('.smb-popup');
      expect(popup?.getAttribute('data-theme')).toBeTruthy();
    });
  });

  it('sends SWITCH_TAB with numeric tabId when selecting a tab result', async () => {
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Gmail'));

    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const switchCall = calls.find(
      (c) => (c[0] as unknown as { type: string }).type === 'SWITCH_TAB'
    );
    expect(switchCall).toBeTruthy();
    expect(
      (switchCall![0] as unknown as { payload: { tabId: number } }).payload.tabId
    ).toBe(1);
    expect(mockClose).toHaveBeenCalled();
  });

  it('sends NAVIGATE with the item URL when selecting a bookmark', async () => {
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('React Docs')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('React Docs'));

    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const navCall = calls.find(
      (c) => (c[0] as unknown as { type: string }).type === 'NAVIGATE'
    );
    expect(navCall).toBeTruthy();
    expect(
      (navCall![0] as unknown as { payload: { url: string } }).payload.url
    ).toBe('https://react.dev');
    expect(mockClose).toHaveBeenCalled();
  });

  it('sends EXECUTE_ACTION when selecting an action result', async () => {
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Close Tab')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Close Tab'));

    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const executeCall = calls.find(
      (c) => (c[0] as unknown as { type: string }).type === 'EXECUTE_ACTION'
    );
    expect(executeCall).toBeTruthy();
    expect(
      (executeCall![0] as unknown as { payload: { actionId: string } }).payload.actionId
    ).toBe('action-close-tab');
    expect(mockClose).toHaveBeenCalled();
  });

  it('has no backdrop element', () => {
    const { container } = render(<Popup />);
    const backdrop = container.querySelector('.smb-backdrop');
    expect(backdrop).toBeNull();
  });

  it('renders the popup container with correct class', () => {
    const { container } = render(<Popup />);
    const popup = container.querySelector('.smb-popup');
    expect(popup).toBeTruthy();
  });

  it('updates search results when query changes', async () => {
    render(<Popup />);

    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    (input as HTMLInputElement).value = 'gmail';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Should send a SEARCH message
    await waitFor(() => {
      const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
      const searchCall = calls.find(
        (c) => (c[0] as unknown as { type: string }).type === 'SEARCH'
      );
      expect(searchCall).toBeTruthy();
    });
  });

  it('renders results in a listbox', async () => {
    render(<Popup />);

    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeTruthy();
    });
  });

  it('Enter on the highlighted item routes through getItemAtIndex (group offset)', async () => {
    render(<Popup />);
    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
    });

    // Selected index 0 = first tab. Move down 3 times to reach the action group.
    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
      const exec = calls.find(
        (c) => (c[0] as unknown as { type: string }).type === 'EXECUTE_ACTION'
      );
      expect(exec).toBeTruthy();
    });
  });

  it('Escape closes the popup window', async () => {
    render(<Popup />);
    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockClose).toHaveBeenCalled();
  });

  it('Enter with no results is a no-op (does not close)', async () => {
    // Override the search mock to return empty groups
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      cb?: (response: unknown) => void
    ) => {
      const m = msg as { type: string };
      if (m.type === 'SMART_SUGGESTIONS' || m.type === 'SEARCH') {
        if (cb) cb({ groups: [] });
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage);

    render(<Popup />);
    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockClose).not.toHaveBeenCalled();
  });
});
