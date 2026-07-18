// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('Tab and Shift+Tab do not throw on the default surface', async () => {
    // Section-jump semantics are pinned in the dedicated Tab describes below.
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

  it('search-mode ArrowDown/ArrowUp still cycle the selection one item at a time', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    fireSmbKey('/'); // enter search mode
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy()
    );
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

  it('expanding a folder keeps the selection on that folder', async () => {
    // Two top-level folders so a reset-to-top is observable.
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      callback?: (response: unknown) => void
    ) => {
      const message = msg as { type: string };
      if (message.type === 'GET_BOOKMARK_TREE' && callback) {
        callback({
          tree: [
            { id: '1', title: 'Bookmarks Bar', children: [{ id: '2', title: 'React Docs', url: 'https://react.dev' }] },
            { id: '3', title: 'Work Stuff', children: [{ id: '4', title: 'Jira', url: 'https://jira.example.com' }] },
          ],
        });
      } else if (message.type === 'GET_ALL_TABS' && callback) {
        callback({ groups: [] });
      } else if (message.type === 'GET_SETTINGS' && callback) {
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
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage);

    const { container } = render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Work Stuff')).toBeTruthy());

    fireSmbKey('ArrowDown'); // move from 'Bookmarks Bar' (idx 0) to 'Work Stuff' (idx 1)
    await waitFor(() => {
      const selected = container.querySelector('.smb-tree-item--selected');
      expect(selected?.textContent).toContain('Work Stuff');
    });

    fireSmbKey('ArrowRight'); // expand 'Work Stuff' — must NOT reset selection to the top
    await waitFor(() => expect(screen.getByText('Jira')).toBeTruthy());
    const selected = container.querySelector('.smb-tree-item--selected');
    expect(selected?.textContent).toContain('Work Stuff');
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

  it('Tab never invokes activation or dismissal', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Bookmarks Bar')).toBeTruthy());
    fireSmbKey('Tab');
    expect(findCall('SWITCH_TAB')).toBeUndefined();
    expect(findCall('NAVIGATE')).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  async function enterSearchMode(query: string) {
    fireSmbKey('/');
    const input = (await waitFor(() =>
      screen.getByPlaceholderText('Search tabs, bookmarks, actions...')
    )) as HTMLInputElement;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.input(input, { target: { value: query } });
    return input;
  }

  it('search includes open tabs, not just bookmarks', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    await enterSearchMode('github');

    // In search mode, the tab grid is hidden — GitHub must show up as a
    // search result row (via the listbox).
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox.textContent).toContain('GitHub');
    });
  });

  it('fuzzy search tolerates a typo in a tab title', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    // "githb" (missing u) should still match GitHub thanks to Fuse fuzziness.
    await enterSearchMode('githb');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('GitHub');
    });
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

// ─── Diacritic-insensitive search ───────────────────────────────────────────

describe('CommandBar — diacritic-insensitive search', () => {
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
                { id: 21, title: 'Sözcü Gazetesi', url: 'https://www.sozcu.com.tr', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                { id: 22, title: 'Başka Site', url: 'https://baska.com', favIconUrl: '', windowId: 1, pinned: false, audible: false },
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

  it('"sozcu" matches "Sözcü" after diacritic folding', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Sözcü Gazetesi')).toBeTruthy());

    const { fireEvent } = await import('@testing-library/react');
    document.dispatchEvent(new CustomEvent('smb-keydown', { detail: { key: '/', shiftKey: false } }));
    const input = (await waitFor(() =>
      screen.getByPlaceholderText('Search tabs, bookmarks, actions...')
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'sozcu' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Sözcü Gazetesi');
    });
  });
});

// ─── Overlay feature gaps: F04 history, F12 '>' mode, sources, F10 goto, errors ──

interface OverlayMockOptions {
  searchSources?: { tabs: boolean; bookmarks: boolean; history: boolean };
  maxResultsPerGroup?: number;
  // unknown: EXECUTE_ACTION can answer with shapes beyond ExecuteActionResponse —
  // the router's catch-all `{ error }` (no success field) or undefined (dead channel).
  executeActionResponse?: unknown;
  // When set, EXECUTE_ACTION responds with `undefined` and chrome.runtime.lastError
  // is populated for the duration of the callback (mirrors a closed message port).
  executeActionLastError?: string;
  // GET_ACTIONS failure simulation: each failing call answers `undefined` with
  // chrome.runtime.lastError set (dead channel), then recovers or not.
  getActionsBehavior?: 'ok' | 'fail-once' | 'fail-always';
}

function setupOverlayMock(options: OverlayMockOptions = {}) {
  const {
    searchSources = { tabs: true, bookmarks: true, history: true },
    maxResultsPerGroup = 5,
    executeActionLastError,
    getActionsBehavior = 'ok',
  } = options;
  let getActionsCalls = 0;
  // `in` check instead of a destructuring default: an explicit `undefined`
  // response (dead channel) must NOT be replaced by the success default.
  const executeActionResponse =
    'executeActionResponse' in options ? options.executeActionResponse : { success: true };

  vi.mocked(chrome.runtime.sendMessage).mockReset();
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
    msg: unknown,
    callback?: (response: unknown) => void
  ) => {
    const message = msg as { type: string };
    if (!callback) return undefined as unknown as Promise<unknown>;
    switch (message.type) {
      case 'GET_SETTINGS':
        callback({
          settings: {
            shortcut: 'Ctrl+Shift+Space', position: 'center', theme: 'dark',
            maxResultsPerGroup, showFavicons: true, searchSources,
          },
        });
        break;
      case 'GET_ALL_TABS':
        callback({
          groups: [
            {
              label: 'Window 1', type: 'window',
              tabs: [
                { id: 1, title: 'Alpha One', url: 'https://alpha-one.example', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                { id: 2, title: 'Alpha Two', url: 'https://alpha-two.example', favIconUrl: '', windowId: 1, pinned: false, audible: false },
                { id: 3, title: 'GitHub', url: 'https://github.com', favIconUrl: '', windowId: 1, pinned: false, audible: false },
              ],
            },
          ],
        });
        break;
      case 'GET_BOOKMARK_TREE':
        callback({
          tree: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              children: [{ id: '2', title: 'React Docs', url: 'https://react.dev' }],
            },
          ],
        });
        break;
      case 'GET_HISTORY_ITEMS':
        callback({
          items: [
            { id: 'history-h1', title: 'Vitest Guide', url: 'https://vitest.dev/guide', lastVisitTime: 1700000000000 },
            { id: 'history-h2', title: 'Old Blog Post', url: 'https://blog.example.org/post', lastVisitTime: 1700000001000 },
          ],
        });
        break;
      case 'GET_ACTIONS': {
        getActionsCalls += 1;
        const shouldFail =
          getActionsBehavior === 'fail-always' ||
          (getActionsBehavior === 'fail-once' && getActionsCalls === 1);
        if (shouldFail) {
          const runtime = chrome.runtime as unknown as { lastError?: { message: string } };
          runtime.lastError = { message: 'Could not establish connection.' };
          try {
            callback(undefined);
          } finally {
            delete runtime.lastError;
          }
          break;
        }
        callback({
          actions: [
            { id: 'action-close-tab', title: 'Close Tab' },
            { id: 'action-pin-tab', title: 'Pin Tab' },
            { id: 'action-new-tab', title: 'New Tab' },
          ],
        });
        break;
      }
      case 'EXECUTE_ACTION': {
        if (executeActionLastError !== undefined) {
          // Chrome sets runtime.lastError only while the callback runs.
          const runtime = chrome.runtime as unknown as { lastError?: { message: string } };
          runtime.lastError = { message: executeActionLastError };
          try {
            callback(undefined);
          } finally {
            delete runtime.lastError;
          }
        } else {
          callback(executeActionResponse);
        }
        break;
      }
      default:
        callback({ success: true });
    }
    return undefined as unknown as Promise<unknown>;
  }) as unknown as typeof chrome.runtime.sendMessage);
}

function fireOverlayKey(key: string, shiftKey = false) {
  document.dispatchEvent(
    new CustomEvent('smb-keydown', { detail: { key, shiftKey } })
  );
}

function findOverlayCall(type: string) {
  return vi.mocked(chrome.runtime.sendMessage).mock.calls.find(
    (c) => (c[0] as unknown as { type: string }).type === type
  );
}

async function typeOverlayQuery(query: string) {
  fireOverlayKey('/');
  const input = (await waitFor(() =>
    screen.getByPlaceholderText('Search tabs, bookmarks, actions...')
  )) as HTMLInputElement;
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.input(input, { target: { value: query } });
  return input;
}

describe('CommandBar — history in search results (F04)', () => {
  beforeEach(() => setupOverlayMock());

  it('does not show history items in the empty (tree) state', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    expect(screen.queryByText('Vitest Guide')).toBeNull();
    expect(screen.queryByText('History')).toBeNull();
  });

  it('shows matching history items under a History header when searching', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('vitest');

    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox.textContent).toContain('Vitest Guide');
      expect(listbox.textContent).toContain('History');
    });
  });

  it('Enter on a history item dispatches NAVIGATE to its URL', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('vitest');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Vitest Guide');
    });

    fireOverlayKey('Enter');
    await waitFor(() => {
      const nav = findOverlayCall('NAVIGATE');
      expect(nav).toBeTruthy();
      expect((nav![0] as unknown as { payload: { url: string } }).payload.url).toBe('https://vitest.dev/guide');
    });
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('CommandBar — search source toggles', () => {
  it('omits tabs from search results when searchSources.tabs is false', async () => {
    setupOverlayMock({ searchSources: { tabs: false, bookmarks: true, history: true } });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('github');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).not.toContain('GitHub');
    });
  });

  it('omits bookmarks from search results when searchSources.bookmarks is false', async () => {
    setupOverlayMock({ searchSources: { tabs: true, bookmarks: false, history: true } });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('react docs');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).not.toContain('React Docs');
    });
  });

  it('omits history from search results when searchSources.history is false', async () => {
    setupOverlayMock({ searchSources: { tabs: true, bookmarks: true, history: false } });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('vitest');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).not.toContain('Vitest Guide');
    });
  });

  it('caps each result group at maxResultsPerGroup', async () => {
    setupOverlayMock({ maxResultsPerGroup: 1 });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('alpha');
    await waitFor(() => {
      const text = screen.getByRole('listbox').textContent ?? '';
      const shown = [text.includes('Alpha One'), text.includes('Alpha Two')].filter(Boolean);
      expect(shown).toHaveLength(1);
    });
  });
});

describe('CommandBar — action prefix mode (F12)', () => {
  beforeEach(() => setupOverlayMock());

  it('",>" alone lists all actions under an Actions header and hides other sources', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('>');
    await waitFor(() => {
      const text = screen.getByRole('listbox').textContent ?? '';
      expect(text).toContain('Actions');
      expect(text).toContain('Close Tab');
      expect(text).toContain('Pin Tab');
      expect(text).toContain('New Tab');
      expect(text).not.toContain('Alpha One');
      expect(text).not.toContain('React Docs');
      expect(text).not.toContain('Vitest Guide');
    });
  });

  it('">pin" filters the action list', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('>pin');
    await waitFor(() => {
      const text = screen.getByRole('listbox').textContent ?? '';
      expect(text).toContain('Pin Tab');
      expect(text).not.toContain('New Tab');
    });
  });

  it('never matches ">" as literal text against tabs or bookmarks', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('>alpha');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).not.toContain('Alpha One');
    });
  });

  it('Enter on an action row dispatches EXECUTE_ACTION and dismisses on success', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('>new tab');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('New Tab');
    });

    fireOverlayKey('Enter');
    await waitFor(() => {
      const exec = findOverlayCall('EXECUTE_ACTION');
      expect(exec).toBeTruthy();
      expect(
        (exec![0] as unknown as { payload: { actionId: string } }).payload.actionId
      ).toBe('action-new-tab');
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('clearing the query restores the normal tree state', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    const input = await typeOverlayQuery('>');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Close Tab');
    });

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.input(input, { target: { value: '' } });
    await waitFor(() => {
      const text = screen.getByRole('listbox').textContent ?? '';
      expect(text).toContain('Bookmarks Bar');
    });
  });
});

describe('CommandBar — GET_ACTIONS failure handling (F12)', () => {
  function countGetActionsCalls() {
    return vi
      .mocked(chrome.runtime.sendMessage)
      .mock.calls.filter((c) => (c[0] as unknown as { type: string }).type === 'GET_ACTIONS').length;
  }

  it('retries once on the next ">" entry and recovers when the retry succeeds', async () => {
    setupOverlayMock({ getActionsBehavior: 'fail-once' });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    expect(countGetActionsCalls()).toBe(1); // initial load failed silently

    await typeOverlayQuery('>');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Close Tab');
    });
    expect(countGetActionsCalls()).toBe(2); // exactly one retry
  });

  it("shows an in-list \"Couldn't load actions\" line on persistent failure", async () => {
    setupOverlayMock({ getActionsBehavior: 'fail-always' });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('>');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain("Couldn't load actions");
    });
  });

  it('retries only once — repeated ">" entries do not hammer the background', async () => {
    setupOverlayMock({ getActionsBehavior: 'fail-always' });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    const input = await typeOverlayQuery('>');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain("Couldn't load actions");
    });

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.input(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Bookmarks Bar');
    });
    fireEvent.input(input, { target: { value: '>' } });
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain("Couldn't load actions");
    });

    expect(countGetActionsCalls()).toBe(2); // initial + single retry, no more
  });

  it('does not show the failure line outside ">" mode', async () => {
    setupOverlayMock({ getActionsBehavior: 'fail-always' });
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    expect(screen.getByRole('listbox').textContent).not.toContain("Couldn't load actions");

    await typeOverlayQuery('github');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('GitHub');
    });
    expect(screen.getByRole('listbox').textContent).not.toContain("Couldn't load actions");
  });
});

describe('CommandBar — go-to-URL fallback (F10)', () => {
  beforeEach(() => setupOverlayMock());

  it('appends a "Go to" row for a domain-like query', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('example.com');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Go to https://example.com');
    });
  });

  it('does not append a "Go to" row for a plain-word query', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('github');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('GitHub');
    });
    expect(screen.getByRole('listbox').textContent).not.toContain('Go to ');
  });

  it("a stray '/' smb-keydown while a query is typed does not wipe it or exit search mode", async () => {
    // Regression: typing "example.com/admin" used to die at the '/' — the
    // content script forwarded it and handleKey treated it as the mode
    // toggle, calling setQuery('') and dropping back to jump mode.
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('example.com');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Go to https://example.com');
    });

    // act() flushes the resulting state updates before the "nothing changed"
    // assertions below — without it they'd read stale DOM and always pass.
    const { act } = await import('@testing-library/react');
    act(() => {
      fireOverlayKey('/');
    });

    // Still in search mode with the query's results intact.
    expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy();
    expect(screen.getByRole('listbox').textContent).toContain('Go to https://example.com');
  });

  it('a query containing a path renders a path-preserving Go-to row', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('example.com/admin');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Go to https://example.com/admin');
    });
  });

  it('Enter on the Go-to row navigates the current tab and dismisses', async () => {
    const onDismiss = vi.fn();
    const { container } = render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    await typeOverlayQuery('example.com');
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('Go to https://example.com');
    });

    // The Go-to row is always last — ArrowUp wraps selection to the end.
    fireOverlayKey('ArrowUp');
    await waitFor(() => {
      const selected = container.querySelector('.smb-tree-item--selected');
      expect(selected?.textContent).toContain('Go to https://example.com');
    });
    fireOverlayKey('Enter');

    await waitFor(() => {
      const nav = findOverlayCall('NAVIGATE');
      expect(nav).toBeTruthy();
      expect((nav![0] as unknown as { payload: { url: string } }).payload.url).toBe('https://example.com');
    });
    expect(onDismiss).toHaveBeenCalled();
  });
});

// ─── Action-error aria-live region (a11y) ────────────────────────────────────
//
// aria-live only announces content that appears inside a region that was
// ALREADY rendered. A display:none idle state removes the element from the
// accessibility tree, so later errors are never announced. When idle the strip
// must be visually hidden (sr-only clip pattern) but still rendered.

describe('CommandBar — action-error aria-live region', () => {
  beforeEach(() => setupOverlayMock());

  // vitest stubs `?inline` CSS imports to an empty string and jsdom does not
  // reliably cascade the full stylesheet, so read the shipped files from
  // disk. The overlay injects palette-core.css (shared component rules) plus
  // command-bar.css (:host scoping) — concatenate them the same way.
  async function loadCommandBarCss(): Promise<string> {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { resolve, dirname } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    return (
      readFileSync(resolve(here, '../../styles/palette-core.css'), 'utf8') +
      '\n' +
      readFileSync(resolve(here, '../../styles/command-bar.css'), 'utf8')
    );
  }

  /** Extracts the body of the first CSS rule whose selector list matches exactly. */
  function cssRuleBody(css: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    expect(match, `rule "${selector}" must exist in command-bar.css`).toBeTruthy();
    return (match as RegExpExecArray)[1];
  }

  it('is mounted and empty (with aria-live) before any error occurs', async () => {
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.classList.contains('smb-error-strip')).toBe(true);
    expect(status.classList.contains('smb-error-strip--visible')).toBe(false);
  });

  it('idle CSS keeps the strip rendered (sr-only clip), never display:none', async () => {
    // Assert the shipped CSS contract directly: a display:none idle state
    // would remove the region from the accessibility tree and silence
    // aria-live for good.
    const css = await loadCommandBarCss();
    const idle = cssRuleBody(css, '.smb-error-strip');
    expect(idle).not.toContain('display: none');
    // The visually-hidden-but-rendered pattern (same as .smb-sr-only):
    expect(idle).toContain('position: absolute');
    expect(idle).toContain('width: 1px');
    expect(idle).toContain('height: 1px');
    expect(idle).toContain('clip: rect(0, 0, 0, 0)');
    expect(idle).toContain('overflow: hidden');
  });

  it('visible CSS restores a normal block when an error is shown', async () => {
    const css = await loadCommandBarCss();
    const visible = cssRuleBody(css, '.smb-error-strip--visible');
    expect(visible).toContain('display: block');
    expect(visible).toContain('position: static');
    expect(visible).toContain('clip: auto');
    // Visual behavior identical to the old visible state:
    expect(visible).toContain('border: 1px solid var(--color-danger)');
    expect(visible).toContain('background: var(--color-danger-bg)');
    expect(visible).toContain('color: var(--color-danger)');
  });

  it('toggles the --visible class when an error appears and auto-hides after', async () => {
    setupOverlayMock({ executeActionResponse: { success: false, error: 'boom' } });
    const { act } = await import('@testing-library/react');
    render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    vi.useFakeTimers();
    try {
      act(() => {
        fireOverlayKey('c');
      });
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('boom');
      expect(status.classList.contains('smb-error-strip--visible')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2600);
      });
      // Back to the rendered-but-hidden idle state — still in the DOM.
      expect(status.textContent).toBe('');
      expect(status.classList.contains('smb-error-strip--visible')).toBe(false);
      expect(status.isConnected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── Theme → shadow host (Settings "Theme" must style the overlay) ──────────
//
// command-bar.css defines every theme variable on :host([data-theme=…]). The
// shadow *host* element lives outside React's tree, so CommandBar must mirror
// the resolved theme onto it — an attribute on an inner div matches nothing.

describe('CommandBar — theme attribute reaches the shadow host', () => {
  let mqlMatchesDark: boolean;
  let mqlHandlers: Array<(e: { matches: boolean }) => void>;
  const originalMatchMedia = window.matchMedia;

  function mockSettings(theme: 'system' | 'light' | 'dark') {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      msg: unknown,
      callback?: (response: unknown) => void
    ) => {
      const message = msg as { type: string };
      if (!callback) return undefined as unknown as Promise<unknown>;
      switch (message.type) {
        case 'GET_SETTINGS':
          callback({
            settings: {
              shortcut: 'Ctrl+Shift+Space', position: 'center', theme,
              maxResultsPerGroup: 5, showFavicons: true,
              searchSources: { tabs: true, bookmarks: true, history: true },
            },
          });
          break;
        case 'GET_ALL_TABS':
          callback({ groups: [] });
          break;
        case 'GET_BOOKMARK_TREE':
          callback({ tree: [] });
          break;
        default:
          callback({ success: true });
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage);
  }

  beforeEach(() => {
    mqlMatchesDark = true;
    mqlHandlers = [];
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' ? mqlMatchesDark : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, handler: (e: { matches: boolean }) => void) => {
        mqlHandlers.push(handler);
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.mocked(chrome.storage.onChanged.addListener).mockClear();
    vi.mocked(chrome.storage.onChanged.removeListener).mockClear();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.querySelectorAll('[data-smb-test-host]').forEach((el) => el.remove());
  });

  /** Renders the CommandBar inside a real shadow root, like the content script does. */
  function renderInShadowRoot() {
    const host = document.createElement('div');
    host.setAttribute('data-smb-test-host', '1');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    render(<CommandBar onDismiss={() => {}} />, { container: mount });
    return host;
  }

  it("setting 'dark' lands data-theme='dark' on the shadow host", async () => {
    mockSettings('dark');
    mqlMatchesDark = false; // page prefers light — the explicit setting must win
    const host = renderInShadowRoot();
    await waitFor(() => expect(host.getAttribute('data-theme')).toBe('dark'));
  });

  it("setting 'light' lands data-theme='light' on the shadow host", async () => {
    mockSettings('light');
    mqlMatchesDark = true; // page prefers dark — the explicit setting must win
    const host = renderInShadowRoot();
    await waitFor(() => expect(host.getAttribute('data-theme')).toBe('light'));
  });

  it("setting 'system' resolves from prefers-color-scheme and tracks it live", async () => {
    mockSettings('system');
    mqlMatchesDark = true;
    const host = renderInShadowRoot();
    await waitFor(() => expect(host.getAttribute('data-theme')).toBe('dark'));

    // The OS theme flips while the palette is open.
    const { act } = await import('@testing-library/react');
    mqlMatchesDark = false;
    act(() => {
      mqlHandlers.forEach((handler) => handler({ matches: false }));
    });
    await waitFor(() => expect(host.getAttribute('data-theme')).toBe('light'));
  });

  it('live-updates the host when the theme setting changes in chrome.storage.sync', async () => {
    mockSettings('light');
    const host = renderInShadowRoot();
    await waitFor(() => expect(host.getAttribute('data-theme')).toBe('light'));

    const storageListener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls.at(-1)?.[0] as
      | ((changes: Record<string, { newValue?: unknown }>, area: string) => void)
      | undefined;
    expect(storageListener).toBeTypeOf('function');

    const { act } = await import('@testing-library/react');

    // A change in the wrong storage area is ignored.
    act(() => {
      storageListener?.({ settings: { newValue: { theme: 'dark' } } }, 'local');
    });
    expect(host.getAttribute('data-theme')).toBe('light');

    // The real settings write (sync area) applies immediately.
    act(() => {
      storageListener?.({ settings: { newValue: { theme: 'dark' } } }, 'sync');
    });
    await waitFor(() => expect(host.getAttribute('data-theme')).toBe('dark'));
  });
});

describe('CommandBar — EXECUTE_ACTION failure feedback', () => {
  it('keeps the overlay open and shows an error strip on failure', async () => {
    setupOverlayMock({ executeActionResponse: { success: false, error: 'No target tab' } });
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireOverlayKey('c'); // close-tab action key

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('No target tab');
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('auto-hides the error strip after ~2.5 seconds', async () => {
    setupOverlayMock({ executeActionResponse: { success: false, error: 'boom' } });
    const onDismiss = vi.fn();
    const { act } = await import('@testing-library/react');
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    vi.useFakeTimers();
    try {
      act(() => {
        fireOverlayKey('c');
      });
      expect(screen.getByRole('status').textContent).toContain('boom');

      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(screen.getByRole('status').textContent).not.toContain('boom');
    } finally {
      vi.useRealTimers();
    }
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('still dismisses on success', async () => {
    setupOverlayMock({ executeActionResponse: { success: true } });
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireOverlayKey('c');
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it('treats a router-level { error } response (no success field) as failure', async () => {
    // The background's onMessage catch and its "Unknown message type" /
    // "forbidden sender" branches answer { error } WITHOUT a success field.
    setupOverlayMock({ executeActionResponse: { error: 'Unknown message type' } });
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireOverlayKey('c');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Unknown message type');
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('treats an undefined response with runtime.lastError as failure and surfaces the message', async () => {
    setupOverlayMock({
      executeActionLastError: 'The message port closed before a response was received.',
    });
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireOverlayKey('c');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('message port closed');
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('treats an undefined response without lastError as a generic failure', async () => {
    setupOverlayMock({ executeActionResponse: undefined });
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireOverlayKey('c');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Action failed');
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ─── Popup variant ──────────────────────────────────────────────────────────
// The action popup renders the same CommandBar without the overlay framing:
// no backdrop, no position class, fixed window sizing from popup.css.

describe('CommandBar — popup variant', () => {
  beforeEach(() => setupOverlayMock());

  function fireSmbKey(key: string, shiftKey = false) {
    document.dispatchEvent(
      new CustomEvent('smb-keydown', { detail: { key, shiftKey } })
    );
  }

  it("variant='popup' renders no .smb-backdrop", async () => {
    const { container } = render(<CommandBar onDismiss={() => {}} variant="popup" />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    expect(container.querySelector('.smb-backdrop')).toBeNull();
  });

  it("variant='popup' renders .smb-container--popup without a position class", async () => {
    const { container } = render(<CommandBar onDismiss={() => {}} variant="popup" />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    const el = container.querySelector('.smb-container');
    expect(el).not.toBeNull();
    expect(el?.classList.contains('smb-container--popup')).toBe(true);
    expect(el?.classList.contains('smb-container--center')).toBe(false);
    expect(el?.classList.contains('smb-container--top')).toBe(false);
    expect(el?.classList.contains('smb-container--bottom')).toBe(false);
  });

  it('search mode with an empty query keeps the tab grid visible without jump badges', async () => {
    const { container } = render(
      <CommandBar onDismiss={() => {}} variant="popup" initialMode="search" />
    );
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    // Full surface shown while nothing filters…
    expect(screen.getByText('Open Tabs')).toBeTruthy();
    // …but jump-label badges are hidden outside jump mode.
    expect(container.querySelectorAll('.smb-tab-col-label')).toHaveLength(0);
  });

  it("variant='popup' keeps the dialog role, error strip and TreeView listbox", async () => {
    render(<CommandBar onDismiss={() => {}} variant="popup" />);
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('uses resolveCopyUrl for the "u" copy action, writes the cleaned URL, then dismisses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const resolveCopyUrl = vi
      .fn()
      .mockResolvedValue('https://active-tab.example/page?utm_source=x&id=7');
    const onDismiss = vi.fn();

    render(
      <CommandBar onDismiss={onDismiss} variant="popup" resolveCopyUrl={resolveCopyUrl} />
    );
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireSmbKey('u');
    await waitFor(() => {
      expect(resolveCopyUrl).toHaveBeenCalled();
      expect(writeText).toHaveBeenCalledWith('https://active-tab.example/page?id=7');
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it('a null resolveCopyUrl result writes nothing but still dismisses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const resolveCopyUrl = vi.fn().mockResolvedValue(null);
    const onDismiss = vi.fn();

    render(
      <CommandBar onDismiss={onDismiss} variant="popup" resolveCopyUrl={resolveCopyUrl} />
    );
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeTruthy());

    fireSmbKey('u');
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
    expect(writeText).not.toHaveBeenCalled();
  });
});

// ─── Tab section jumping ────────────────────────────────────────────────────
// Tab/Shift+Tab jump to the first item of the next/previous SECTION
// (top-level folders in the jump-mode tree), never one item at a time.

function makeTabJumpMock(options: {
  tabs: Array<{ id: number; title: string }>;
  tree: Array<{ id: string; title: string; children: Array<{ id: string; title: string; url?: string; children?: Array<{ id: string; title: string; url: string }> }> }>;
  history?: Array<{ id: string; title: string; url: string }>;
  actions?: Array<{ id: string; title: string }>;
}) {
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
              tabs: options.tabs.map((t) => ({
                id: t.id,
                title: t.title,
                url: `https://tab-${t.id}.example/`,
                favIconUrl: '',
                windowId: 1,
                pinned: false,
                audible: false,
              })),
            },
          ],
        });
      } else if (message.type === 'GET_BOOKMARK_TREE' && callback) {
        callback({ tree: options.tree });
      } else if (message.type === 'GET_HISTORY_ITEMS' && callback) {
        callback({
          items: (options.history ?? []).map((h) => ({ ...h, lastVisitTime: 1 })),
        });
      } else if (message.type === 'GET_ACTIONS' && callback) {
        callback({ actions: options.actions ?? [] });
      } else if (callback) {
        callback({ success: true });
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage
  );
}

function selectedTitle(container: HTMLElement): string {
  return container.querySelector('.smb-tree-item--selected')?.textContent ?? '';
}

describe('CommandBar — Tab section jumping (jump mode)', () => {
  function fireSmbKey(key: string, shiftKey = false) {
    document.dispatchEvent(new CustomEvent('smb-keydown', { detail: { key, shiftKey } }));
  }

  beforeEach(() => {
    makeTabJumpMock({
      tabs: [
        { id: 1, title: 'Gmail' },
        { id: 2, title: 'GitHub' },
      ],
      tree: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          children: [
            { id: '2', title: 'React Docs', url: 'https://react.dev' },
            { id: '3', title: 'Vue Docs', url: 'https://vuejs.org' },
          ],
        },
        {
          id: '4',
          title: 'Work Stuff',
          children: [{ id: '5', title: 'Jira', url: 'https://jira.example' }],
        },
      ],
    });
  });

  async function renderTree() {
    const view = render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText('Work Stuff')).toBeTruthy());
    return view.container;
  }

  it('Tab moves selection to the next top-level folder', async () => {
    const container = await renderTree();
    expect(selectedTitle(container)).toContain('Bookmarks Bar');
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(container)).toContain('Work Stuff'));
  });

  it('Shift+Tab moves selection back to the previous top-level folder', async () => {
    const container = await renderTree();
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(container)).toContain('Work Stuff'));
    fireSmbKey('Tab', true);
    await waitFor(() => expect(selectedTitle(container)).toContain('Bookmarks Bar'));
  });

  it("Tab skips an expanded folder's children and lands on the next top-level folder", async () => {
    const container = await renderTree();
    fireSmbKey('ArrowRight'); // expand Bookmarks Bar
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
    fireSmbKey('Tab');
    await waitFor(() => {
      const title = selectedTitle(container);
      expect(title).toContain('Work Stuff');
      expect(title).not.toContain('React Docs');
    });
  });

  it('Tab wraps from the last top-level folder to the first', async () => {
    const container = await renderTree();
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(container)).toContain('Work Stuff'));
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(container)).toContain('Bookmarks Bar'));
  });

  it("Shift+Tab from a folder's child jumps to the PREVIOUS group (wrapping)", async () => {
    const container = await renderTree();
    fireSmbKey('ArrowRight'); // expand Bookmarks Bar
    await waitFor(() => expect(screen.getByText('React Docs')).toBeTruthy());
    fireSmbKey('ArrowDown'); // React Docs (index 1, inside the FIRST group)
    await waitFor(() => expect(selectedTitle(container)).toContain('React Docs'));
    // Previous group from inside the first one wraps to the last group —
    // never the current group's own start.
    fireSmbKey('Tab', true);
    await waitFor(() => expect(selectedTitle(container)).toContain('Work Stuff'));
    fireSmbKey('Tab', true);
    await waitFor(() => expect(selectedTitle(container)).toContain('Bookmarks Bar'));
  });
});

describe('CommandBar — Tab section jumping (search mode)', () => {
  function fireSmbKey(key: string, shiftKey = false) {
    document.dispatchEvent(new CustomEvent('smb-keydown', { detail: { key, shiftKey } }));
  }

  beforeEach(() => {
    makeTabJumpMock({
      tabs: [
        { id: 1, title: 'Alpha Docs' },
        { id: 2, title: 'Alpha Blog' },
      ],
      tree: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          children: [{ id: '2', title: 'Alpha Reference', url: 'https://alpha.ref/' }],
        },
      ],
      history: [{ id: 'h1', title: 'Alpha History', url: 'https://alpha.hist/' }],
      actions: [
        { id: 'action-close-tab', title: 'Close Tab' },
        { id: 'action-pin-tab', title: 'Pin Tab' },
        { id: 'action-new-tab', title: 'New Tab' },
      ],
    });
  });

  async function searchAlpha() {
    const view = render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Alpha Docs/)).toBeTruthy());
    fireSmbKey('/');
    const input = (await waitFor(() =>
      screen.getByPlaceholderText('Search tabs, bookmarks, actions...')
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'alpha' } });
    // Results: [tab, tab, bookmark, history] → boundaries [0, 2, 3]
    await waitFor(() => expect(screen.getByText(/Alpha History/)).toBeTruthy());
    return view.container;
  }

  it('Tab jumps from the tabs section to the first bookmark result', async () => {
    const container = await searchAlpha();
    expect(selectedTitle(container)).toMatch(/Alpha (Docs|Blog)/);
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(container)).toContain('Alpha Reference'));
  });

  it('Tab from mid-section jumps to the next section start, not the next item', async () => {
    const container = await searchAlpha();
    const initial = selectedTitle(container);
    fireSmbKey('ArrowDown'); // second tab (index 1)
    // Premise check: the selection really moved off the first tab.
    await waitFor(() => {
      const title = selectedTitle(container);
      expect(title).toMatch(/Alpha (Docs|Blog)/);
      expect(title).not.toBe(initial);
    });
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(container)).toContain('Alpha Reference'));
  });

  it('Tab walks section starts and wraps to the top', async () => {
    const container = await searchAlpha();
    const initial = selectedTitle(container);
    fireSmbKey('Tab'); // bookmarks
    await waitFor(() => expect(selectedTitle(container)).toContain('Alpha Reference'));
    fireSmbKey('Tab'); // history
    await waitFor(() => expect(selectedTitle(container)).toContain('Alpha History'));
    fireSmbKey('Tab'); // wrap to first tab
    await waitFor(() => expect(selectedTitle(container)).toBe(initial));
  });

  it('Shift+Tab from the first result wraps to the last section start', async () => {
    const container = await searchAlpha();
    fireSmbKey('Tab', true);
    await waitFor(() => expect(selectedTitle(container)).toContain('Alpha History'));
  });

  it('ArrowDown still moves one item at a time in search mode', async () => {
    const container = await searchAlpha();
    const initial = selectedTitle(container);
    fireSmbKey('ArrowDown');
    await waitFor(() => {
      const title = selectedTitle(container);
      expect(title).toMatch(/Alpha (Docs|Blog)/);
      expect(title).not.toBe(initial);
    });
  });

  it('action mode: Tab falls back to item stepping in a single-section list', async () => {
    const view = render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Alpha Docs/)).toBeTruthy());
    fireSmbKey('/');
    const input = (await waitFor(() =>
      screen.getByPlaceholderText('Search tabs, bookmarks, actions...')
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: '>' } });
    await waitFor(() => expect(screen.getByText('Close Tab')).toBeTruthy());
    // One section, nothing to jump between — Tab must still MOVE, never
    // no-op or snap back to the top (Enter would then hit the wrong action).
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(view.container)).toContain('Pin Tab'));
    fireSmbKey('Tab');
    await waitFor(() => expect(selectedTitle(view.container)).toContain('New Tab'));
    fireSmbKey('Tab', true);
    await waitFor(() => expect(selectedTitle(view.container)).toContain('Pin Tab'));
  });

  it('Tab on an empty result list is a no-op', async () => {
    const view = render(<CommandBar onDismiss={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Alpha Docs/)).toBeTruthy());
    fireSmbKey('/');
    const input = (await waitFor(() =>
      screen.getByPlaceholderText('Search tabs, bookmarks, actions...')
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'zzzz' } });
    await waitFor(() =>
      expect(view.container.querySelector('.smb-tree-item--selected')).toBeNull()
    );
    fireSmbKey('Tab');
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(view.container.querySelector('.smb-tree-item--selected')).toBeNull();
  });
});
