import { useState, useEffect } from 'react';
import type { ResultGroup } from '../lib/messaging';

export interface UseSearchResult {
  groups: ResultGroup[];
  isLoading: boolean;
}

/**
 * Sends search or smart-suggestions requests to the background service worker
 * and returns grouped results.
 *
 * - On mount (empty query): sends SMART_SUGGESTIONS
 * - On query change: sends SEARCH with all sources
 */
export function useSearch(query: string): UseSearchResult {
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const message =
      query === ''
        ? { type: 'SMART_SUGGESTIONS' as const }
        : {
            type: 'SEARCH' as const,
            payload: {
              query,
              sources: ['tabs', 'bookmarks', 'history', 'actions'] as const,
            },
          };

    chrome.runtime.sendMessage(message, (response) => {
      if (cancelled) return;
      setIsLoading(false);
      if (response && response.groups) {
        setGroups(response.groups);
      } else {
        setGroups([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return { groups, isLoading };
}
