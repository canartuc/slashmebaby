import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { UserSettings } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { TreeView } from './TreeView';
import { useTreeData } from '../../hooks/useTreeData';
import type { TreeItem } from '../../hooks/useTreeData';
import { useLabelAssignment } from '../../hooks/useLabelAssignment';
import { useTheme } from '../../hooks/useTheme';
import { isActionKey, getActionForKey } from '../../lib/labels';

function nextIndex(prev: number, len: number, dir: 1 | -1): number {
  if (len <= 0) return 0;
  if (dir === 1) return prev >= len - 1 ? 0 : prev + 1;
  return prev <= 0 ? len - 1 : prev - 1;
}

export interface CommandBarProps {
  onDismiss: () => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onDismiss }) => {
  const [mode, setMode] = useState<'jump' | 'search'>('jump');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const { pinnedTabs, allTabs, visibleItems, allItems, toggleExpand } = useTreeData();
  // Labels assigned across tabs + bookmarks (continuous sequence)
  const totalLabelItems = allTabs.length + visibleItems.length;
  const { labels, handleKeyPress } = useLabelAssignment(totalLabelItems);
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
  const stateRef = useRef({ mode, selectedIndex, filteredItems, visibleItems, query, pinnedTabs, allTabs });
  stateRef.current = { mode, selectedIndex, filteredItems, visibleItems, query, pinnedTabs, allTabs };

  const switchTab = useCallback((tabId: number) => {
    chrome.runtime.sendMessage(
      { type: 'SWITCH_TAB', payload: { tabId } },
      () => onDismiss()
    );
  }, [onDismiss]);

  const openUrl = useCallback((url: string, newTab: boolean) => {
    chrome.runtime.sendMessage(
      { type: newTab ? 'OPEN_NEW_TAB' : 'NAVIGATE', payload: { url } },
      () => onDismiss()
    );
  }, [onDismiss]);

  // Activates an item; returns true if the item was a leaf (tab/url) so callers
  // can skip selection updates that only matter for non-dismissing actions.
  const activate = useCallback((item: TreeItem, openInNewTab: boolean): boolean => {
    if (item.type === 'folder' || item.type === 'group') {
      toggleExpand(item.id);
      return false;
    }
    if (item.type === 'tab' && item.tabId) {
      switchTab(item.tabId);
      return true;
    }
    if (item.url) {
      openUrl(item.url, openInNewTab);
      return true;
    }
    return false;
  }, [toggleExpand, switchTab, openUrl]);

  const handleItemSelect = useCallback((index: number) => {
    const item = stateRef.current.filteredItems[index];
    if (!item) return;
    if (!activate(item, false)) setSelectedIndex(index);
  }, [activate]);

  const handlePinnedTabSelect = useCallback((tabId: number) => {
    switchTab(tabId);
  }, [switchTab]);

  const handleKey = useCallback((key: string, shiftKey: boolean) => {
    const { mode: currentMode, selectedIndex: idx, filteredItems: items, pinnedTabs: pinned } = stateRef.current;

    // Number keys (1-9, 0) switch to pinned tabs in jump mode
    if (currentMode === 'jump' && /^[0-9]$/.test(key) && pinned.length > 0) {
      const num = key === '0' ? 10 : parseInt(key, 10);
      const pinnedTab = pinned[num - 1];
      if (pinnedTab?.tabId) switchTab(pinnedTab.tabId);
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

    // Navigation + activation — identical in jump and search modes
    switch (key) {
      case 'Tab':
        setSelectedIndex(prev => nextIndex(prev, items.length, shiftKey ? -1 : 1));
        return;
      case 'ArrowDown':
        setSelectedIndex(prev => nextIndex(prev, items.length, 1));
        return;
      case 'ArrowUp':
        setSelectedIndex(prev => nextIndex(prev, items.length, -1));
        return;
      case 'Enter': {
        const item = items[idx];
        if (item) activate(item, shiftKey);
        return;
      }
    }

    // Jump-only handling: tree expand/collapse + label-key dispatch
    if (currentMode !== 'jump') return;

    if (key === 'ArrowRight') {
      const item = items[idx];
      if (item && (item.type === 'folder' || item.type === 'group') && !item.isExpanded) {
        toggleExpand(item.id);
      }
      return;
    }

    if (key === 'ArrowLeft') {
      const item = items[idx];
      if (!item) return;
      if ((item.type === 'folder' || item.type === 'group') && item.isExpanded) {
        toggleExpand(item.id);
      } else if (item.parentId) {
        const parentIdx = items.findIndex(i => i.id === item.parentId);
        if (parentIdx >= 0) setSelectedIndex(parentIdx);
      }
      return;
    }

    // Label key — labels map across tab grid + visible bookmark items
    const result = handleKeyPress(key);
    if (!result.consumed || result.targetIndex === null) return;
    const { allTabs: tabs, filteredItems: bkItems } = stateRef.current;
    const item = result.targetIndex < tabs.length
      ? tabs[result.targetIndex]
      : bkItems[result.targetIndex - tabs.length];
    if (!item) return;
    if (!activate(item, shiftKey)) setSelectedIndex(result.targetIndex);
  }, [toggleExpand, onDismiss, handleKeyPress, activate, switchTab]);

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
