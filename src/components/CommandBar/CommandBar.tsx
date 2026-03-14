import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ResultGroup, SearchResultItem, UserSettings } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { ResultList } from './ResultList';
import { useSearch } from '../../hooks/useSearch';
import { useTheme } from '../../hooks/useTheme';
import { useKeyboard } from '../../hooks/useKeyboard';

export interface CommandBarProps {
  onDismiss: () => void;
}

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

export const CommandBar: React.FC<CommandBarProps> = ({ onDismiss }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const containerRef = useRef<HTMLDivElement>(null);

  const { groups, isLoading } = useSearch(query);
  const theme = useTheme(settings.theme);

  const totalItems = useMemo(() => countTotalItems(groups), [groups]);
  const groupBoundaries = useMemo(() => computeGroupBoundaries(groups), [groups]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [groups]);

  // Load settings from background on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (response && response.settings) {
        setSettings(response.settings);
      }
    });
  }, []);

  const handleExecute = useCallback(() => {
    if (totalItems === 0) return;
    const item = getItemAtIndex(groups, selectedIndex);
    if (!item) return;

    handleSelectItem(item);
  }, [groups, selectedIndex, totalItems]);

  const handleSelectItem = useCallback(
    (item: SearchResultItem) => {
      const sendAndDismiss = (message: Record<string, unknown>) => {
        chrome.runtime.sendMessage(message, () => {
          onDismiss();
        });
      };

      if (item.id.startsWith('tab-')) {
        const tabId = parseInt(item.id.replace('tab-', ''), 10);
        sendAndDismiss({ type: 'SWITCH_TAB', payload: { tabId } });
      } else if (item.id.startsWith('bookmark-') || item.id.startsWith('history-')) {
        if (item.url) {
          sendAndDismiss({ type: 'NAVIGATE', payload: { url: item.url } });
        }
      } else if (item.id.startsWith('action-')) {
        sendAndDismiss({ type: 'EXECUTE_ACTION', payload: { actionId: item.id } });
      }
    },
    [onDismiss]
  );

  useKeyboard(containerRef, {
    totalItems,
    selectedIndex,
    onMove: setSelectedIndex,
    onExecute: handleExecute,
    onDismiss,
    groupBoundaries,
    query,
  });

  const positionClass = `smb-container--${settings.position}`;

  return (
    <div
      className="smb-backdrop"
      onClick={(e) => {
        // Only dismiss if clicking the backdrop itself, not the container
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        ref={containerRef}
        className={`smb-container ${positionClass}`}
        data-theme={theme}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        tabIndex={-1}
      >
        <SearchInput query={query} onQueryChange={setQuery} />
        <ResultList
          groups={groups}
          selectedIndex={selectedIndex}
          showFavicons={settings.showFavicons}
          onSelectItem={handleSelectItem}
        />
        <div
          className="smb-sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {!isLoading && totalItems > 0
            ? `${totalItems} result${totalItems === 1 ? '' : 's'}${query ? ` for '${query}'` : ''}`
            : ''}
        </div>
      </div>
    </div>
  );
};
