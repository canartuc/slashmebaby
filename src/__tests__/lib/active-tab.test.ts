import { describe, it, expect, vi, afterEach } from 'vitest';
import { getActiveTabUrl } from '../../lib/active-tab';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubTabsQuery(impl: () => Promise<chrome.tabs.Tab[]>) {
  vi.stubGlobal('chrome', {
    tabs: { query: vi.fn(impl) },
  });
}

describe('getActiveTabUrl', () => {
  it("resolves the active tab's URL in the current window", async () => {
    stubTabsQuery(() =>
      Promise.resolve([{ id: 1, url: 'https://example.com/page' } as chrome.tabs.Tab])
    );
    await expect(getActiveTabUrl()).resolves.toBe('https://example.com/page');
    expect(
      (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    ).toEqual({ active: true, currentWindow: true });
  });

  it('resolves null when there is no active tab', async () => {
    stubTabsQuery(() => Promise.resolve([]));
    await expect(getActiveTabUrl()).resolves.toBeNull();
  });

  it('resolves null when the active tab has no url', async () => {
    stubTabsQuery(() => Promise.resolve([{ id: 1 } as chrome.tabs.Tab]));
    await expect(getActiveTabUrl()).resolves.toBeNull();
  });

  it('resolves null when the query rejects', async () => {
    stubTabsQuery(() => Promise.reject(new Error('no permission')));
    await expect(getActiveTabUrl()).resolves.toBeNull();
  });
});
