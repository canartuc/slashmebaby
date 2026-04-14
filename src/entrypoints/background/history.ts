import type { SearchableItem } from '../../lib/search';
import { isNavigableUrl } from '../../lib/url-safety';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ALARM_NAME = 'slashmebaby-history-refresh';

export class HistoryCache {
  private items: SearchableItem[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null;

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

  getItems(): SearchableItem[] {
    return this.items;
  }

  /**
   * Starts a periodic refresh. Prefers chrome.alarms for MV3 service worker
   * compatibility (setInterval is unreliable there — the SW may be torn down
   * between ticks). Falls back to setInterval when chrome.alarms is absent
   * (e.g. MV2 Firefox test environments).
   */
  startPeriodicRefresh(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    // Perform an initial refresh immediately
    this.refresh();

    if (typeof chrome !== 'undefined' && chrome.alarms?.create && chrome.alarms.onAlarm) {
      const periodInMinutes = Math.max(1, Math.round(intervalMs / 60000));
      try {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes });
      } catch {
        // fall through to setInterval if create throws
      }
      const listener = (alarm: chrome.alarms.Alarm) => {
        if (alarm.name === ALARM_NAME) {
          this.refresh();
        }
      };
      this.alarmListener = listener;
      chrome.alarms.onAlarm.addListener(listener);
      return;
    }

    this.intervalId = setInterval(() => {
      this.refresh();
    }, intervalMs);
  }

  stopPeriodicRefresh(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.alarmListener && typeof chrome !== 'undefined' && chrome.alarms) {
      try {
        chrome.alarms.onAlarm.removeListener(this.alarmListener);
      } catch {
        // ignore
      }
      try {
        chrome.alarms.clear?.(ALARM_NAME);
      } catch {
        // ignore
      }
      this.alarmListener = null;
    }
  }
}
