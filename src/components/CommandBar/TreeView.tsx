import React from 'react';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';
import { TreeItem } from './TreeItem';

// ─── Action definitions ─────────────────────────────────────────────────────

interface ActionDef {
  key: string;
  title: string;
  id: string;
}

const ACTIONS: ActionDef[] = [
  { key: 'c', title: 'Close Tab', id: 'close-tab' },
  { key: 'x', title: 'Close Other Tabs', id: 'close-other-tabs' },
  { key: 'p', title: 'Pin Tab', id: 'pin-tab' },
  { key: 'm', title: 'Mute Tab', id: 'mute-tab' },
  { key: 'd', title: 'Duplicate Tab', id: 'duplicate-tab' },
  { key: 'w', title: 'Move to Window', id: 'move-to-window' },
  { key: 'r', title: 'Reload Tab', id: 'reload-tab' },
  { key: 't', title: 'New Tab', id: 'new-tab' },
  { key: 'u', title: 'Go to URL', id: 'go-to-url' },
  { key: 'z', title: 'Recently Closed', id: 'recently-closed' },
  { key: 'q', title: 'Close Duplicates', id: 'close-duplicates' },
  { key: 's', title: 'Sort by Domain', id: 'sort-by-domain' },
  { key: ',', title: 'Settings', id: 'settings' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TreeViewProps {
  visibleItems: TreeItemData[];
  labels: Map<number, string>;
  selectedIndex: number;
  showFavicons: boolean;
  onSelectItem: (index: number) => void;
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
  visibleItems,
  labels,
  selectedIndex,
  showFavicons,
  onSelectItem,
  searchMode,
}) => {
  return (
    <div className="smb-tree-view" role="listbox">
      {visibleItems.map((item, index) => {
        const header = getSectionHeader(visibleItems, index);
        const label = labels.get(index) ?? '';
        return (
          <React.Fragment key={item.id}>
            {header && (
              <div className="smb-section-header">{header}</div>
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

      {/* Actions section */}
      <div className="smb-actions-section">
        {ACTIONS.map((action) => (
          <div
            key={action.id}
            className="smb-tree-item smb-tree-item--action"
            role="option"
            aria-label={action.title}
          >
            <span className="smb-label-badge smb-label-badge--action">
              {action.key}
            </span>
            <span className="smb-title">{action.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
