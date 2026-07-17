// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popup } from '../../entrypoints/popup/Popup';

// The popup renders the same CommandBar palette as the in-page overlay
// (variant="popup"): raw-data messages, client-side search, jump mode.

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

function findCall(type: string) {
  return vi.mocked(chrome.runtime.sendMessage).mock.calls.find(
    (c) => (c[0] as unknown as { type: string }).type === type
  );
}

function mockRawDataMessages(options: { executeActionResponse?: unknown } = {}) {
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
      } else if (message.type === 'GET_HISTORY_ITEMS' && callback) {
        callback({ items: [] });
      } else if (message.type === 'GET_ACTIONS' && callback) {
        callback({ actions: [{ id: 'action-close-tab', title: 'Close Tab' }] });
      } else if (message.type === 'EXECUTE_ACTION' && callback) {
        callback(options.executeActionResponse ?? { success: true });
      } else if (
        (message.type === 'SWITCH_TAB' ||
          message.type === 'NAVIGATE' ||
          message.type === 'OPEN_NEW_TAB') &&
        callback
      ) {
        callback({ success: true });
      }
      return undefined as unknown as Promise<unknown>;
    }) as unknown as typeof chrome.runtime.sendMessage
  );
}

async function renderPopup() {
  render(<Popup />);
  await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
}

describe('Popup', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    mockClose.mockReset();
    mockRawDataMessages();
  });

  it('renders the palette surface: open tabs grid, bookmarks, jump placeholder', async () => {
    await renderPopup();
    expect(screen.getByText('Open Tabs')).toBeTruthy();
    expect(screen.getByText('Bookmarks Bar')).toBeTruthy();
    const input = screen.getByPlaceholderText('Press / to search') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('has no backdrop and uses the popup container variant', async () => {
    const { container } = render(<Popup />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
    expect(container.querySelector('.smb-backdrop')).toBeNull();
    const el = container.querySelector('.smb-container');
    expect(el?.classList.contains('smb-container--popup')).toBe(true);
  });

  it('renders results in a listbox', async () => {
    await renderPopup();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it("native '/' keydown toggles search mode", async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy();
    });
  });

  it('filters client-side and never sends SEARCH or SMART_SUGGESTIONS', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    const input = await screen.findByPlaceholderText('Search tabs, bookmarks, actions...');
    fireEvent.input(input, { target: { value: 'github' } });
    await waitFor(() => {
      expect(screen.getByRole('listbox').textContent).toContain('GitHub');
    });
    expect(findCall('SEARCH')).toBeUndefined();
    expect(findCall('SMART_SUGGESTIONS')).toBeUndefined();
  });

  it('clicking a tab in the grid sends SWITCH_TAB and closes the window', async () => {
    await renderPopup();
    fireEvent.click(screen.getByText('Gmail'));
    await waitFor(() => {
      const call = findCall('SWITCH_TAB');
      expect(call).toBeTruthy();
      expect((call?.[0] as unknown as { payload: { tabId: number } }).payload.tabId).toBe(1);
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('an action key sends EXECUTE_ACTION and closes on success', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: 'c' });
    await waitFor(() => {
      expect(findCall('EXECUTE_ACTION')).toBeTruthy();
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('a failed action shows the error strip and keeps the window open', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    mockRawDataMessages({ executeActionResponse: { success: false, error: 'boom' } });
    await renderPopup();
    fireEvent.keyDown(document, { key: 'c' });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('boom');
    });
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('Escape closes the popup window', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockClose).toHaveBeenCalled();
  });

  it('Backspace in jump mode closes the popup', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(mockClose).toHaveBeenCalled();
  });

  it('Backspace while typing in the search input does not close', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    const input = (await screen.findByPlaceholderText(
      'Search tabs, bookmarks, actions...'
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'abc' } });
    input.focus();
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('Backspace on an empty search query closes the popup', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    const input = (await screen.findByPlaceholderText(
      'Search tabs, bookmarks, actions...'
    )) as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(mockClose).toHaveBeenCalled();
  });

  it('"u" copies the ACTIVE tab url (not the popup url) and closes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.mocked(chrome.tabs.query).mockImplementation(((/* queryInfo */) =>
      Promise.resolve([
        { id: 5, url: 'https://active.example/p?utm_source=t&x=1' } as chrome.tabs.Tab,
      ])) as unknown as typeof chrome.tabs.query);

    await renderPopup();
    fireEvent.keyDown(document, { key: 'u' });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://active.example/p?x=1');
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('Enter with no matching results neither acts nor closes', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    const input = await screen.findByPlaceholderText('Search tabs, bookmarks, actions...');
    fireEvent.input(input, { target: { value: 'zzz-no-match-zzz' } });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(findCall('SWITCH_TAB')).toBeUndefined();
    expect(findCall('NAVIGATE')).toBeUndefined();
    expect(mockClose).not.toHaveBeenCalled();
  });
});
