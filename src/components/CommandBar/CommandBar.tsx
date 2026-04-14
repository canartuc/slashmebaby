import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { UserSettings } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { TreeView } from './TreeView';
import { useTreeData } from '../../hooks/useTreeData';
import type { TreeItem } from '../../hooks/useTreeData';
import { useLabelAssignment } from '../../hooks/useLabelAssignment';
import { useTheme } from '../../hooks/useTheme';
import { isActionKey, getActionForKey } from '../../lib/labels';
import { isNavigableUrl } from '../../lib/url-safety';
import { foldDiacritics } from '../../lib/diacritics';

function nextIndex(prev: number, len: number, dir: 1 | -1): number {
  if (len <= 0) return 0;
  if (dir === 1) return prev >= len - 1 ? 0 : prev + 1;
  return prev <= 0 ? len - 1 : prev - 1;
}

// Accept bare domains ("example.com") by prepending https:// when no scheme is present.
function normalizeUrlInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isNavigableUrl(candidate) ? candidate : null;
}

export interface CommandBarProps {
  onDismiss: () => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onDismiss }) => {
  const [mode, setMode] = useState<'jump' | 'search' | 'url'>('jump');
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

  // When there is no query, render the tree as-is.
  // When searching, fuzzy-match open tabs + bookmark leaves with diacritic
  // folding so "sözcü" and "sozcu" (or "cafe" and "café") are equivalent.
  const searchCorpus = useMemo(() => {
    const bookmarkSource = allItems.length > 0 ? allItems : visibleItems;
    return [...pinnedTabs, ...allTabs, ...bookmarkSource].filter(
      (item) => item.type !== 'folder' && item.type !== 'group'
    );
  }, [pinnedTabs, allTabs, allItems, visibleItems]);

  const fuse = useMemo(
    () =>
      new Fuse(searchCorpus, {
        keys: ['title', 'url'],
        threshold: 0.4,
        distance: 100,
        ignoreLocation: true,
        getFn: (obj, path) => {
          const key = Array.isArray(path) ? path[0] : path;
          const value = (obj as unknown as Record<string, unknown>)[key];
          return typeof value === 'string' ? foldDiacritics(value) : '';
        },
      }),
    [searchCorpus]
  );

  const filteredItems = useMemo(() => {
    if (!query) return visibleItems;
    const folded = foldDiacritics(query);
    if (!folded) return visibleItems;
    return fuse.search(folded).map((r) => r.item);
  }, [visibleItems, query, fuse]);

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
    const { mode: currentMode, selectedIndex: idx, filteredItems: items, pinnedTabs: pinned, query: currentQuery } = stateRef.current;

    // URL mode: Enter navigates; other keys fall through (Tab/arrows no-op, Escape is host-handled).
    if (currentMode === 'url') {
      if (key === 'Enter') {
        const url = normalizeUrlInput(currentQuery);
        if (url) openUrl(url, shiftKey);
        else onDismiss();
      }
      return;
    }

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

    // `u` enters URL-input mode from jump; pre-empts the EXECUTE_ACTION dispatch below.
    if (currentMode === 'jump' && key === 'u') {
      setQuery('');
      setMode('url');
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
  }, [toggleExpand, onDismiss, handleKeyPress, activate, switchTab, openUrl]);

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
