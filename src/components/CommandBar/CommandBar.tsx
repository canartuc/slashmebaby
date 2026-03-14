import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ResultGroup, SearchResultItem, UserSettings } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { ResultList } from './ResultList';
import { useSearch } from '../../hooks/useSearch';
import { useTheme } from '../../hooks/useTheme';

export interface CommandBarProps {
  onDismiss: () => void;
}

function computeGroupBoundaries(groups: ResultGroup[]): number[] {
  const boundaries: number[] = [];
  let offset = 0;
  for (const group of groups) {
    boundaries.push(offset);
    offset += group.items.length;
  }
  return boundaries;
}

function countTotalItems(groups: ResultGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0);
}

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

  const { groups, isLoading } = useSearch(query);
  const theme = useTheme(settings.theme);

  const totalItems = useMemo(() => countTotalItems(groups), [groups]);
  const groupBoundaries = useMemo(() => computeGroupBoundaries(groups), [groups]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [groups]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (response && response.settings) {
        setSettings(response.settings);
      }
    });
  }, []);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': {
          e.preventDefault();
          onDismiss();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (totalItems === 0) return;
          setSelectedIndex((prev) => (prev >= totalItems - 1 ? 0 : prev + 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (totalItems === 0) return;
          setSelectedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
          break;
        }
        case 'Tab': {
          e.preventDefault();
          if (totalItems === 0 || groupBoundaries.length === 0) return;
          if (e.shiftKey) {
            const prev = [...groupBoundaries].reverse().find((b) => b < selectedIndex);
            setSelectedIndex(prev ?? groupBoundaries[groupBoundaries.length - 1]);
          } else {
            const next = groupBoundaries.find((b) => b > selectedIndex);
            setSelectedIndex(next ?? groupBoundaries[0]);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (totalItems === 0) return;
          const item = getItemAtIndex(groups, selectedIndex);
          if (item) handleSelectItem(item);
          break;
        }
        case 'Backspace': {
          if (query === '') {
            e.preventDefault();
            onDismiss();
          }
          break;
        }
      }
    },
    [onDismiss, totalItems, selectedIndex, groupBoundaries, groups, query, handleSelectItem]
  );

  const positionClass = `smb-container--${settings.position}`;

  return (
    <div
      className="smb-backdrop"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        className={`smb-container ${positionClass}`}
        data-theme={theme}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
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
