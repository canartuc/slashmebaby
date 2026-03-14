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
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (response: unknown) => void) => {
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
      }
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

  it('sends EXECUTE_ACTION and closes when selecting an item', async () => {
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Gmail'));

    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
    const executeCall = calls.find(
      (c) => (c[0] as { type: string }).type === 'EXECUTE_ACTION'
    );
    expect(executeCall).toBeTruthy();
    expect(
      (executeCall![0] as { payload: { actionId: string } }).payload.actionId
    ).toBe('tab-1');
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
    fireEvent.change(input, { target: { value: 'gmail' } });

    // Should send a SEARCH message
    await waitFor(() => {
      const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
      const searchCall = calls.find(
        (c) => (c[0] as { type: string }).type === 'SEARCH'
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
});
