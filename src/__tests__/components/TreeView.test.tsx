// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeView } from '../../components/CommandBar/TreeView';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const groupItem: TreeItemData = {
  id: 'group-Window 1',
  title: 'Window 1',
  type: 'group',
  depth: 0,
  isExpanded: true,
  childCount: 2,
};

const tab1: TreeItemData = {
  id: 'tab-101',
  title: 'Gmail',
  url: 'https://mail.google.com',
  icon: 'https://mail.google.com/favicon.ico',
  type: 'tab',
  depth: 1,
  isExpanded: false,
  childCount: 0,
  parentId: 'group-Window 1',
  tabId: 101,
};

const tab2: TreeItemData = {
  id: 'tab-102',
  title: 'GitHub',
  url: 'https://github.com',
  type: 'tab',
  depth: 1,
  isExpanded: false,
  childCount: 0,
  parentId: 'group-Window 1',
  tabId: 102,
};

const folderItem: TreeItemData = {
  id: 'folder-1',
  title: 'Bookmarks Bar',
  type: 'folder',
  depth: 0,
  isExpanded: false,
  childCount: 3,
};

const bookmarkItem: TreeItemData = {
  id: 'bookmark-10',
  title: 'MDN',
  url: 'https://developer.mozilla.org',
  type: 'bookmark',
  depth: 1,
  isExpanded: false,
  childCount: 0,
  parentId: 'folder-1',
};

function makeLabels(count: number): Map<number, string> {
  const pool = 'a b e f g h i j k l n o v y 1 2 3 4 5 6 7 8 9 0'.split(' ');
  const map = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    map.set(i, pool[i] || `${i}`);
  }
  return map;
}

const defaultProps = {
  pinnedTabs: [],
  allTabs: [],
  selectedIndex: -1,
  showFavicons: true,
  onSelectItem: vi.fn(),
  onPinnedTabSelect: vi.fn(),
  onTabGridSelect: vi.fn(),
  searchMode: false,
  searchQuery: '',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TreeView', () => {
  // ─── Section headers ────────────────────────────────────────────────────

  it('shows "Open Tabs" header before the first tab/group item', () => {
    const items = [groupItem, tab1, tab2];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    const headers = container.querySelectorAll('.smb-group-header');
    expect(headers).toHaveLength(1);
    expect(headers[0].textContent).toBe('Open Tabs');
  });

  it('shows "Bookmarks" header before the first folder/bookmark item', () => {
    const items = [groupItem, tab1, folderItem];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    const headers = container.querySelectorAll('.smb-group-header');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe('Open Tabs');
    expect(headers[1].textContent).toBe('Bookmarks');
  });

  it('does not show a header when section type does not change', () => {
    const items = [groupItem, tab1, tab2];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    // Only one header for the tab section
    const headers = container.querySelectorAll('.smb-group-header');
    expect(headers).toHaveLength(1);
  });

  // ─── Rendering items ──────────────────────────────────────────────────────

  it('renders all visible items as tree items', () => {
    const items = [groupItem, tab1, tab2];
    render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    expect(screen.getByText('Window 1')).toBeTruthy();
    expect(screen.getByText('Gmail')).toBeTruthy();
    expect(screen.getByText('GitHub')).toBeTruthy();
  });

  it('passes correct label to each tree item', () => {
    const items = [groupItem, tab1];
    const labels = new Map<number, string>();
    labels.set(0, 'a');
    labels.set(1, 'b');

    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={labels}
        {...defaultProps}
      />
    );
    const badges = container.querySelectorAll('.smb-label-badge:not(.smb-label-badge--action)');
    expect(badges[0].textContent).toBe('a');
    expect(badges[1].textContent).toBe('b');
  });

  // ─── Selection ────────────────────────────────────────────────────────────

  it('marks the selected item', () => {
    const items = [groupItem, tab1, tab2];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
        selectedIndex={1}
      />
    );
    const selected = container.querySelectorAll('.smb-tree-item--selected');
    expect(selected).toHaveLength(1);
  });

  // ─── onSelectItem callback ────────────────────────────────────────────────

  it('calls onSelectItem with the correct index on click', () => {
    const onSelectItem = vi.fn();
    const items = [groupItem, tab1, tab2];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
        onSelectItem={onSelectItem}
      />
    );
    // Click the second tree item (tab1, index 1)
    const treeItems = container.querySelectorAll('.smb-tree-item:not(.smb-tree-item--action)');
    (treeItems[1] as HTMLElement).click();
    expect(onSelectItem).toHaveBeenCalledWith(1);
  });

  // ─── Action divider ──────────────────────────────────────────────────────

  it('renders the action divider', () => {
    const items = [groupItem];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    expect(container.querySelector('.smb-action-divider')).toBeTruthy();
  });

  // ─── Actions section ──────────────────────────────────────────────────────

  it('renders all 13 action items in grid and rows', () => {
    const items = [groupItem];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    const chips = container.querySelectorAll('.smb-action-chip');
    const rows = container.querySelectorAll('.smb-action-row');
    expect(chips.length + rows.length).toBe(13);
  });

  it('renders all action chips with correct keys', () => {
    const items = [groupItem];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    const chips = container.querySelectorAll('.smb-action-chip .smb-label-badge');
    const keys = Array.from(chips).map((b) => b.textContent);
    expect(keys).toEqual(['c', 'x', 'p', 'm', 'd', 'w', 'r', 't', 'z', 'q', 's', 'u', ',']);
  });

  it('renders action labels', () => {
    const items: TreeItemData[] = [];
    render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(0)}
        {...defaultProps}
      />
    );
    expect(screen.getByText('Close')).toBeTruthy();
    expect(screen.getByText('Pin')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  it('renders with no visible items (just actions)', () => {
    const items: TreeItemData[] = [];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(0)}
        {...defaultProps}
      />
    );
    const treeItems = container.querySelectorAll('.smb-tree-item');
    expect(treeItems).toHaveLength(0);
    const chips = container.querySelectorAll('.smb-action-chip');
    const rows = container.querySelectorAll('.smb-action-row');
    expect(chips.length + rows.length).toBe(13);
  });

  // ─── Listbox role ─────────────────────────────────────────────────────────

  it('has role="listbox" on the container', () => {
    const items = [groupItem];
    render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  // ─── Search mode ──────────────────────────────────────────────────────────

  it('hides label badges in search mode', () => {
    const items = [tab1];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
        searchMode={true}
      />
    );
    // When searchMode=true, label badges are hidden entirely
    const badge = container.querySelector('.smb-label-badge');
    // Only action badges in the actions grid should remain
    const treeBadges = container.querySelectorAll('.smb-tree-item .smb-label-badge');
    expect(treeBadges).toHaveLength(0);
  });

  // ─── Mixed sections (tabs then bookmarks) ────────────────────────────────

  it('renders correct headers for mixed tab and bookmark sections', () => {
    const items = [groupItem, tab1, folderItem, bookmarkItem];
    const { container } = render(
      <TreeView
        visibleItems={items}
        labels={makeLabels(items.length)}
        {...defaultProps}
      />
    );
    const headers = container.querySelectorAll('.smb-group-header');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe('Open Tabs');
    expect(headers[1].textContent).toBe('Bookmarks');
  });
});
