import { useState, useEffect } from 'react';
import type { ResultGroup, Source, UserSettings } from '../lib/messaging';

export interface UseSearchResult {
  groups: ResultGroup[];
  isLoading: boolean;
}

/**
 * Sends search or smart-suggestions requests to the background service worker
 * and returns grouped results.
 *
 * - On mount (empty query): sends SMART_SUGGESTIONS
 * - On query change: sends SEARCH with the sources enabled in settings
 *   (actions are always searchable; the toggles cover tabs/bookmarks/history).
 *   When no searchSources are provided, all sources are included.
 */
export function useSearch(
  query: string,
  searchSources?: UserSettings['searchSources']
): UseSearchResult {
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const includeTabs = searchSources?.tabs ?? true;
  const includeBookmarks = searchSources?.bookmarks ?? true;
  const includeHistory = searchSources?.history ?? true;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const sources: Source[] = [];
    if (includeTabs) sources.push('tabs');
    if (includeBookmarks) sources.push('bookmarks');
    if (includeHistory) sources.push('history');
    // Actions are not covered by the source toggles and are always searchable
    sources.push('actions');

    const message =
      query === ''
        ? { type: 'SMART_SUGGESTIONS' as const }
        : {
            type: 'SEARCH' as const,
            payload: { query, sources },
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
  }, [query, includeTabs, includeBookmarks, includeHistory]);

  return { groups, isLoading };
}
