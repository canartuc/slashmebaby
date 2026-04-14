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
  isSwitchTabRequest,
  isOpenNewTabRequest,
  isNavigateRequest,
} from '../../lib/messaging';
import type { TabWithGroup, TabGroupInfo, BookmarkNode } from '../../lib/messaging';
import type { SearchableItem } from '../../lib/search';
import { validateNavigationUrl, isNavigableUrl } from '../../lib/url-safety';

// ─── Message Router Factory ───────────────────────────────────────────────

type MessageRouter = (message: unknown, sender?: chrome.runtime.MessageSender) => Promise<unknown>;

export async function createMessageRouter(): Promise<MessageRouter> {
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

  return async function router(message: unknown, sender?: chrome.runtime.MessageSender): Promise<unknown> {
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

    if (isSwitchTabRequest(message)) {
      const { tabId } = message.payload;
      try {
        await chrome.tabs.update(tabId, { active: true });
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }

    if (isOpenNewTabRequest(message)) {
      const { url } = message.payload;
      const check = validateNavigationUrl(url);
      if (!check.ok) {
        return { success: false, error: `unsafe url: ${check.reason}` };
      }
      try {
        await chrome.tabs.create({ url });
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }

    if (isNavigateRequest(message)) {
      const { url } = message.payload;
      const check = validateNavigationUrl(url);
      if (!check.ok) {
        return { success: false, error: `unsafe url: ${check.reason}` };
      }
      try {
        // Prefer the sender's own tab when available. Falls back to the
        // active tab in the current window (used by the popup context,
        // which has no sender.tab).
        let targetId: number | undefined;
        if (sender?.tab?.id !== undefined) {
          targetId = sender.tab.id;
        } else {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetId = activeTab?.id;
        }
        if (targetId !== undefined) {
          await chrome.tabs.update(targetId, { url });
        } else {
          await chrome.tabs.create({ url });
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

      // Resolve target tab: explicit → sender's tab → active tab. Using the
      // sender's tab avoids closing the wrong tab if focus changed since
      // the palette was opened.
      let resolvedTabId = targetTabId;
      if (resolvedTabId === undefined && sender?.tab?.id !== undefined) {
        resolvedTabId = sender.tab.id;
      }
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
              const list = grouped.get(tab.groupId);
              if (list) list.push(tab);
              else grouped.set(tab.groupId, [tab]);
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

      function convertNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode | null {
        // Folder (no url): keep but drop unsafe child leaves recursively.
        // Leaf (has url): drop entirely if scheme isn't navigable.
        if (node.url !== undefined && !isNavigableUrl(node.url)) return null;
        const result: BookmarkNode = {
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
        };
        if (node.children) {
          const safeChildren: BookmarkNode[] = [];
          for (const child of node.children) {
            const converted = convertNode(child);
            if (converted) safeChildren.push(converted);
          }
          result.children = safeChildren;
        }
        return result;
      }

      // The root node has children that are the top-level folders
      const rootChildren = rawTree[0]?.children || [];
      const tree: BookmarkNode[] = [];
      for (const child of rootChildren) {
        const converted = convertNode(child);
        // Filter out empty root folders (like Mobile Bookmarks)
        if (converted && converted.children && converted.children.length > 0) {
          tree.push(converted);
        }
      }

      return { tree };
    }

    return { error: 'Unknown message type' };
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────

function mapTab(tab: chrome.tabs.Tab): TabWithGroup {
  // Tabs without an id can't be acted on; callers must filter beforehand.
  if (tab.id === undefined) {
    throw new Error('mapTab called with tab.id === undefined');
  }
  return {
    id: tab.id,
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

/**
 * Registers background listeners synchronously so MV3 service-worker
 * wake-up events are never missed, and lazily initializes the router
 * the first time a message arrives.
 *
 * The async `createMessageRouter` init returns a promise; the first
 * message handler awaits it before routing. Subsequent messages reuse
 * the same cached router instance.
 */
export function registerBackgroundListeners(): void {
  let routerPromise: Promise<MessageRouter> | null = null;
  const getRouter = (): Promise<MessageRouter> => {
    if (!routerPromise) routerPromise = createMessageRouter();
    return routerPromise;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only accept messages that originate from our own extension. MV3 rejects
    // external messages by default, but this is defense-in-depth in case
    // externally_connectable is ever added.
    if (sender && sender.id && sender.id !== chrome.runtime.id) {
      sendResponse({ error: 'forbidden sender' });
      return false;
    }
    getRouter()
      .then((router) => router(message, sender))
      .then(sendResponse)
      .catch((err) => sendResponse({ error: String(err) }));
    // Return true to keep the message channel open for async sendResponse.
    return true;
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-command-bar') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (typeof tabId === 'number') {
          chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_OVERLAY' }, () => {
            // Swallow lastError — expected on chrome:// pages where the
            // content script cannot run. The popup is the fallback there.
            void chrome.runtime.lastError;
          });
        }
      });
    }
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding/index.html') });
    }
  });

  // Warm the router on startup so the first user interaction isn't delayed.
  // Failures here are non-fatal; the next message will retry.
  getRouter().catch(() => {
    routerPromise = null;
  });
}

// defineBackground is auto-imported by WXT
export default defineBackground(() => {
  registerBackgroundListeners();
});
