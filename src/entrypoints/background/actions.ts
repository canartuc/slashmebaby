import type { SearchableItem } from '../../lib/search';
import type { ExecuteActionResponse } from '../../lib/messaging';

interface ActionDefinition {
  id: string;
  title: string;
  description?: string;
}

const ACTION_DEFINITIONS: ActionDefinition[] = [
  { id: 'close-tab', title: 'Close Tab', description: 'Close the current tab' },
  { id: 'close-other-tabs', title: 'Close Other Tabs', description: 'Close all tabs except the current one' },
  { id: 'pin-tab', title: 'Pin Tab', description: 'Toggle pin state of the current tab' },
  { id: 'mute-tab', title: 'Mute Tab', description: 'Toggle mute state of the current tab' },
  { id: 'duplicate-tab', title: 'Duplicate Tab', description: 'Duplicate the current tab' },
  { id: 'move-to-window', title: 'Move to New Window', description: 'Move the current tab to a new window' },
  { id: 'reload-tab', title: 'Reload Tab', description: 'Reload the current tab' },
  { id: 'new-tab', title: 'New Tab', description: 'Open a new tab' },
  { id: 'recently-closed', title: 'Recently Closed', description: 'Show recently closed tabs' },
  { id: 'close-duplicates', title: 'Close Duplicate Tabs', description: 'Close duplicate tabs with the same URL' },
  { id: 'sort-by-domain', title: 'Sort Tabs by Domain', description: 'Sort all tabs alphabetically by domain' },
  { id: 'settings', title: 'Open Settings', description: 'Open extension settings' },
];

type UndoEntry =
  | { type: 'restore-tabs'; count: number }
  | { type: 'toggle-pin'; tabId: number }
  | { type: 'toggle-mute'; tabId: number }
  | { type: 'close-tab'; tabId: number }
  | { type: 'none' };

export class ActionRegistry {
  private lastUndo: UndoEntry = { type: 'none' };

  getItems(): SearchableItem[] {
    return ACTION_DEFINITIONS.map((action): SearchableItem => ({
      id: `action-${action.id}`,
      title: action.title,
      category: 'actions',
    }));
  }

  async execute(actionId: string, targetTabId?: number): Promise<ExecuteActionResponse> {
    const requireTab = (): ExecuteActionResponse | number => {
      if (targetTabId === undefined) {
        return { success: false, error: `Action ${actionId} requires a target tab` };
      }
      return targetTabId;
    };
    try {
      switch (actionId) {
        case 'close-tab': {
          const t = requireTab();
          return typeof t === 'number' ? await this.closeTab(t) : t;
        }

        case 'close-other-tabs': {
          const t = requireTab();
          return typeof t === 'number' ? await this.closeOtherTabs(t) : t;
        }

        case 'pin-tab': {
          const t = requireTab();
          return typeof t === 'number' ? await this.pinTab(t) : t;
        }

        case 'mute-tab': {
          const t = requireTab();
          return typeof t === 'number' ? await this.muteTab(t) : t;
        }

        case 'duplicate-tab': {
          const t = requireTab();
          return typeof t === 'number' ? await this.duplicateTab(t) : t;
        }

        case 'move-to-window': {
          const t = requireTab();
          return typeof t === 'number' ? await this.moveToWindow(t) : t;
        }

        case 'reload-tab': {
          const t = requireTab();
          return typeof t === 'number' ? await this.reloadTab(t) : t;
        }

        case 'new-tab':
          return await this.newTab();

        case 'recently-closed':
          return await this.undo();

        case 'close-duplicates':
          return await this.closeDuplicates();

        case 'sort-by-domain':
          return await this.sortByDomain();

        case 'settings':
          return await this.openSettings();

        default:
          return { success: false, error: `Unknown action: ${actionId}` };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private closeTab(tabId: number): Promise<ExecuteActionResponse> {
    this.lastUndo = { type: 'restore-tabs', count: 1 };
    return new Promise((resolve) => {
      chrome.tabs.remove(tabId, () => {
        resolve({ success: true });
      });
    });
  }

  private closeOtherTabs(targetTabId: number): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const tabsToClose: number[] = [];
        for (const tab of tabs) {
          if (tab.id !== undefined && tab.id !== targetTabId && !tab.pinned) {
            tabsToClose.push(tab.id);
          }
        }

        this.lastUndo = { type: 'restore-tabs', count: tabsToClose.length };

        if (tabsToClose.length === 0) {
          resolve({ success: true });
          return;
        }

        chrome.tabs.remove(tabsToClose, () => {
          resolve({ success: true });
        });
      });
    });
  }

  private pinTab(tabId: number): Promise<ExecuteActionResponse> {
    this.lastUndo = { type: 'toggle-pin', tabId };
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        chrome.tabs.update(tabId, { pinned: !tab.pinned }, () => {
          resolve({ success: true });
        });
      });
    });
  }

  private muteTab(tabId: number): Promise<ExecuteActionResponse> {
    this.lastUndo = { type: 'toggle-mute', tabId };
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        const currentlyMuted = tab.mutedInfo?.muted ?? false;
        chrome.tabs.update(tabId, { muted: !currentlyMuted }, () => {
          resolve({ success: true });
        });
      });
    });
  }

  private duplicateTab(tabId: number): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.duplicate(tabId, (newTab) => {
        if (newTab?.id) {
          this.lastUndo = { type: 'close-tab', tabId: newTab.id };
        }
        resolve({ success: true });
      });
    });
  }

  private moveToWindow(tabId: number): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.windows.create({ tabId }, () => {
        resolve({ success: true });
      });
    });
  }

  private reloadTab(tabId: number): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.reload(tabId, {}, () => {
        resolve({ success: true });
      });
    });
  }

  private newTab(): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.create({}, (tab) => {
        if (tab?.id) {
          this.lastUndo = { type: 'close-tab', tabId: tab.id };
        }
        resolve({ success: true });
      });
    });
  }

  private closeDuplicates(): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const seen = new Map<string, number>();
        const toClose: number[] = [];

        for (const tab of tabs) {
          if (!tab.url || tab.id === undefined) continue;
          if (seen.has(tab.url)) {
            toClose.push(tab.id);
          } else {
            seen.set(tab.url, tab.id);
          }
        }

        this.lastUndo = { type: 'restore-tabs', count: toClose.length };

        if (toClose.length === 0) {
          resolve({ success: true });
          return;
        }

        chrome.tabs.remove(toClose, () => {
          resolve({ success: true });
        });
      });
    });
  }

  private sortByDomain(): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const getHostname = (url?: string) => {
          try {
            return new URL(url ?? '').hostname;
          } catch {
            return '';
          }
        };

        const sorted = [...tabs].sort((a, b) => {
          const hostA = getHostname(a.url);
          const hostB = getHostname(b.url);
          return hostA.localeCompare(hostB);
        });

        // Move each tab to its sorted position
        const movePromises: Promise<void>[] = [];
        let index = 0;
        for (const tab of sorted) {
          if (tab.id === undefined) continue;
          const tabId = tab.id;
          const targetIndex = index++;
          movePromises.push(new Promise<void>((res) => {
            chrome.tabs.move(tabId, { index: targetIndex }, () => res());
          }));
        }

        Promise.all(movePromises).then(() => resolve({ success: true }));
      });
    });
  }

  private async openSettings(): Promise<ExecuteActionResponse> {
    await chrome.runtime.openOptionsPage();
    return { success: true };
  }

  private async undo(): Promise<ExecuteActionResponse> {
    const entry = this.lastUndo;
    this.lastUndo = { type: 'none' };

    switch (entry.type) {
      case 'restore-tabs': {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTabId = activeTab?.id;
        const activeWindowId = activeTab?.windowId;

        const count = Math.max(1, entry.count);
        const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: count });
        for (const session of sessions) {
          if (session.tab?.sessionId) {
            await chrome.sessions.restore(session.tab.sessionId);
          } else if (session.window?.sessionId) {
            await chrome.sessions.restore(session.window.sessionId);
          }
        }

        // Stay on the active tab
        if (activeTabId) {
          await chrome.tabs.update(activeTabId, { active: true });
          if (activeWindowId) {
            await chrome.windows.update(activeWindowId, { focused: true });
          }
        }
        return { success: true };
      }

      case 'toggle-pin': {
        // Pin/unpin is its own inverse — just toggle again
        return await this.pinTab(entry.tabId);
      }

      case 'toggle-mute': {
        // Mute/unmute is its own inverse — just toggle again
        return await this.muteTab(entry.tabId);
      }

      case 'close-tab': {
        // Close a tab that was created (undo new-tab or duplicate)
        await chrome.tabs.remove(entry.tabId);
        return { success: true };
      }

      case 'none':
      default:
        // Nothing to undo — fall back to restoring last closed
        const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
        if (sessions.length > 0) {
          const session = sessions[0];
          if (session.tab?.sessionId) {
            await chrome.sessions.restore(session.tab.sessionId);
          } else if (session.window?.sessionId) {
            await chrome.sessions.restore(session.window.sessionId);
          }
        }
        return { success: true };
    }
  }
}
