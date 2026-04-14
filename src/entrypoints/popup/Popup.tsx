import React, { useState, useRef, useMemo, useCallback } from 'react';
import type { ResultGroup, SearchResultItem } from '../../lib/messaging';
import { SearchInput } from '../../components/CommandBar/SearchInput';
import { ResultList } from '../../components/CommandBar/ResultList';
import { useSearch } from '../../hooks/useSearch';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';

/**
 * Computes the flat indices where each group starts in the result list.
 */
function computeGroupBoundaries(groups: ResultGroup[]): number[] {
  const boundaries: number[] = [];
  let offset = 0;
  for (const group of groups) {
    boundaries.push(offset);
    offset += group.items.length;
  }
  return boundaries;
}

/**
 * Counts total items across all result groups.
 */
function countTotalItems(groups: ResultGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0);
}

/**
 * Gets the flat item at a given index across all groups.
 */
function getItemAtIndex(
  groups: ResultGroup[],
  index: number
): SearchResultItem | undefined {
  let offset = 0;
  for (const group of groups) {
    if (index < offset + group.items.length) {
      return group.items[index - offset];
    }
    offset += group.items.length;
  }
  return undefined;
}

/**
 * Mini version of the CommandBar for the browser action popup.
 * Used as a fallback for restricted pages (chrome://, about:, etc.)
 * where content scripts cannot inject the overlay.
 */
export const Popup: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { settings } = useSettings();
  const { groups } = useSearch(query);
  const theme = useTheme(settings.theme);

  const totalItems = useMemo(() => countTotalItems(groups), [groups]);
  const groupBoundaries = useMemo(() => computeGroupBoundaries(groups), [groups]);

  // Reset selection when results change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [groups]);

  const handleSelectItem = useCallback(
    (item: SearchResultItem) => {
      // Route by item kind: actions execute, tabs switch, anything with
      // a URL navigates. Previously every selection was sent as
      // EXECUTE_ACTION, which silently failed for non-action items.
      if (item.id.startsWith('action-')) {
        chrome.runtime.sendMessage({
          type: 'EXECUTE_ACTION',
          payload: { actionId: item.id },
        });
      } else if (item.id.startsWith('tab-')) {
        const tabId = Number(item.id.slice('tab-'.length));
        if (Number.isFinite(tabId)) {
          chrome.runtime.sendMessage({ type: 'SWITCH_TAB', payload: { tabId } });
        }
      } else if (item.url) {
        chrome.runtime.sendMessage({ type: 'NAVIGATE', payload: { url: item.url } });
      }
      window.close();
    },
    []
  );

  const handleExecute = useCallback(() => {
    if (totalItems === 0) return;
    const item = getItemAtIndex(groups, selectedIndex);
    if (!item) return;
    handleSelectItem(item);
  }, [groups, selectedIndex, totalItems, handleSelectItem]);

  const handleDismiss = useCallback(() => {
    window.close();
  }, []);

  useKeyboard(containerRef, {
    totalItems,
    selectedIndex,
    onMove: setSelectedIndex,
    onExecute: handleExecute,
    onDismiss: handleDismiss,
    groupBoundaries,
    query,
  });

  return (
    <div
      ref={containerRef}
      className="smb-popup"
      data-theme={theme}
      tabIndex={-1}
    >
      <SearchInput query={query} onQueryChange={setQuery} />
      <ResultList
        groups={groups}
        selectedIndex={selectedIndex}
        showFavicons={settings.showFavicons}
        onSelectItem={handleSelectItem}
      />
    </div>
  );
};
