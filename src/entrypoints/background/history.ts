import type { SearchableItem } from '../../lib/search';
import { isNavigableUrl } from '../../lib/url-safety';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class HistoryCache {
  private items: SearchableItem[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async refresh(): Promise<void> {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: 1000 }, (historyItems) => {
        const out: SearchableItem[] = [];
        for (const item of historyItems) {
          if (!item.title || item.title.length === 0) continue;
          // Drop entries with javascript:, data:, chrome:, etc.
          if (!isNavigableUrl(item.url)) continue;
          out.push({
            id: `history-${item.id}`,
            title: item.title,
            url: item.url,
            category: 'history',
            timestamp: item.lastVisitTime,
          });
        }
        this.items = out;
        resolve();
      });
    });
  }

  // Contract: refresh() always replaces this.items wholesale and getItems()
  // returns the live array — the router's engine cache keys on its identity.
  getItems(): SearchableItem[] {
    return this.items;
  }

  /**
   * Starts a periodic refresh. The cache is rebuilt from scratch on every
   * service-worker start (createMessageRouter awaits refresh()), and this
   * setInterval keeps it fresh for as long as the worker stays alive. If the
   * MV3 worker is torn down between ticks the interval dies with it — that's
   * fine, because the next wake-up rebuilds the cache anyway. The extension
   * does not request the "alarms" permission, so chrome.alarms is never used.
   */
  startPeriodicRefresh(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    // Perform an initial refresh immediately
    this.refresh();

    this.intervalId = setInterval(() => {
      this.refresh();
    }, intervalMs);
  }

  stopPeriodicRefresh(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
