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
} from '../../lib/messaging';
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

    if (isExecuteActionRequest(message)) {
      const { actionId, targetTabId } = message.payload;
      // Strip 'action-' prefix before delegating to registry
      const bareActionId = actionId.startsWith('action-')
        ? actionId.slice('action-'.length)
        : actionId;

      return await actionRegistry.execute(bareActionId, targetTabId);
    }

    if (isGetSettingsRequest(message)) {
      const settings = await getSettings();
      return { settings };
    }

    return { error: 'Unknown message type' };
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
