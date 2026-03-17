import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { UserSettings } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { TreeView } from './TreeView';
import { useTreeData } from '../../hooks/useTreeData';
import { useLabelAssignment } from '../../hooks/useLabelAssignment';
import { useTheme } from '../../hooks/useTheme';
import { isActionKey, getActionForKey } from '../../lib/labels';

export interface CommandBarProps {
  onDismiss: () => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onDismiss }) => {
  const [mode, setMode] = useState<'jump' | 'search'>('jump');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const { pinnedTabs, allTabs, visibleItems, allItems, toggleExpand, getParentId, isLoading } = useTreeData();
  // Labels assigned across tabs + bookmarks (continuous sequence)
  const totalLabelItems = allTabs.length + visibleItems.length;
  const { labels, labelToIndex, handleKeyPress, pendingPrefix, clearPending } = useLabelAssignment(totalLabelItems);
  const theme = useTheme(settings.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Load settings on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
      }
    });
  }, []);

  // Reset selected index when visible items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [visibleItems]);

  // Filter items based on search query
  // When searching, filter ALL items (not just visible/expanded ones)
  const filteredItems = useMemo(() => {
    if (!query) return visibleItems;
    const lowerQuery = query.toLowerCase();
    const source = allItems.length > 0 ? allItems : visibleItems;
    return source.filter((item) => {
      // Skip folders/groups in search results — show only leaf items
      if (item.type === 'folder' || item.type === 'group') return false;
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const urlMatch = item.url ? item.url.toLowerCase().includes(lowerQuery) : false;
      return titleMatch || urlMatch;
    });
  }, [visibleItems, allItems, query]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Use a ref to always have access to latest state in the handler
  const stateRef = useRef({ mode, selectedIndex, filteredItems, visibleItems, query });
  stateRef.current = { mode, selectedIndex, filteredItems, visibleItems, query, pinnedTabs, allTabs };

  const handleItemSelect = useCallback((index: number) => {
    const items = stateRef.current.filteredItems;
    const item = items[index];
    if (!item) return;

    if (item.type === 'folder' || item.type === 'group') {
      toggleExpand(item.id);
      setSelectedIndex(index);
    } else if (item.type === 'tab' && item.tabId) {
      chrome.runtime.sendMessage(
        { type: 'SWITCH_TAB', payload: { tabId: item.tabId } },
        () => onDismiss()
      );
    } else if (item.url) {
      chrome.runtime.sendMessage(
        { type: 'NAVIGATE', payload: { url: item.url } },
        () => onDismiss()
      );
    }
  }, [toggleExpand, onDismiss]);

  const handlePinnedTabSelect = useCallback((tabId: number) => {
    chrome.runtime.sendMessage(
      { type: 'SWITCH_TAB', payload: { tabId } },
      () => onDismiss()
    );
  }, [onDismiss]);

  const handleKey = useCallback((key: string, shiftKey: boolean) => {
    const { mode: currentMode, selectedIndex: idx, filteredItems: items, query: currentQuery, pinnedTabs: pinned } = stateRef.current;

    // Number keys (1-9, 0) switch to pinned tabs in jump mode
    if (currentMode === 'jump' && /^[0-9]$/.test(key) && pinned.length > 0) {
      const num = key === '0' ? 10 : parseInt(key, 10);
      const pinnedTab = pinned[num - 1];
      if (pinnedTab?.tabId) {
        chrome.runtime.sendMessage(
          { type: 'SWITCH_TAB', payload: { tabId: pinnedTab.tabId } },
          () => onDismiss()
        );
      }
      return;
    }

    // '/' toggles mode
    if (key === '/') {
      setMode(prev => {
        if (prev === 'search') {
          setQuery('');
          return 'jump';
        }
        return 'search';
      });
      return;
    }

    // Action keys work in BOTH modes
    if (isActionKey(key)) {
      const actionId = getActionForKey(key);
      if (actionId) {
        chrome.runtime.sendMessage(
          { type: 'EXECUTE_ACTION', payload: { actionId: `action-${actionId}` } },
          () => onDismiss()
        );
      }
      return;
    }

    if (currentMode === 'jump') {
      // Jump mode key handling
      switch (key) {
        case 'Tab': {
          // Tab cycles forward through all items, Shift+Tab backward
          if (shiftKey) {
            setSelectedIndex(prev => prev <= 0 ? items.length - 1 : prev - 1);
          } else {
            setSelectedIndex(prev => prev >= items.length - 1 ? 0 : prev + 1);
          }
          break;
        }
        case 'ArrowDown':
          setSelectedIndex(prev => prev >= items.length - 1 ? 0 : prev + 1);
          break;
        case 'ArrowUp':
          setSelectedIndex(prev => prev <= 0 ? items.length - 1 : prev - 1);
          break;
        case 'ArrowRight': {
          const item = items[idx];
          if (item && (item.type === 'folder' || item.type === 'group') && !item.isExpanded) {
            toggleExpand(item.id);
          }
          break;
        }
        case 'ArrowLeft': {
          const item = items[idx];
          if (item) {
            if ((item.type === 'folder' || item.type === 'group') && item.isExpanded) {
              toggleExpand(item.id);
            } else if (item.parentId) {
              const parentIdx = items.findIndex(i => i.id === item.parentId);
              if (parentIdx >= 0) setSelectedIndex(parentIdx);
            }
          }
          break;
        }
        case 'Enter': {
          const item = items[idx];
          if (!item) break;
          if (item.type === 'folder' || item.type === 'group') {
            toggleExpand(item.id);
          } else if (item.type === 'tab' && item.tabId) {
            chrome.runtime.sendMessage(
              { type: 'SWITCH_TAB', payload: { tabId: item.tabId } },
              () => onDismiss()
            );
          } else if (item.url) {
            if (shiftKey) {
              chrome.runtime.sendMessage(
                { type: 'OPEN_NEW_TAB', payload: { url: item.url } },
                () => onDismiss()
              );
            } else {
              chrome.runtime.sendMessage(
                { type: 'NAVIGATE', payload: { url: item.url } },
                () => onDismiss()
              );
            }
          }
          break;
        }
        default: {
          // Try label key — labels map to tab grid cards
          const result = handleKeyPress(key);
          if (result.consumed && result.targetIndex !== null) {
            const { allTabs: tabs, filteredItems: bkItems } = stateRef.current;
            // Labels 0..tabs.length-1 are tabs, tabs.length+ are bookmarks
            const item = result.targetIndex < tabs.length
              ? tabs[result.targetIndex]
              : bkItems[result.targetIndex - tabs.length];
            if (item) {
              if (item.type === 'folder' || item.type === 'group') {
                toggleExpand(item.id);
                setSelectedIndex(result.targetIndex);
              } else if (item.type === 'tab' && item.tabId) {
                chrome.runtime.sendMessage(
                  { type: 'SWITCH_TAB', payload: { tabId: item.tabId } },
                  () => onDismiss()
                );
              } else if (item.url) {
                if (shiftKey) {
                  // Shift+label: open bookmark/history in NEW tab
                  chrome.runtime.sendMessage(
                    { type: 'OPEN_NEW_TAB', payload: { url: item.url } },
                    () => onDismiss()
                  );
                } else {
                  chrome.runtime.sendMessage(
                    { type: 'NAVIGATE', payload: { url: item.url } },
                    () => onDismiss()
                  );
                }
              }
            }
          }
          break;
        }
      }
    }
    // In search mode, regular keys go to the input naturally (it's focused)
    // But special keys still work:
    if (currentMode === 'search') {
      switch (key) {
        case 'Tab': {
          if (shiftKey) {
            setSelectedIndex(prev => prev <= 0 ? items.length - 1 : prev - 1);
          } else {
            setSelectedIndex(prev => prev >= items.length - 1 ? 0 : prev + 1);
          }
          break;
        }
        case 'ArrowDown':
          setSelectedIndex(prev => prev >= items.length - 1 ? 0 : prev + 1);
          break;
        case 'ArrowUp':
          setSelectedIndex(prev => prev <= 0 ? items.length - 1 : prev - 1);
          break;
        case 'Enter': {
          const item = items[idx];
          if (!item) break;
          if (item.type === 'folder' || item.type === 'group') {
            toggleExpand(item.id);
          } else if (item.type === 'tab' && item.tabId) {
            chrome.runtime.sendMessage(
              { type: 'SWITCH_TAB', payload: { tabId: item.tabId } },
              () => onDismiss()
            );
          } else if (item.url) {
            if (shiftKey) {
              chrome.runtime.sendMessage(
                { type: 'OPEN_NEW_TAB', payload: { url: item.url } },
                () => onDismiss()
              );
            } else {
              chrome.runtime.sendMessage(
                { type: 'NAVIGATE', payload: { url: item.url } },
                () => onDismiss()
              );
            }
          }
          break;
        }
      }
    }
  }, [toggleExpand, onDismiss, handleKeyPress]);

  // Listen for smb-keydown custom events from the content script
  useEffect(() => {
    const shadowRoot = containerRef.current?.getRootNode();
    if (!(shadowRoot instanceof ShadowRoot)) {
      // Fallback for testing: listen on the container's document
      const doc = containerRef.current?.ownerDocument;
      if (!doc) return;

      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        handleKey(detail.key, detail.shiftKey || false);
      };

      doc.addEventListener('smb-keydown', handler);
      return () => doc.removeEventListener('smb-keydown', handler);
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      handleKey(detail.key, detail.shiftKey || false);
    };

    shadowRoot.addEventListener('smb-keydown', handler);
    return () => shadowRoot.removeEventListener('smb-keydown', handler);
  }, [handleKey]);

  // Backdrop click to dismiss — use native listener since React events may not work
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
        ref={containerRef}
        className={`smb-container ${positionClass}`}
        data-theme={theme}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <SearchInput query={query} onQueryChange={setQuery} mode={mode} />
        <TreeView
          pinnedTabs={pinnedTabs}
          allTabs={allTabs}
          visibleItems={filteredItems}
          labels={labels}
          selectedIndex={selectedIndex}
          showFavicons={settings.showFavicons}
          onSelectItem={handleItemSelect}
          onPinnedTabSelect={handlePinnedTabSelect}
          onTabGridSelect={handlePinnedTabSelect}
          searchMode={mode === 'search'}
          searchQuery={query}
        />
      </div>
    </div>
  );
};
