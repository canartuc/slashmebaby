// Shared chrome.tabs.Tab factory — the single source for tab fixtures
// across background/hook/perf tests. Superset of the per-file copies it
// replaced. lastAccessed is deterministic; tests that exercise recency
// ordering pass explicit values.
export function makeFakeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: true,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    groupId: -1,
    title: 'Test Tab',
    url: 'https://example.com',
    lastAccessed: 1700000000000,
    mutedInfo: { muted: false },
    ...overrides,
  };
}
