import type { SearchableItem } from '../../lib/search';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class HistoryCache {
  private items: SearchableItem[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async refresh(): Promise<void> {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: 1000 }, (historyItems) => {
        this.items = historyItems
          .filter((item) => item.title && item.title.length > 0)
          .map((item): SearchableItem => ({
            id: `history-${item.id}`,
            title: item.title!,
            url: item.url,
            category: 'history',
            timestamp: item.lastVisitTime,
          }));
        resolve();
      });
    });
  }

  getItems(): SearchableItem[] {
    return this.items;
  }

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
