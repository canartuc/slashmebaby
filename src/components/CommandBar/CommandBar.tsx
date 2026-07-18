import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import type { UserSettings, GetActionsResponse, ExecuteActionResponse } from '../../lib/messaging';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { SearchInput } from './SearchInput';
import { TreeView } from './TreeView';
import { useTreeData } from '../../hooks/useTreeData';
import type { TreeItem } from '../../hooks/useTreeData';
import { useLabelAssignment } from '../../hooks/useLabelAssignment';
import { useTheme } from '../../hooks/useTheme';
import { isActionKey, getActionForKey } from '../../lib/labels';
import { computeSectionBoundaries, stepSectionBoundary } from '../../lib/palette-sections';
import { cleanUrl } from '../../lib/url-clean';
import { foldDiacritics } from '../../lib/diacritics';
import { guessNavigableUrl } from '../../lib/url-guess';

const ERROR_AUTO_HIDE_MS = 2500;

const FUSE_OPTIONS: IFuseOptions<TreeItem> = {
  keys: [
    { name: 'title', getFn: (item: TreeItem) => foldDiacritics(item.title ?? '') },
    { name: 'url', getFn: (item: TreeItem) => foldDiacritics(item.url ?? '') },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: false,
};

// Search results render grouped by section, in this order (F04).
const RESULT_GROUP_ORDER = ['tab', 'bookmark', 'history'] as const;

// Stable empty labels map for non-jump modes (jump badges hidden).
const EMPTY_LABELS: Map<number, string> = new Map();

function nextIndex(prev: number, len: number, dir: 1 | -1): number {
  if (len <= 0) return 0;
  if (dir === 1) return prev >= len - 1 ? 0 : prev + 1;
  return prev <= 0 ? len - 1 : prev - 1;
}

export interface CommandBarProps {
  onDismiss: () => void;
  /** 'overlay' (default): backdrop + viewport-positioned container.
   *  'popup': container fills the extension-action popup window, no
   *  backdrop, no position class — sizing comes from popup.css. */
  variant?: 'overlay' | 'popup';
  /** Mode on mount. BOTH production surfaces open in 'jump' (surface
   *  parity); retained as a prop so tests can mount directly in search
   *  mode. */
  initialMode?: 'jump' | 'search';
  /** Resolves the URL 'copy-clean-link' should copy. When absent, the
   *  synchronous window.location.href path is used (overlay: the host
   *  page). The popup passes the active tab's URL — its own location is
   *  the extension page. */
  resolveCopyUrl?: () => Promise<string | null>;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  onDismiss,
  variant = 'overlay',
  initialMode = 'jump',
  resolveCopyUrl,
}) => {
  const [mode, setMode] = useState<'jump' | 'search'>(initialMode);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [actionItems, setActionItems] = useState<TreeItem[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const { pinnedTabs, allTabs, visibleItems, allItems, historyItems, toggleExpand } = useTreeData();
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

  // Track settings changes live while the palette is open (mirrors the
  // content script's shortcut listener), so a theme change in the settings
  // page applies without reopening the overlay.
  useEffect(() => {
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'sync') return;
      const next = changes['settings']?.newValue;
      if (next && typeof next === 'object') {
        setSettings((prev) => ({ ...prev, ...(next as Partial<UserSettings>) }));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // The overlay's theme variables are defined on :host([data-theme=…]) in
  // command-bar.css, and the shadow *host* lives outside React's tree — so
  // the resolved theme must be mirrored onto it explicitly. (The attribute on
  // .smb-container below is kept for introspection/e2e parity with the popup.)
  useEffect(() => {
    const rootNode = containerRef.current?.getRootNode();
    if (rootNode instanceof ShadowRoot && rootNode.host instanceof HTMLElement) {
      rootNode.host.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Load the action list for '>' action-prefix mode (F12). The background
  // contextualizes labels to this tab (Pin↔Unpin, Mute↔Unmute). Failures are
  // tracked (not swallowed) so '>' mode can retry once and, if the list still
  // can't be loaded, explain the empty list instead of showing nothing.
  const [actionsLoadFailed, setActionsLoadFailed] = useState(false);
  const actionsRetriedRef = useRef(false);

  const loadActions = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: 'GET_ACTIONS' },
      (response: GetActionsResponse | undefined) => {
        // Read lastError unconditionally — leaving it unchecked makes Chrome
        // log "Unchecked runtime.lastError" on the host page.
        const lastError = chrome.runtime.lastError;
        if (lastError || !response || !Array.isArray(response.actions)) {
          setActionsLoadFailed(true);
          return;
        }
        setActionsLoadFailed(false);
        setActionItems(
          response.actions.map((action) => ({
            id: action.id,
            title: action.title,
            type: 'action' as const,
            actionId: action.id,
            depth: 0,
            isExpanded: false,
            childCount: 0,
          }))
        );
      }
    );
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // Inline error strip (aria-live) for failed actions; auto-hides.
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showActionError = useCallback((message: string) => {
    setActionError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setActionError(null), ERROR_AUTO_HIDE_MS);
  }, []);
  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  // Runs an action in the background. On success the palette dismisses as
  // before; on failure it stays open and surfaces the error inline instead
  // of swallowing it.
  const dispatchAction = useCallback((actionId: string) => {
    chrome.runtime.sendMessage(
      { type: 'EXECUTE_ACTION', payload: { actionId } },
      (response: ExecuteActionResponse | undefined) => {
        // Read lastError unconditionally — leaving it unchecked makes Chrome
        // log "Unchecked runtime.lastError" on the host page when the port
        // closes without a receiver.
        const lastError = chrome.runtime.lastError;
        // Only an explicit { success: true } is a success. Everything else —
        // { success: false }, the router's { error } catch-all shape (which
        // has no success field), or an undefined response (dead channel) —
        // keeps the palette open and surfaces the error.
        if (lastError || !response || response.success !== true) {
          showActionError(response?.error ?? lastError?.message ?? 'Action failed');
          return;
        }
        onDismiss();
      }
    );
  }, [onDismiss, showActionError]);

  // '>' as the first character switches to actions-only mode (F12). The
  // prefix is stripped before matching so it is never fuzzy-matched as text.
  const actionMode = query.startsWith('>');
  const effectiveQuery = actionMode ? query.slice(1).trim() : query;

  // If the initial GET_ACTIONS failed, retry once when the user actually
  // enters '>' mode; a second failure is surfaced as an in-list line below.
  useEffect(() => {
    if (actionMode && actionsLoadFailed && !actionsRetriedRef.current) {
      actionsRetriedRef.current = true;
      loadActions();
    }
  }, [actionMode, actionsLoadFailed, loadActions]);

  // Search corpus: pinned tabs + open tabs + bookmark leaves + history,
  // honoring the Settings "Search Sources" toggles. Fuse is rebuilt whenever
  // the corpus changes; it's cheap.
  const searchCorpus = useMemo<TreeItem[]>(() => {
    const sources = settings.searchSources ?? DEFAULT_SETTINGS.searchSources;
    const corpus: TreeItem[] = [];
    if (sources.tabs) {
      corpus.push(...pinnedTabs, ...allTabs);
    }
    if (sources.bookmarks) {
      const bookmarkLeaves = (allItems.length > 0 ? allItems : visibleItems).filter(
        (i) => i.type !== 'folder' && i.type !== 'group'
      );
      corpus.push(...bookmarkLeaves);
    }
    if (sources.history) {
      corpus.push(...historyItems);
    }
    return corpus;
  }, [pinnedTabs, allTabs, allItems, visibleItems, historyItems, settings.searchSources]);

  const fuse = useMemo(() => new Fuse(searchCorpus, FUSE_OPTIONS), [searchCorpus]);
  const actionsFuse = useMemo(() => new Fuse(actionItems, FUSE_OPTIONS), [actionItems]);

  // When searching, run the query (folded) through Fuse so that fuzzy matches
  // and diacritic-insensitive matches both work — "sozcu" finds "sözcü".
  // Results are grouped by section (tabs, bookmarks, history), each capped at
  // maxResultsPerGroup, with an optional go-to-URL row appended (F10).
  const filteredItems = useMemo(() => {
    if (!query) return visibleItems;

    if (actionMode) {
      if (!effectiveQuery) return actionItems;
      return actionsFuse.search(foldDiacritics(effectiveQuery)).map((r) => r.item);
    }

    const matches = fuse.search(foldDiacritics(query)).map((r) => r.item);
    const limit = settings.maxResultsPerGroup ?? DEFAULT_SETTINGS.maxResultsPerGroup;
    const grouped: TreeItem[] = [];
    for (const type of RESULT_GROUP_ORDER) {
      grouped.push(...matches.filter((i) => i.type === type).slice(0, limit));
    }

    const gotoUrl = guessNavigableUrl(query);
    if (gotoUrl) {
      grouped.push({
        id: 'goto-url',
        title: `Go to ${gotoUrl}`,
        url: gotoUrl,
        type: 'goto',
        depth: 0,
        isExpanded: false,
        childCount: 0,
      });
    }
    return grouped;
  }, [query, actionMode, effectiveQuery, visibleItems, fuse, actionsFuse, actionItems, settings.maxResultsPerGroup]);

  // Reset the selection only when the filter itself changes (typing, action
  // mode). Keying this on filteredItems identity would also fire on unrelated
  // list refreshes (expand/collapse, late data), clobbering a selection made
  // between that commit and its effect flush — a race that intermittently ate
  // ArrowDown right after an expand.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, actionMode]);

  // When the list shrinks (collapse, narrower results), clamp an out-of-range
  // selection instead of resetting, so in-range selections survive refreshes.
  useEffect(() => {
    setSelectedIndex((prev) =>
      prev >= filteredItems.length ? Math.max(0, filteredItems.length - 1) : prev
    );
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

  // Activates an item; returns true if the item was a leaf (tab/url/action) so
  // callers can skip selection updates that only matter for non-dismissing rows.
  const activate = useCallback((item: TreeItem, openInNewTab: boolean): boolean => {
    if (item.type === 'folder' || item.type === 'group') {
      toggleExpand(item.id);
      return false;
    }
    if (item.type === 'action' && item.actionId) {
      dispatchAction(item.actionId);
      return true;
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
  }, [toggleExpand, switchTab, openUrl, dispatchAction]);

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

    // Number keys (1-9, 0) switch to pinned tabs in jump mode
    if (currentMode === 'jump' && /^[0-9]$/.test(key) && pinned.length > 0) {
      const num = key === '0' ? 10 : parseInt(key, 10);
      const pinnedTab = pinned[num - 1];
      if (pinnedTab?.tabId) switchTab(pinnedTab.tabId);
      return;
    }

    // '/' toggles mode — but never while a non-empty query is being typed:
    // there it's literal text handled by the native input (the content
    // script doesn't forward it in that case; this guard keeps a stray
    // forwarded '/' from wiping the user's query).
    if (key === '/') {
      if (currentMode === 'search' && currentQuery.length > 0) return;
      setMode(prev => {
        if (prev === 'search') {
          setQuery('');
          return 'jump';
        }
        return 'search';
      });
      return;
    }

    // Keyboard recovery: a forwarded Backspace only reaches here when no
    // writable input has focus (the forwarder passes it to the input
    // otherwise). In search mode that means focus wandered off the query —
    // pull it back so editing keeps working on both surfaces. In jump mode
    // it falls through to the label handling below (clears a pending
    // two-char prefix).
    if (key === 'Backspace' && currentMode === 'search') {
      const input = containerRef.current?.querySelector<HTMLInputElement>('.smb-input');
      input?.focus();
      return;
    }

    // Action keys work in BOTH modes
    if (isActionKey(key)) {
      const actionId = getActionForKey(key);
      // copy-clean-link writes the stripped URL to the clipboard from the
      // palette's own context; MV3 service workers have no clipboard access.
      if (actionId === 'copy-clean-link') {
        if (resolveCopyUrl) {
          resolveCopyUrl()
            .then((href) =>
              href ? navigator.clipboard?.writeText(cleanUrl(href)) : undefined
            )
            .catch(() => undefined)
            .finally(() => onDismiss());
          return;
        }
        const cleaned = cleanUrl(window.location.href);
        Promise.resolve(navigator.clipboard?.writeText(cleaned))
          .catch(() => undefined)
          .finally(() => onDismiss());
        return;
      }
      if (actionId) {
        dispatchAction(`action-${actionId}`);
      }
      return;
    }

    // Navigation + activation — identical in jump and search modes
    switch (key) {
      case 'Tab':
        // Section jump, not item step: first item of the next/previous
        // section (top-level folders in the jump-mode tree), wrapping.
        // Lists with fewer than two sections fall back to item stepping so
        // Tab always moves the selection.
        setSelectedIndex(prev => {
          const target = stepSectionBoundary(
            computeSectionBoundaries(items),
            prev,
            shiftKey ? -1 : 1
          );
          return target ?? nextIndex(prev, items.length, shiftKey ? -1 : 1);
        });
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
  }, [toggleExpand, onDismiss, handleKeyPress, activate, switchTab, dispatchAction, resolveCopyUrl]);

  // Listen for smb-keydown custom events. Two production channels share
  // this contract: the content script dispatches into the shadow root
  // (overlay), and usePopupKeySource dispatches on the document (action
  // popup — NOT a test shim; jsdom tests ride the same document path).
  useEffect(() => {
    const rootNode = containerRef.current?.getRootNode();
    const target: EventTarget | undefined =
      rootNode instanceof ShadowRoot
        ? rootNode
        : containerRef.current?.ownerDocument ?? undefined;
    if (!target) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      handleKey(detail.key, detail.shiftKey || false);
    };

    target.addEventListener('smb-keydown', handler);
    return () => target.removeEventListener('smb-keydown', handler);
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

  // In the popup the window itself is the frame: no backdrop, no
  // margin-based position class — popup.css sizes .smb-container--popup.
  const containerClass =
    variant === 'popup'
      ? 'smb-container smb-container--popup'
      : `smb-container smb-container--${settings.position}`;

  const dialog = (
    <div
      ref={containerRef}
      className={containerClass}
      data-theme={theme}
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
    >
      <SearchInput query={query} onQueryChange={setQuery} mode={mode} />
      {/* Always mounted so aria-live announcements fire when text appears */}
      <div
        className={`smb-error-strip${actionError ? ' smb-error-strip--visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {actionError ?? ''}
      </div>
      <TreeView
        pinnedTabs={pinnedTabs}
        allTabs={allTabs}
        visibleItems={filteredItems}
        // Jump badges only make sense while label keys are live.
        labels={mode === 'jump' ? labels : EMPTY_LABELS}
        selectedIndex={selectedIndex}
        showFavicons={settings.showFavicons}
        onSelectItem={handleItemSelect}
        onPinnedTabSelect={handlePinnedTabSelect}
        onTabGridSelect={handlePinnedTabSelect}
        // Grids collapse only while a query is filtering; an empty search
        // box keeps the full surface (pinned, tabs, bookmarks) visible —
        // this is what the popup's search-first entry state shows.
        searchMode={mode === 'search' && query.length > 0}
        searchQuery={query}
        emptyStateMessage={
          actionMode && actionsLoadFailed && filteredItems.length === 0
            ? "Couldn't load actions"
            : undefined
        }
      />
    </div>
  );

  if (variant === 'popup') return dialog;

  return (
    <div ref={backdropRef} className="smb-backdrop">
      {dialog}
    </div>
  );
};
