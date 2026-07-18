// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popup } from '../../entrypoints/popup/Popup';
import { mockRawDataMessages, findSentMessage as findCall } from '../helpers/mock-palette-messages';

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

  it('renders the same jump-first palette surface as the overlay', async () => {
    const { container } = render(<Popup />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
    expect(screen.getByText('Open Tabs')).toBeTruthy();
    expect(screen.getByText('Bookmarks Bar')).toBeTruthy();
    const input = screen.getByPlaceholderText('Press / to search') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    // Jump shortcut labels are visible for tabs AND bookmark tree rows —
    // identical to the in-page overlay, per explicit user requirement.
    expect(container.querySelectorAll('.smb-tab-col-label').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.smb-tree-item .smb-label-badge').length).toBeGreaterThan(0);
  });

  it('a digit key on entry switches to a pinned tab', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    mockRawDataMessages({ withPinnedTab: true });
    render(<Popup />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
    fireEvent.keyDown(document, { key: '1' });
    await waitFor(() => {
      const call = findCall('SWITCH_TAB');
      expect(call).toBeTruthy();
      expect((call?.[0] as unknown as { payload: { tabId: number } }).payload.tabId).toBe(9);
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('a jump label key on entry switches to the labeled tab', async () => {
    await renderPopup();
    // 'a' labels allTabs[0] (Gmail, tabId 1) — same label pool as overlay.
    fireEvent.keyDown(document, { key: 'a' });
    await waitFor(() => {
      const call = findCall('SWITCH_TAB');
      expect(call).toBeTruthy();
      expect((call?.[0] as unknown as { payload: { tabId: number } }).payload.tabId).toBe(1);
      expect(mockClose).toHaveBeenCalled();
    });
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

  it("native '/' keydown enters search mode and toggles back", async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search tabs, bookmarks, actions...')).toBeTruthy();
    });
    fireEvent.keyDown(document, { key: '/' });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Press / to search')).toBeTruthy();
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

  it('Backspace on entry does not close the popup (strict overlay parity)', async () => {
    await renderPopup();
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(mockClose).not.toHaveBeenCalled();
    expect(screen.getByText('Gmail')).toBeTruthy();
  });

  it('Backspace with a typed query and stray focus neither closes nor refocuses', async () => {
    // The old popup refocused the input here; strict parity drops the whole
    // popup-only Backspace branch — the key is forwarded and ignored, same
    // as the overlay.
    await renderPopup();
    fireEvent.keyDown(document, { key: '/' });
    const input = (await screen.findByPlaceholderText(
      'Search tabs, bookmarks, actions...'
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'github' } });
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(mockClose).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
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
