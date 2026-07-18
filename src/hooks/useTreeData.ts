import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GetAllTabsResponse,
  GetBookmarkTreeResponse,
  GetHistoryItemsResponse,
  TabGroupInfo,
  TabWithGroup,
  BookmarkNode,
} from '../lib/messaging';
import { getSiteName } from '../lib/site-names';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface TreeItem {
  id: string;
  title: string;
  url?: string;
  icon?: string;
  // 'history' rows come from the background history cache (search-only, F04);
  // 'action' rows back the '>' prefix mode (F12); 'goto' is the synthetic
  // go-to-URL fallback row (F10).
  type: 'tab' | 'bookmark' | 'folder' | 'group' | 'history' | 'action' | 'goto';
  depth: number;
  isExpanded: boolean;
  childCount: number;
  parentId?: string;
  tabId?: number;
  pinned?: boolean;
  siteName?: string;
  /** Hibernated (discarded/frozen) tab — renders the sleep badge. */
  discarded?: boolean;
  /** For type 'action': the EXECUTE_ACTION id (already 'action-' prefixed). */
  actionId?: string;
}

// ─── Internal tree node (full tree, not filtered by expansion) ───────────────

interface InternalNode {
  item: Omit<TreeItem, 'isExpanded'>;
  children: InternalNode[];
}

// ─── Build internal tree from API responses ──────────────────────────────────

function toTabItem(tab: TabWithGroup, pinned: boolean): Omit<TreeItem, 'isExpanded'> {
  return {
    id: `tab-${tab.id}`,
    title: tab.title,
    url: tab.url,
    icon: tab.favIconUrl,
    type: 'tab',
    depth: 0,
    childCount: 0,
    tabId: tab.id,
    pinned,
    siteName: getSiteName(tab.url),
    discarded: tab.discarded,
  };
}

function buildPinnedTabNodes(groups: TabGroupInfo[]): InternalNode[] {
  const pinned: InternalNode[] = [];
  for (const group of groups) {
    for (const tab of group.tabs) {
      if (tab.pinned) {
        pinned.push({ item: toTabItem(tab, true), children: [] });
      }
    }
  }
  return pinned;
}

function buildBookmarkNodes(
  nodes: BookmarkNode[],
  depth: number,
  parentId?: string
): InternalNode[] {
  const result: InternalNode[] = [];
  for (const node of nodes) {
    if (node.children) {
      // Folder
      const folderId = `folder-${node.id}`;
      const children = buildBookmarkNodes(node.children, depth + 1, folderId);
      result.push({
        item: {
          id: folderId,
          title: node.title,
          type: 'folder' as const,
          depth,
          childCount: children.length,
          parentId,
        },
        children,
      });
    } else {
      // Bookmark leaf
      result.push({
        item: {
          id: `bookmark-${node.id}`,
          title: node.title,
          url: node.url,
          type: 'bookmark' as const,
          depth,
          childCount: 0,
          parentId,
        },
        children: [],
      });
    }
  }
  return result;
}

// ─── Compute visible items from tree + expanded set ──────────────────────────

function computeVisibleItems(
  nodes: InternalNode[],
  expandedIds: Set<string>
): TreeItem[] {
  const result: TreeItem[] = [];
  for (const node of nodes) {
    const isExpandable =
      node.item.type === 'group' || node.item.type === 'folder';
    const isExpanded = isExpandable && expandedIds.has(node.item.id);
    result.push({ ...node.item, isExpanded });
    if (isExpanded) {
      result.push(...computeVisibleItems(node.children, expandedIds));
    }
  }
  return result;
}

// ─── Flatten ALL items for search (ignores expand state) ─────────────────────

function flattenAll(nodes: InternalNode[]): TreeItem[] {
  const result: TreeItem[] = [];
  for (const node of nodes) {
    result.push({ ...node.item, isExpanded: false });
    if (node.children.length > 0) {
      result.push(...flattenAll(node.children));
    }
  }
  return result;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTreeData(): {
  pinnedTabs: TreeItem[];
  allTabs: TreeItem[];
  visibleItems: TreeItem[];
  allItems: TreeItem[];
  historyItems: TreeItem[];
  toggleExpand: (id: string) => void;
  isLoading: boolean;
} {
  const [, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const treeRef = useRef<InternalNode[]>([]);
  const [pinnedTabs, setPinnedTabs] = useState<TreeItem[]>([]);
  const [allTabs, setAllTabs] = useState<TreeItem[]>([]);
  const [visibleItems, setVisibleItems] = useState<TreeItem[]>([]);
  const [allItems, setAllItems] = useState<TreeItem[]>([]);
  const [historyItems, setHistoryItems] = useState<TreeItem[]>([]);

  // Fetch data on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    let tabGroups: TabGroupInfo[] = [];
    let bookmarkTree: BookmarkNode[] = [];
    let completed = 0;

    function tryFinish() {
      completed++;
      if (completed < 2 || cancelled) return;

      const pinnedNodes = buildPinnedTabNodes(tabGroups);
      const bookmarkNodes = buildBookmarkNodes(bookmarkTree, 0);
      // Tree only contains bookmarks — tabs are in the grid
      const tree = [...bookmarkNodes];

      setPinnedTabs(pinnedNodes.map((n) => ({ ...n.item, isExpanded: false })));

      // Flat list of all unpinned tabs for grid view
      const flatTabs: TreeItem[] = [];
      for (const group of tabGroups) {
        for (const tab of group.tabs) {
          if (!tab.pinned) {
            flatTabs.push({ ...toTabItem(tab, false), isExpanded: false });
          }
        }
      }
      setAllTabs(flatTabs);
      treeRef.current = tree;

      const initialExpanded = new Set<string>();
      setExpandedIds(initialExpanded);
      setVisibleItems(computeVisibleItems(tree, initialExpanded));
      setAllItems(flattenAll(tree));
      setIsLoading(false);
    }

    chrome.runtime.sendMessage(
      { type: 'GET_ALL_TABS' },
      (response: GetAllTabsResponse) => {
        if (cancelled) return;
        if (response && response.groups) {
          tabGroups = response.groups;
        }
        tryFinish();
      }
    );

    chrome.runtime.sendMessage(
      { type: 'GET_BOOKMARK_TREE' },
      (response: GetBookmarkTreeResponse) => {
        if (cancelled) return;
        if (response && response.tree) {
          bookmarkTree = response.tree;
        }
        tryFinish();
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // History is fetched independently of the tree (F04): it only feeds the
  // overlay's search corpus and never appears in the jump-mode tree, so it
  // does not gate isLoading.
  useEffect(() => {
    let cancelled = false;

    chrome.runtime.sendMessage(
      { type: 'GET_HISTORY_ITEMS' },
      (response: GetHistoryItemsResponse | undefined) => {
        // Read lastError before anything else — leaving it unchecked makes
        // Chrome log "Unchecked runtime.lastError" on the host page.
        const lastError = chrome.runtime.lastError;
        if (cancelled) return;
        if (lastError || !response || !Array.isArray(response.items)) {
          // History is a progressive enhancement of the search corpus: keep
          // the UI stable (no rows) and log once so the failure is traceable.
          console.warn(
            '[SlashMeBaby] Failed to load history items:',
            lastError?.message ?? 'invalid response'
          );
          return;
        }
        setHistoryItems(
          response.items.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            type: 'history' as const,
            depth: 0,
            isExpanded: false,
            childCount: 0,
          }))
        );
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setVisibleItems(computeVisibleItems(treeRef.current, next));
      return next;
    });
  }, []);

  return { pinnedTabs, allTabs, visibleItems, allItems, historyItems, toggleExpand, isLoading };
}
