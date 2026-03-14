import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ResultGroup, SearchResultItem, UserSettings } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { ResultList } from './ResultList';
import { useSearch } from '../../hooks/useSearch';
import { useTheme } from '../../hooks/useTheme';

export interface CommandBarProps {
  onDismiss: () => void;
}

function countTotalItems(groups: ResultGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0);
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

function getItemAtIndex(groups: ResultGroup[], index: number): SearchResultItem | undefined {
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

  // Use refs so the keydown handler always sees latest values without re-binding
  const stateRef = useRef({ query, selectedIndex, totalItems, groupBoundaries, groups });
  stateRef.current = { query, selectedIndex, totalItems, groupBoundaries, groups };

  useEffect(() => {
    setSelectedIndex(0);
  }, [groups]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
      }
    });
  }, []);

  const executeItem = useCallback(
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

  // Stable native keydown handler — uses ref to read latest state
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const { query: q, selectedIndex: idx, totalItems: total, groupBoundaries: bounds, groups: g } = stateRef.current;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (total === 0) return;
          setSelectedIndex(idx >= total - 1 ? 0 : idx + 1);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (total === 0) return;
          setSelectedIndex(idx <= 0 ? total - 1 : idx - 1);
          break;
        }
        case 'Tab': {
          e.preventDefault();
          if (total === 0 || bounds.length === 0) return;
          if (e.shiftKey) {
            const prev = [...bounds].reverse().find((b) => b < idx);
            setSelectedIndex(prev ?? bounds[bounds.length - 1]);
          } else {
            const next = bounds.find((b) => b > idx);
            setSelectedIndex(next ?? bounds[0]);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (total === 0) return;
          const item = getItemAtIndex(g, idx);
          if (item) executeItem(item);
          break;
        }
        case 'Backspace': {
          if (q === '') {
            e.preventDefault();
            onDismiss();
          }
          break;
        }
        // Escape is handled in content script, not here
      }
    },
    [onDismiss, executeItem]
  );

  // Backdrop click to dismiss — use native listener since React events may not work
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = backdropRef.current;
    if (!el) return;

    const handler = (e: MouseEvent) => {
      if (e.target === el) onDismiss();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onDismiss]);

  const positionClass = `smb-container--${settings.position}`;

  return (
    <div ref={backdropRef} className="smb-backdrop">
      <div
        className={`smb-container ${positionClass}`}
        data-theme={theme}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <SearchInput query={query} onQueryChange={setQuery} onKeyDown={handleKeyDown} />
        <ResultList
          groups={groups}
          selectedIndex={selectedIndex}
          showFavicons={settings.showFavicons}
          onSelectItem={executeItem}
        />
        <div className="smb-sr-only" aria-live="polite" aria-atomic="true">
          {!isLoading && totalItems > 0
            ? `${totalItems} result${totalItems === 1 ? '' : 's'}${query ? ` for '${query}'` : ''}`
            : ''}
        </div>
      </div>
    </div>
  );
};
