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
  { id: 'go-to-url', title: 'Go to URL', description: 'Navigate to a specific URL' },
  { id: 'recently-closed', title: 'Recently Closed', description: 'Show recently closed tabs' },
  { id: 'close-duplicates', title: 'Close Duplicate Tabs', description: 'Close duplicate tabs with the same URL' },
  { id: 'sort-by-domain', title: 'Sort Tabs by Domain', description: 'Sort all tabs alphabetically by domain' },
  { id: 'settings', title: 'Open Settings', description: 'Open extension settings' },
];

export class ActionRegistry {
  // Track how many tabs the last destructive action closed, so undo can restore all
  private lastCloseCount = 1;

  getItems(): SearchableItem[] {
    return ACTION_DEFINITIONS.map((action): SearchableItem => ({
      id: `action-${action.id}`,
      title: action.title,
      category: 'actions',
    }));
  }

  async execute(actionId: string, targetTabId?: number): Promise<ExecuteActionResponse> {
    try {
      switch (actionId) {
        case 'close-tab':
          return await this.closeTab(targetTabId!);

        case 'close-other-tabs':
          return await this.closeOtherTabs(targetTabId!);

        case 'pin-tab':
          return await this.pinTab(targetTabId!);

        case 'mute-tab':
          return await this.muteTab(targetTabId!);

        case 'duplicate-tab':
          return await this.duplicateTab(targetTabId!);

        case 'move-to-window':
          return await this.moveToWindow(targetTabId!);

        case 'reload-tab':
          return await this.reloadTab(targetTabId!);

        case 'new-tab':
          return await this.newTab();

        case 'go-to-url':
          // URL navigation is handled by the UI
          return { success: true };

        case 'recently-closed':
          return await this.undoCloseTab();

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
    this.lastCloseCount = 1;
    return new Promise((resolve) => {
      chrome.tabs.remove(tabId, () => {
        resolve({ success: true });
      });
    });
  }

  private closeOtherTabs(targetTabId: number): Promise<ExecuteActionResponse> {
    return new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const tabsToClose = tabs
          .filter((tab) => tab.id !== targetTabId && !tab.pinned && tab.id !== undefined)
          .map((tab) => tab.id!);

        this.lastCloseCount = tabsToClose.length;

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
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        chrome.tabs.update(tabId, { pinned: !tab.pinned }, () => {
          resolve({ success: true });
        });
      });
    });
  }

  private muteTab(tabId: number): Promise<ExecuteActionResponse> {
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
      chrome.tabs.duplicate(tabId, () => {
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
      chrome.tabs.create({}, () => {
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

        this.lastCloseCount = toClose.length;

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
        const movePromises = sorted
          .filter((tab) => tab.id !== undefined)
          .map((tab, index) =>
            new Promise<void>((res) => {
              chrome.tabs.move(tab.id!, { index }, () => res());
            })
          );

        Promise.all(movePromises).then(() => resolve({ success: true }));
      });
    });
  }

  private async openSettings(): Promise<ExecuteActionResponse> {
    await chrome.runtime.openOptionsPage();
    return { success: true };
  }

  private async undoCloseTab(): Promise<ExecuteActionResponse> {
    // Remember the current active tab so we can return to it after restoring
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTab?.id;
    const activeWindowId = activeTab?.windowId;

    const count = Math.max(1, this.lastCloseCount);
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: count });

    for (const session of sessions) {
      if (session.tab?.sessionId) {
        await chrome.sessions.restore(session.tab.sessionId);
      } else if (session.window?.sessionId) {
        await chrome.sessions.restore(session.window.sessionId);
      }
    }

    // Switch back to the tab the user was on
    if (activeTabId) {
      await chrome.tabs.update(activeTabId, { active: true });
      if (activeWindowId) {
        await chrome.windows.update(activeWindowId, { focused: true });
      }
    }

    this.lastCloseCount = 1;
    return { success: true };
  }
}
