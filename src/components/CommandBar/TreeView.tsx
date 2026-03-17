import React from 'react';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';
import { TreeItem } from './TreeItem';

// ─── Action definitions ─────────────────────────────────────────────────────

interface ActionDef {
  key: string;
  title: string;
  id: string;
}

// Tab actions — short labels, displayed as chip grid
const TAB_ACTIONS: ActionDef[] = [
  { key: 'c', title: 'Close', id: 'close-tab' },
  { key: 'x', title: 'Others', id: 'close-other-tabs' },
  { key: 'p', title: 'Pin', id: 'pin-tab' },
  { key: 'm', title: 'Mute', id: 'mute-tab' },
  { key: 'd', title: 'Dup', id: 'duplicate-tab' },
  { key: 'w', title: 'Window', id: 'move-to-window' },
  { key: 'r', title: 'Reload', id: 'reload-tab' },
  { key: 't', title: 'New', id: 'new-tab' },
  { key: 'z', title: 'Undo', id: 'recently-closed' },
];

// Other actions — same chip style
const OTHER_ACTIONS: ActionDef[] = [
  { key: 'q', title: 'Dedup', id: 'close-duplicates' },
  { key: 's', title: 'Sort', id: 'sort-by-domain' },
  { key: 'u', title: 'URL', id: 'go-to-url' },
  { key: ',', title: 'Settings', id: 'settings' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TreeViewProps {
  pinnedTabs: TreeItemData[];
  visibleItems: TreeItemData[];
  labels: Map<number, string>;
  selectedIndex: number;
  showFavicons: boolean;
  onSelectItem: (index: number) => void;
  onPinnedTabSelect: (tabId: number) => void;
  searchMode: boolean;
  searchQuery: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determines whether a section header should be shown before this item.
 * Returns the header text, or null if no header is needed.
 */
function getSectionHeader(
  items: TreeItemData[],
  index: number
): string | null {
  const item = items[index];
  const prev = index > 0 ? items[index - 1] : null;

  const isTabSection = item.type === 'tab' || item.type === 'group';
  const isBookmarkSection = item.type === 'bookmark' || item.type === 'folder';

  const prevIsTabSection =
    prev && (prev.type === 'tab' || prev.type === 'group');
  const prevIsBookmarkSection =
    prev && (prev.type === 'bookmark' || prev.type === 'folder');

  if (isTabSection && !prevIsTabSection) {
    return 'Open Tabs';
  }
  if (isBookmarkSection && !prevIsBookmarkSection) {
    return 'Bookmarks';
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TreeView: React.FC<TreeViewProps> = ({
  pinnedTabs,
  visibleItems,
  labels,
  selectedIndex,
  showFavicons,
  onSelectItem,
  onPinnedTabSelect,
  searchMode,
}) => {
  return (
    <div className="smb-results" role="listbox">
      {/* Pinned tabs as a grid */}
      {pinnedTabs.length > 0 && !searchMode && (
        <>
          <div className="smb-group-header">Pinned</div>
          <div className="smb-pinned-grid">
            {pinnedTabs.map((tab, i) => (
              <div
                key={tab.id}
                className="smb-pinned-tab"
                title={tab.title}
                onClick={() => tab.tabId && onPinnedTabSelect(tab.tabId)}
                role="option"
                aria-label={tab.title}
              >
                <span className="smb-pinned-number">{i + 1}</span>
                {showFavicons && tab.icon ? (
                  <img className="smb-pinned-icon" src={tab.icon} alt="" width={16} height={16} />
                ) : (
                  <span className="smb-pinned-letter">{tab.title.charAt(0).toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {visibleItems.map((item, index) => {
        const header = getSectionHeader(visibleItems, index);
        const label = labels.get(index) ?? '';
        return (
          <React.Fragment key={item.id}>
            {header && (
              <div className="smb-group-header">{header}</div>
            )}
            <TreeItem
              item={item}
              label={label}
              isSelected={selectedIndex === index}
              showFavicons={showFavicons}
              onSelect={() => onSelectItem(index)}
              searchMode={searchMode}
            />
          </React.Fragment>
        );
      })}

      {/* Action divider */}
      <div className="smb-action-divider" />

      {/* Tab actions — compact column grid */}
      <div className="smb-actions-grid">
        {TAB_ACTIONS.map((action) => (
          <div
            key={action.id}
            className="smb-action-chip"
            role="option"
            aria-label={action.title}
          >
            <span className="smb-label-badge">{action.key}</span>
            <span className="smb-action-label">{action.title}</span>
          </div>
        ))}
      </div>

      {/* Other actions — same chip style */}
      <div className="smb-actions-grid">
        {OTHER_ACTIONS.map((action) => (
          <div
            key={action.id}
            className="smb-action-chip"
            role="option"
            aria-label={action.title}
          >
            <span className="smb-label-badge">{action.key}</span>
            <span className="smb-action-label">{action.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
