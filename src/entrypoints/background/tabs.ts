import type { SearchableItem } from '../../lib/search';

export class TabCache {
  private items: SearchableItem[] = [];

  async refresh(): Promise<void> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        this.items = tabs
          .filter((tab) => tab.id !== undefined)
          .map((tab): SearchableItem => ({
            id: `tab-${tab.id}`,
            title: tab.title ?? '',
            url: tab.url,
            category: 'tabs',
            timestamp: tab.lastAccessed,
            icon: tab.favIconUrl,
          }));
        resolve();
      });
    });
  }

  // Contract: refresh() always replaces this.items wholesale and getItems()
  // returns the live array. The background router's search-engine cache keys
  // on this array's identity to detect staleness — patching items in place or
  // returning a copy here would silently break that invalidation.
  getItems(): SearchableItem[] {
    return this.items;
  }

  setupListeners(onUpdate: () => void): void {
    const handler = () => {
      this.refresh().then(onUpdate);
    };

    chrome.tabs.onCreated.addListener(handler);
    chrome.tabs.onRemoved.addListener(handler);
    chrome.tabs.onUpdated.addListener(handler);
    chrome.tabs.onActivated.addListener(handler);
  }
}
