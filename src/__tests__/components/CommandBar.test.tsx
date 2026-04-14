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
        } else if (
          message.type === 'SWITCH_TAB' ||
          message.type === 'NAVIGATE' ||
          message.type === 'OPEN_NEW_TAB'
        ) {
          if (callback) callback({ success: true });
        }
        return undefined as unknown as Promise<unknown>;
      }) as unknown as typeof chrome.runtime.sendMessage
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
      (c) => (c[0] as unknown as { type: string }).type === 'GET_SETTINGS'
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
        (c) => (c[0] as unknown as { type: string }).type === 'EXECUTE_ACTION'
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

  // ─── Keyboard interactions (observable behavior) ─────────────────────────

  function fireSmbKey(key: string, shiftKey = false) {
    document.dispatchEvent(
      new CustomEvent('smb-keydown', { detail: { key, shiftKey } })
    );
  }

  function findCall(type: string) {
    return vi.mocked(chrome.runtime.sendMessage).mock.calls.find(
      (c) => (c[0] as unknown as { type: string }).type === type
    );
  }

  it('Enter on a folder/group item is a no-throw expand toggle', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());
    // Selection defaults to index 0 — first visible row, which is a group.
    fireSmbKey('Enter');
    // No navigation message, no dismiss.
    expect(findCall('SWITCH_TAB')).toBeUndefined();
    expect(findCall('NAVIGATE')).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('ArrowDown moves the selection past the first item', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
    // Smoke: dispatching ArrowDown must not throw.
    fireSmbKey('ArrowDown');
    fireSmbKey('ArrowDown');
    fireSmbKey('ArrowUp');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('Tab cycles forward and Shift+Tab cycles backward', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
    fireSmbKey('Tab');
    fireSmbKey('Tab', true);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('toggles between jump and search modes when / is dispatched twice', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    fireSmbKey('/');
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy()
    );
    fireSmbKey('/');
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Press / to search')).toBeTruthy()
    );
  });

  it('ArrowRight on a collapsed folder triggers toggleExpand (no crash)', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());
    // Move down a few times to land on a folder, then expand.
    fireSmbKey('ArrowDown');
    fireSmbKey('ArrowDown');
    fireSmbKey('ArrowRight');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('search-mode Tab/ArrowDown still cycle the selection', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    fireSmbKey('/'); // enter search mode
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy()
    );
    fireSmbKey('Tab');
    fireSmbKey('ArrowDown');
    fireSmbKey('ArrowUp');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('label key for a tab dispatches SWITCH_TAB', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    // 'a' is the dynamic label for allTabs[0] (Gmail, tabId=1)
    fireSmbKey('a');
    await waitFor(() => {
      const switchCall = findCall('SWITCH_TAB');
      expect(switchCall).toBeTruthy();
      expect((switchCall![0] as unknown as { payload: { tabId: number } }).payload.tabId).toBe(1);
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('label key for a bookmark folder toggles expand without dismissing', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());

    // 'e' is the third dynamic label (allTabs[0]='a', allTabs[1]='b',
    // then visibleItems[0]='e' — Bookmarks Bar folder).
    fireSmbKey('e');

    // Folder activation: no SWITCH_TAB/NAVIGATE, no dismiss.
    expect(findCall('SWITCH_TAB')).toBeUndefined();
    expect(findCall('NAVIGATE')).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
    // After expand the bookmark child becomes visible.
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
  });

  it('Enter on a bookmark URL dispatches NAVIGATE', async () => {
    const onDismiss = vi.fn();
    const { container } = render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());

    // Expand the Bookmarks Bar folder, then move to its child and Enter.
    fireSmbKey('ArrowRight');           // expand (selection at folder, idx 0)
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
    fireSmbKey('ArrowDown');            // move to bookmark
    // Wait for the selection-change to propagate before firing Enter.
    await waitFor(() => {
      const selected = container.querySelector('.smb-tree-item--selected');
      expect(selected?.textContent).toContain('React Docs');
    });
    fireSmbKey('Enter');

    await waitFor(() => {
      const nav = findCall('NAVIGATE');
      expect(nav).toBeTruthy();
      expect((nav![0] as unknown as { payload: { url: string } }).payload.url).toBe('https://react.dev');
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('Shift+Enter on a bookmark URL dispatches OPEN_NEW_TAB', async () => {
    const onDismiss = vi.fn();
    const { container } = render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());

    fireSmbKey('ArrowRight');
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
    fireSmbKey('ArrowDown');
    await waitFor(() => {
      const selected = container.querySelector('.smb-tree-item--selected');
      expect(selected?.textContent).toContain('React Docs');
    });
    fireSmbKey('Enter', /* shift */ true);

    await waitFor(() => {
      const open = findCall('OPEN_NEW_TAB');
      expect(open).toBeTruthy();
      expect((open![0] as unknown as { payload: { url: string } }).payload.url).toBe('https://react.dev');
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('ArrowLeft on an expanded folder collapses it', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());

    fireSmbKey('ArrowRight'); // expand
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
    fireSmbKey('ArrowLeft');  // collapse from the folder row
    await waitFor(() => expect(screen.queryByText('React Docs')).toBeNull());
  });

  it('ArrowLeft on a child bookmark jumps to its parent folder', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());

    fireSmbKey('ArrowRight');
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
    fireSmbKey('ArrowDown');  // move into child
    fireSmbKey('ArrowLeft');  // expected: jump to parent (folder), not collapse
    // Folder still expanded — child still visible (collapse only fires on the
    // folder row itself, not on children).
    expect(screen.getByText('React Docs')).toBeTruthy();
  });

  it('action key sends EXECUTE_ACTION with the action- prefix', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    fireSmbKey('p'); // pin-tab
    await waitFor(() => {
      const exec = findCall('EXECUTE_ACTION');
      expect(exec).toBeTruthy();
      expect(
        (exec![0] as unknown as { payload: { actionId: string } }).payload.actionId
      ).toBe('action-pin-tab');
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('Tab moves selection forward without invoking activation', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());
    fireSmbKey('Tab');
    expect(findCall('SWITCH_TAB')).toBeUndefined();
    expect(findCall('NAVIGATE')).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('"u" copies the cleaned page URL to the clipboard and dismisses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: 'https://example.com/page?utm_source=x&id=42&gclid=abc' },
    });

    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    fireSmbKey('u');

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://example.com/page?id=42');
      expect(onDismiss).toHaveBeenCalled();
    });
    // Copy-clean-link is handled inline — no EXECUTE_ACTION message is dispatched.
    expect(findCall('EXECUTE_ACTION')).toBeUndefined();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: originalHref },
    });
  });
});

// ─── Pinned-tab number shortcuts ────────────────────────────────────────────

describe('CommandBar — pinned tab number shortcuts', () => {
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
            shortcut: 'Ctrl+Shift+Space', position: 'center', theme: 'dark',
            maxResultsPerGroup: 5, showFavicons: true,
            searchSources: { tabs: true, bookmarks: true, history: true },
          },
        });
      } else if (message.type === 'GET_ALL_TABS' && callback) {
        callback({
          groups: [
            {
              label: 'Window 1', type: 'window',
              tabs: [
                { id: 11, title: 'Pinned-A', url: 'https://a.example', favIconUrl: '', windowId: 1, pinned: true,  audible: false },
                { id: 12, title: 'Pinned-B', url: 'https://b.example', favIconUrl: '', windowId: 1, pinned: true,  audible: false },
                { id: 13, title: 'Regular',  url: 'https://c.example', favIconUrl: '', windowId: 1, pinned: false, audible: false },
              ],
            },
          ],
        });
      } else if (message.type === 'GET_BOOKMARK_TREE' && callback) {
        callback({ tree: [] });
      } else if (callback) {
        callback({ success: true });
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage);
  });

  function fireSmbKey(key: string, shiftKey = false) {
    document.dispatchEvent(
      new CustomEvent('smb-keydown', { detail: { key, shiftKey } })
    );
  }
  function findCall(type: string) {
    return vi.mocked(chrome.runtime.sendMessage).mock.calls.find(
      (c) => (c[0] as unknown as { type: string }).type === type
    );
  }

  it('"1" switches to the first pinned tab', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Regular')).toBeTruthy());

    fireSmbKey('1');
    await waitFor(() => {
      const c = findCall('SWITCH_TAB');
      expect(c).toBeTruthy();
      expect((c![0] as unknown as { payload: { tabId: number } }).payload.tabId).toBe(11);
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('"2" switches to the second pinned tab', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Regular')).toBeTruthy());

    fireSmbKey('2');
    await waitFor(() => {
      const c = findCall('SWITCH_TAB');
      expect(c).toBeTruthy();
      expect((c![0] as unknown as { payload: { tabId: number } }).payload.tabId).toBe(12);
    });
  });

  it('"5" with only 2 pinned tabs is a no-op (no SWITCH_TAB)', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Regular')).toBeTruthy());

    fireSmbKey('5');
    expect(findCall('SWITCH_TAB')).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
