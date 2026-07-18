import { TabCache } from './tabs';
import { BookmarkCache } from './bookmarks';
import { HistoryCache } from './history';
import { ActionRegistry } from './actions';
import { createActionRouting } from './action-routing';
import { createSearchEngine } from '../../lib/search';
import { getSettings } from '../../lib/storage';
import { getFaviconDataUrl } from './favicon';
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
  isGetFaviconRequest,
  isGetHistoryItemsRequest,
  isGetActionsRequest,
} from '../../lib/messaging';
import type {
  TabWithGroup,
  TabGroupInfo,
  BookmarkNode,
  HistoryItemInfo,
  ActionItemInfo,
} from '../../lib/messaging';
import type { TabContext } from './actions';
import type { SearchableItem, SearchEngine } from '../../lib/search';
import { validateNavigationUrl, isNavigableUrl } from '../../lib/url-safety';

// ─── Message Router Factory ───────────────────────────────────────────────

type MessageRouter = (message: unknown, sender?: chrome.runtime.MessageSender) => Promise<unknown>;

// Module-level so registerBackgroundListeners can attach its
// history.onVisited listeners in the worker's INITIAL SYNCHRONOUS
// evaluation (the MV3 wake rule) — the router factory below reuses the
// same instance and refreshes it during init.
const historyCache = new HistoryCache();

export async function createMessageRouter(): Promise<MessageRouter> {
  const tabCache = new TabCache();
  const bookmarkCache = new BookmarkCache();
  const actionRegistry = new ActionRegistry();
  const faviconCache = new Map<string, string>();

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

  // Periodic history refresh (default 5 min). The immediate-on-visit
  // refresh listeners are registered synchronously in
  // registerBackgroundListeners (MV3 wake rule), not here.
  historyCache.startPeriodicRefresh();

  // Cached search engine, keyed by the identity of each source's item array.
  // Every cache refresh swaps in a new array, so reference equality detects
  // staleness for all refresh paths without extra plumbing. Excluded sources
  // are keyed as null. Action labels/visibility depend on the active tab's
  // state (F09), so they are keyed by a small context signature string.
  let engineCache: {
    engine: SearchEngine;
    tabs: SearchableItem[] | null;
    bookmarks: SearchableItem[] | null;
    history: SearchableItem[] | null;
    actionsKey: string;
    maxResultsPerGroup: number;
  } | null = null;

  // ─── Active-tab context helpers (F08/F09) ───────────────────────────────

  // Resolves the tab the palette is acting on: the sender's own tab when the
  // message comes from a content script, otherwise (popup context) the active
  // tab in the current window.
  async function resolveContextTab(
    sender?: chrome.runtime.MessageSender
  ): Promise<chrome.tabs.Tab | undefined> {
    if (sender?.tab) return sender.tab;
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return activeTab;
    } catch {
      return undefined;
    }
  }

  function toTabContext(tab: chrome.tabs.Tab | undefined): TabContext | undefined {
    if (!tab) return undefined;
    return {
      pinned: tab.pinned === true,
      audible: tab.audible === true,
      muted: tab.mutedInfo?.muted === true,
    };
  }

  function actionsCacheKey(context: TabContext | undefined): string {
    if (!context) return 'default';
    return `${context.pinned}|${context.audible}|${context.muted}`;
  }

  // ─── Message Handler ────────────────────────────────────────────────────

  return async function router(message: unknown, sender?: chrome.runtime.MessageSender): Promise<unknown> {
    // SEARCH and SMART_SUGGESTIONS are kept as a stable message API even
    // though no shipped surface calls them anymore (the popup moved to the
    // overlay's raw-data pipeline in the 2026-07 unification).
    if (isSearchRequest(message)) {
      const { query, sources } = message.payload;

      const tabItems = sources.includes('tabs') ? tabCache.getItems() : null;
      const bookmarkItems = sources.includes('bookmarks') ? bookmarkCache.getItems() : null;
      const historyItems = sources.includes('history') ? historyCache.getItems() : null;

      const settings = await getSettings();

      // Action labels/visibility reflect the active tab's state (F09).
      const context = toTabContext(await resolveContextTab(sender));
      const actionsKey = actionsCacheKey(context);

      if (
        !engineCache ||
        engineCache.tabs !== tabItems ||
        engineCache.bookmarks !== bookmarkItems ||
        engineCache.history !== historyItems ||
        engineCache.actionsKey !== actionsKey ||
        engineCache.maxResultsPerGroup !== settings.maxResultsPerGroup
      ) {
        const items: SearchableItem[] = [];
        if (tabItems) items.push(...tabItems);
        if (bookmarkItems) items.push(...bookmarkItems);
        if (historyItems) items.push(...historyItems);

        // Actions are always included, contextualized to the active tab
        items.push(...actionRegistry.getItems(context));

        engineCache = {
          engine: createSearchEngine(items, {
            maxResultsPerGroup: settings.maxResultsPerGroup,
          }),
          tabs: tabItems,
          bookmarks: bookmarkItems,
          history: historyItems,
          actionsKey,
          maxResultsPerGroup: settings.maxResultsPerGroup,
        };
      }

      return { groups: engineCache.engine.search(query) };
    }

    if (isSmartSuggestionsRequest(message)) {
      // Smart suggestions (F08): 3 most recently accessed tabs + 2 most
      // recently added bookmarks + 2 actions contextual to the active tab.
      // The Settings "Search Sources" toggles apply here too — a source the
      // user switched off must not resurface in the empty state. Actions are
      // always allowed.
      const settings = await getSettings();
      const sources = settings.searchSources;
      const tabItems = sources.tabs ? tabCache.getItems() : [];
      const bookmarkItems = sources.bookmarks ? bookmarkCache.getItems() : [];

      // The extension's own pages (popup/settings/onboarding tabs) are noise
      // with raw chrome-extension:// hostnames — never suggest them.
      const ownPagePrefix =
        typeof chrome.runtime?.id === 'string' && chrome.runtime.id.length > 0
          ? `chrome-extension://${chrome.runtime.id}/`
          : null;

      // Sort tabs by recency (most recent first) and take top 3
      const recentTabs = tabItems
        .filter((item) => !ownPagePrefix || !(item.url ?? '').startsWith(ownPagePrefix))
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, 3);

      // Take the 2 most recently added bookmarks (timestamp = dateAdded)
      const topBookmarks = [...bookmarkItems]
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, 2);

      // Take 2 actions relevant to the active tab (e.g. Unpin when pinned,
      // Mute only when audible)
      const context = toTabContext(await resolveContextTab(sender));
      const topActions = actionRegistry.getContextualItems(context, 2);

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
        // Wake hibernated tabs: Chrome does not auto-reload a discarded tab
        // on programmatic activation, so it stays blank after the switch.
        // Only discarded tabs on Chrome need this — frozen tabs keep their
        // content in memory and unfreeze on activation (a reload would wipe
        // live form/SPA state), and Firefox restores discarded tabs natively
        // on activation (a reload would replace session restore with a cold
        // network load). chrome.action is absent on the Firefox MV2 build.
        if (tab.discarded === true && chrome.action !== undefined) {
          try {
            await chrome.tabs.reload(tabId);
          } catch {
            // Best-effort wake; the activation stands either way.
          }
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

    if (isGetHistoryItemsRequest(message)) {
      // F04: expose the history cache to the content overlay so history is
      // searchable outside the popup.
      const items: HistoryItemInfo[] = historyCache.getItems().map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url ?? '',
        lastVisitTime: item.timestamp,
      }));
      return { items };
    }

    if (isGetActionsRequest(message)) {
      // F12: the overlay's '>' action mode needs the action list, with
      // labels contextualized to the sender's tab (F09).
      const context = toTabContext(await resolveContextTab(sender));
      const actions: ActionItemInfo[] = actionRegistry
        .getItems(context)
        .map((item) => ({ id: item.id, title: item.title }));
      return { actions };
    }

    if (isGetFaviconRequest(message)) {
      const dataUrl = await getFaviconDataUrl(message.payload.url, faviconCache);
      return { dataUrl };
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
    discarded: tab.discarded === true || tab.frozen === true,
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

  // Per-tab action-popup routing: overlay on normal pages, popup on
  // restricted ones. Registered synchronously for MV3 wake-safety.
  const actionRouting = createActionRouting();
  actionRouting.register();

  // History freshness: refresh the shared cache on real visits. Must be
  // synchronous here — listeners registered inside the async router init
  // can never wake a suspended worker.
  historyCache.setupListeners();

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-command-bar') return;
    if (tab) {
      // The tab argument (Chrome, Firefox 126+) lets the restricted-page
      // branch call action.openPopup() synchronously inside this handler,
      // which Firefox pre-149 requires for the user-input context.
      actionRouting.requestOverlayToggle(tab);
      return;
    }
    // Legacy path without a tab argument — Chrome only, where openPopup
    // needs no user gesture, so the async query is fine.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      actionRouting.requestOverlayToggle(tabs[0]);
    });
  });

  chrome.runtime.onInstalled.addListener((details) => {
    // Per-tab popup state can be stale after an install or update — apply
    // routing to every open tab. Not done on plain worker wakes: the
    // browser keeps per-tab popup state across suspensions and the
    // tab-event listeners keep it current.
    actionRouting.sweep();
    if (details.reason === 'install') {
      // WXT emits the onboarding entrypoint at the bundle root as
      // "onboarding.html" (see .output/*/onboarding.html).
      chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding.html') });
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    actionRouting.sweep();
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
