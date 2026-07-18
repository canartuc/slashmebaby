// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
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

const discardedTab: TreeItemData = {
  id: 'tab-103',
  title: 'Sleeping Docs',
  url: 'https://sleep.example',
  type: 'tab',
  depth: 1,
  isExpanded: false,
  childCount: 0,
  parentId: 'group-Window 1',
  tabId: 103,
  discarded: true,
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

  // ─── Render stability on selection change ─────────────────────────────────

  describe('selection-change render stability', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does not reattach item click listeners when only selectedIndex changes', () => {
      const items = [groupItem, tab1, tab2, folderItem, bookmarkItem];
      const stableOnSelect = vi.fn();
      const props = {
        ...defaultProps,
        visibleItems: items,
        labels: makeLabels(items.length),
        onSelectItem: stableOnSelect,
      };

      const { rerender } = render(<TreeView {...props} selectedIndex={0} />);

      // Arrow-key navigation only changes selectedIndex. Memoized items with
      // stable callbacks must not re-run their listener effects.
      const addSpy = vi.spyOn(Element.prototype, 'addEventListener');
      rerender(<TreeView {...props} selectedIndex={1} />);

      const clickAttachments = addSpy.mock.calls.filter(([type]) => type === 'click');
      expect(clickAttachments).toHaveLength(0);
    });

    it('still calls onSelectItem with the correct index after selection changes', () => {
      const items = [groupItem, tab1, tab2];
      const onSelectItem = vi.fn();
      const props = {
        ...defaultProps,
        visibleItems: items,
        labels: makeLabels(items.length),
        onSelectItem,
      };

      const { rerender, container } = render(<TreeView {...props} selectedIndex={0} />);
      rerender(<TreeView {...props} selectedIndex={2} />);

      const treeItems = container.querySelectorAll('.smb-tree-item:not(.smb-tree-item--action)');
      (treeItems[1] as HTMLElement).click();
      expect(onSelectItem).toHaveBeenCalledWith(1);
    });
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
    // When searchMode=true, label badges are hidden entirely.
    // Only action badges in the actions grid should remain.
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

  // ─── Pinned tabs grid ─────────────────────────────────────────────────────

  it('renders pinned tabs in the pinned grid', () => {
    const pinned: TreeItemData[] = [
      { ...tab1, id: 'tab-501', tabId: 501, title: 'Pinned-A', pinned: true, siteName: 'Slack' },
      { ...tab2, id: 'tab-502', tabId: 502, title: 'Pinned-B', pinned: true, siteName: 'Linear' },
    ];
    const { container } = render(
      <TreeView
        {...defaultProps}
        pinnedTabs={pinned}
        visibleItems={[]}
        labels={makeLabels(0)}
      />
    );
    const cells = container.querySelectorAll('.smb-pinned-tab');
    expect(cells).toHaveLength(2);
    // Numbered 1, 2
    expect(container.querySelectorAll('.smb-pinned-number')[0].textContent).toBe('1');
    expect(container.querySelectorAll('.smb-pinned-number')[1].textContent).toBe('2');
  });

  it('calls onPinnedTabSelect with the tabId when a pinned cell is clicked', () => {
    const onPinnedTabSelect = vi.fn();
    const pinned: TreeItemData[] = [
      { ...tab1, id: 'tab-701', tabId: 701, title: 'Pinned-X', pinned: true },
    ];
    const { container } = render(
      <TreeView
        {...defaultProps}
        pinnedTabs={pinned}
        visibleItems={[]}
        labels={makeLabels(0)}
        onPinnedTabSelect={onPinnedTabSelect}
      />
    );
    (container.querySelector('.smb-pinned-tab') as HTMLElement).click();
    expect(onPinnedTabSelect).toHaveBeenCalledWith(701);
  });

  it('hides the pinned grid in search mode', () => {
    const pinned: TreeItemData[] = [
      { ...tab1, id: 'tab-801', tabId: 801, title: 'Pinned-X', pinned: true },
    ];
    const { container } = render(
      <TreeView
        {...defaultProps}
        pinnedTabs={pinned}
        visibleItems={[]}
        labels={makeLabels(0)}
        searchMode={true}
      />
    );
    expect(container.querySelectorAll('.smb-pinned-tab')).toHaveLength(0);
  });

  // ─── All-tabs grid ────────────────────────────────────────────────────────

  it('renders the all-tabs grid with one cell per tab', () => {
    const all: TreeItemData[] = [
      { ...tab1, id: 'tab-901', tabId: 901, title: 'Tab-A' },
      { ...tab2, id: 'tab-902', tabId: 902, title: 'Tab-B' },
    ];
    const { container } = render(
      <TreeView
        {...defaultProps}
        allTabs={all}
        visibleItems={[]}
        labels={makeLabels(2)}
      />
    );
    expect(container.querySelectorAll('.smb-tab-col-item')).toHaveLength(2);
  });

  it('calls onTabGridSelect with the tabId when an all-tabs cell is clicked', () => {
    const onTabGridSelect = vi.fn();
    const all: TreeItemData[] = [
      { ...tab1, id: 'tab-1001', tabId: 1001, title: 'Tab-A' },
    ];
    const { container } = render(
      <TreeView
        {...defaultProps}
        allTabs={all}
        visibleItems={[]}
        labels={makeLabels(1)}
        onTabGridSelect={onTabGridSelect}
      />
    );
    (container.querySelector('.smb-tab-col-item') as HTMLElement).click();
    expect(onTabGridSelect).toHaveBeenCalledWith(1001);
  });

  it('hides the all-tabs grid in search mode', () => {
    const all: TreeItemData[] = [
      { ...tab1, id: 'tab-1101', tabId: 1101, title: 'Tab-A' },
    ];
    const { container } = render(
      <TreeView
        {...defaultProps}
        allTabs={all}
        visibleItems={[]}
        labels={makeLabels(1)}
        searchMode={true}
      />
    );
    expect(container.querySelectorAll('.smb-tab-col-item')).toHaveLength(0);
  });
});


describe('TreeView — sleep badge', () => {
  it('shows a sleep badge on discarded tabs in the tab grid', () => {
    const { container } = render(
      <TreeView
        {...defaultProps}
        allTabs={[tab1, discardedTab]}
        visibleItems={[]}
        labels={makeLabels(2)}
      />
    );
    const badges = container.querySelectorAll('.smb-sleep-badge');
    expect(badges).toHaveLength(1);
    const badgedRow = badges[0].closest('.smb-tab-col-item');
    expect(badgedRow?.textContent).toContain('Sleeping Docs');
  });

  it('does not show a sleep badge on normal tabs', () => {
    const { container } = render(
      <TreeView
        {...defaultProps}
        allTabs={[tab1, tab2]}
        visibleItems={[]}
        labels={makeLabels(2)}
      />
    );
    expect(container.querySelectorAll('.smb-sleep-badge')).toHaveLength(0);
  });
});
