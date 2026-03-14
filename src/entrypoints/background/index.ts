import { TabCache } from './tabs';
import { BookmarkCache } from './bookmarks';
import { HistoryCache } from './history';
import { ActionRegistry } from './actions';
import { createSearchEngine } from '../../lib/search';
import { getSettings } from '../../lib/storage';
import {
  isSearchRequest,
  isSmartSuggestionsRequest,
  isExecuteActionRequest,
  isGetSettingsRequest,
  isGetAllTabsRequest,
  isGetBookmarkTreeRequest,
} from '../../lib/messaging';
import type { TabWithGroup, TabGroupInfo, BookmarkNode } from '../../lib/messaging';
import type { SearchableItem } from '../../lib/search';

// ─── Message Router Factory ───────────────────────────────────────────────

export async function createMessageRouter() {
  const tabCache = new TabCache();
  const bookmarkCache = new BookmarkCache();
  const historyCache = new HistoryCache();
  const actionRegistry = new ActionRegistry();

  // Load initial data
  await Promise.all([
    tabCache.refresh(),
    bookmarkCache.refresh(),
    historyCache.refresh(),
  ]);

  // Set up change listeners — refresh caches on browser events
  tabCache.setupListeners(() => {
    // Tab cache updated
  });
  bookmarkCache.setupListeners(() => {
    // Bookmark cache updated
  });

  // Periodic history refresh (default 5 min)
  historyCache.startPeriodicRefresh();

  // ─── Message Handler ────────────────────────────────────────────────────

  return async function router(message: unknown): Promise<unknown> {
    if (isSearchRequest(message)) {
      const { query, sources } = message.payload;

      const items: SearchableItem[] = [];

      // Collect items from each requested source
      if (sources.includes('tabs')) {
        items.push(...tabCache.getItems());
      }
      if (sources.includes('bookmarks')) {
        items.push(...bookmarkCache.getItems());
      }
      if (sources.includes('history')) {
        items.push(...historyCache.getItems());
      }

      // Actions are always included
      items.push(...actionRegistry.getItems());

      const settings = await getSettings();
      const engine = createSearchEngine(items, {
        maxResultsPerGroup: settings.maxResultsPerGroup,
      });

      return { groups: engine.search(query) };
    }

    if (isSmartSuggestionsRequest(message)) {
      // Smart suggestions: 3 recent tabs + 2 bookmarks + 2 actions
      const tabItems = tabCache.getItems();
      const bookmarkItems = bookmarkCache.getItems();
      const actionItems = actionRegistry.getItems();

      // Sort tabs by recency (most recent first) and take top 3
      const recentTabs = [...tabItems]
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, 3);

      // Take first 2 bookmarks
      const topBookmarks = bookmarkItems.slice(0, 2);

      // Take first 2 actions
      const topActions = actionItems.slice(0, 2);

      const groups = [];

      if (recentTabs.length > 0) {
        groups.push({
          category: 'tabs' as const,
          items: recentTabs.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            icon: item.icon,
            score: 1,
          })),
        });
      }

      if (topBookmarks.length > 0) {
        groups.push({
          category: 'bookmarks' as const,
          items: topBookmarks.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            icon: item.icon,
            score: 1,
          })),
        });
      }

      if (topActions.length > 0) {
        groups.push({
          category: 'actions' as const,
          items: topActions.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            icon: item.icon,
            score: 1,
          })),
        });
      }

      return { groups };
    }

    // Switch to an existing tab
    const msg = message as Record<string, unknown>;
    if (msg.type === 'SWITCH_TAB') {
      const payload = msg.payload as { tabId: number };
      try {
        await chrome.tabs.update(payload.tabId, { active: true });
        const tab = await chrome.tabs.get(payload.tabId);
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }

    // Open URL in a new tab
    if (msg.type === 'OPEN_NEW_TAB') {
      const payload = msg.payload as { url: string };
      try {
        await chrome.tabs.create({ url: payload.url });
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }

    // Navigate current tab to a URL
    if (msg.type === 'NAVIGATE') {
      const payload = msg.payload as { url: string };
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          await chrome.tabs.update(activeTab.id, { url: payload.url });
        } else {
          await chrome.tabs.create({ url: payload.url });
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }

    if (isExecuteActionRequest(message)) {
      const { actionId, targetTabId } = message.payload;
      const bareActionId = actionId.startsWith('action-')
        ? actionId.slice('action-'.length)
        : actionId;

      // If no targetTabId provided, use the active tab
      let resolvedTabId = targetTabId;
      if (resolvedTabId === undefined) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        resolvedTabId = activeTab?.id;
      }

      return await actionRegistry.execute(bareActionId, resolvedTabId);
    }

    if (isGetSettingsRequest(message)) {
      const settings = await getSettings();
      return { settings };
    }

    if (isGetAllTabsRequest(message)) {
      const allTabs = await chrome.tabs.query({});
      const allWindows = await chrome.windows.getAll();

      // Try to get tab groups (Chrome only, fails on Firefox)
      let chromeTabGroups: chrome.tabGroups.TabGroup[] = [];
      try {
        if (chrome.tabGroups) {
          chromeTabGroups = await chrome.tabGroups.query({});
        }
      } catch { /* Firefox doesn't support tabGroups */ }

      const hasTabGroups = chromeTabGroups.length > 0;
      const hasMultipleWindows = allWindows.length > 1;

      const groups: TabGroupInfo[] = [];

      if (hasTabGroups) {
        // Group by window, then by tab group within each window
        for (const win of allWindows) {
          const windowTabs = allTabs.filter(t => t.windowId === win.id);
          if (windowTabs.length === 0) continue;

          const windowLabel = hasMultipleWindows ? `Window ${allWindows.indexOf(win) + 1}` : undefined;

          // Group tabs by their groupId
          const grouped = new Map<number, chrome.tabs.Tab[]>();
          const ungrouped: chrome.tabs.Tab[] = [];

          for (const tab of windowTabs) {
            if (tab.groupId && tab.groupId !== -1) {
              if (!grouped.has(tab.groupId)) grouped.set(tab.groupId, []);
              grouped.get(tab.groupId)!.push(tab);
            } else {
              ungrouped.push(tab);
            }
          }

          // Add tab group sections
          for (const [groupId, tabs] of grouped) {
            const groupInfo = chromeTabGroups.find(g => g.id === groupId);
            groups.push({
              label: groupInfo?.title || `Group ${groupId}`,
              type: 'tabGroup',
              tabs: tabs.map(mapTab),
            });
          }

          // Add ungrouped
          if (ungrouped.length > 0) {
            groups.push({
              label: windowLabel ? `${windowLabel} — Ungrouped` : 'Ungrouped',
              type: 'window',
              tabs: ungrouped.map(mapTab),
            });
          }
        }
      } else if (hasMultipleWindows) {
        // Group by window
        for (let i = 0; i < allWindows.length; i++) {
          const win = allWindows[i];
          const windowTabs = allTabs.filter(t => t.windowId === win.id);
          if (windowTabs.length === 0) continue;
          groups.push({
            label: `Window ${i + 1}`,
            type: 'window',
            tabs: windowTabs.map(mapTab),
          });
        }
      } else {
        // Flat list
        if (allTabs.length > 0) {
          groups.push({
            label: 'Open Tabs',
            type: 'window',
            tabs: allTabs.map(mapTab),
          });
        }
      }

      return { groups };
    }

    if (isGetBookmarkTreeRequest(message)) {
      const rawTree = await chrome.bookmarks.getTree();

      function convertNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
        const result: BookmarkNode = {
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
        };
        if (node.children) {
          result.children = node.children.map(convertNode);
        }
        return result;
      }

      // The root node has children that are the top-level folders
      const rootChildren = rawTree[0]?.children || [];
      // Filter out empty root folders (like Mobile Bookmarks)
      const tree = rootChildren
        .map(convertNode)
        .filter(node => node.children && node.children.length > 0);

      return { tree };
    }

    return { error: 'Unknown message type' };
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────

function mapTab(tab: chrome.tabs.Tab): TabWithGroup {
  return {
    id: tab.id!,
    title: tab.title || 'Untitled',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl,
    windowId: tab.windowId,
    groupId: tab.groupId !== undefined && tab.groupId !== -1 ? tab.groupId : undefined,
    pinned: tab.pinned,
    audible: tab.audible || false,
    muted: tab.mutedInfo?.muted || false,
    lastAccessed: tab.lastAccessed,
  };
}

// ─── WXT Entrypoint ──────────────────────────────────────────────────────

// defineBackground is auto-imported by WXT
export default defineBackground(() => {
  createMessageRouter().then((router) => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      router(message).then(sendResponse);
      return true;
    });

    chrome.commands.onCommand.addListener((command) => {
      if (command === 'toggle-command-bar') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_OVERLAY' });
          }
        });
      }
    });

    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding/index.html') });
      }
    });
  });
});
