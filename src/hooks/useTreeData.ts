import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GetAllTabsResponse,
  GetBookmarkTreeResponse,
  TabGroupInfo,
  BookmarkNode,
} from '../lib/messaging';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface TreeItem {
  id: string;
  title: string;
  url?: string;
  icon?: string;
  type: 'tab' | 'bookmark' | 'folder' | 'group';
  depth: number;
  isExpanded: boolean;
  childCount: number;
  parentId?: string;
  tabId?: number;
}

// ─── Internal tree node (full tree, not filtered by expansion) ───────────────

interface InternalNode {
  item: Omit<TreeItem, 'isExpanded'>;
  children: InternalNode[];
}

// ─── Build internal tree from API responses ──────────────────────────────────

function buildTabNodes(groups: TabGroupInfo[]): InternalNode[] {
  return groups.map((group) => {
    const groupId = `group-${group.label}`;
    const children: InternalNode[] = group.tabs.map((tab) => ({
      item: {
        id: `tab-${tab.id}`,
        title: tab.title,
        url: tab.url,
        icon: tab.favIconUrl,
        type: 'tab' as const,
        depth: 1,
        childCount: 0,
        parentId: groupId,
        tabId: tab.id,
      },
      children: [],
    }));
    return {
      item: {
        id: groupId,
        title: group.label,
        type: 'group' as const,
        depth: 0,
        childCount: children.length,
      },
      children,
    };
  });
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

// ─── Build parent map for ArrowLeft navigation ───────────────────────────────

function buildParentMap(nodes: InternalNode[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(nodes: InternalNode[]) {
    for (const node of nodes) {
      if (node.item.parentId) {
        map.set(node.item.id, node.item.parentId);
      }
      walk(node.children);
    }
  }
  walk(nodes);
  return map;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTreeData(): {
  visibleItems: TreeItem[];
  allItems: TreeItem[];
  toggleExpand: (id: string) => void;
  getParentId: (id: string) => string | undefined;
  isLoading: boolean;
} {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const treeRef = useRef<InternalNode[]>([]);
  const parentMapRef = useRef<Map<string, string>>(new Map());
  const [visibleItems, setVisibleItems] = useState<TreeItem[]>([]);
  const [allItems, setAllItems] = useState<TreeItem[]>([]);

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

      const tabNodes = buildTabNodes(tabGroups);
      const bookmarkNodes = buildBookmarkNodes(bookmarkTree, 0);
      const tree = [...tabNodes, ...bookmarkNodes];
      treeRef.current = tree;
      parentMapRef.current = buildParentMap(tree);

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

  const getParentId = useCallback((id: string): string | undefined => {
    return parentMapRef.current.get(id);
  }, []);

  return { visibleItems, allItems, toggleExpand, getParentId, isLoading };
}
