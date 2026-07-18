import React from 'react';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';
import { TreeItem } from './TreeItem';
import { Favicon } from './Favicon';
import { sectionOf } from '../../lib/palette-sections';

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
  { key: 'u', title: 'Copy', id: 'copy-clean-link' },
  { key: ',', title: 'Settings', id: 'settings' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TreeViewProps {
  pinnedTabs: TreeItemData[];
  allTabs: TreeItemData[];
  visibleItems: TreeItemData[];
  labels: Map<number, string>;
  selectedIndex: number;
  showFavicons: boolean;
  onSelectItem: (index: number) => void;
  onPinnedTabSelect: (tabId: number) => void;
  onTabGridSelect: (tabId: number) => void;
  searchMode: boolean;
  searchQuery: string;
  /** Non-interactive line shown when the item list is empty (e.g. actions failed to load). */
  emptyStateMessage?: string;
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
  const section = sectionOf(items[index]);
  if (!section) return null;
  const prevSection = index > 0 ? sectionOf(items[index - 1]) : null;
  return section !== prevSection ? section : null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TreeView: React.FC<TreeViewProps> = ({
  pinnedTabs,
  allTabs,
  visibleItems,
  labels,
  selectedIndex,
  showFavicons,
  onSelectItem,
  onPinnedTabSelect,
  onTabGridSelect,
  searchMode,
  emptyStateMessage,
}) => {
  // Build label map for tab grid (uses dynamic labels from the main pool)
  const tabGridLabels = new Map<number, string>();
  labels.forEach((label, index) => {
    // Map grid index to label — tabs in grid get first N labels
    if (index < allTabs.length) {
      tabGridLabels.set(index, label);
    }
  });

  return (
    <div className="smb-results" role="listbox" id="slashmebaby-results">
      {/* Pinned tabs as numbered squares */}
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
                  <Favicon src={tab.icon} size={16} className="smb-pinned-icon" />
                ) : (
                  <span className="smb-pinned-letter">{(tab.siteName || tab.title.charAt(0)).charAt(0).toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* All tabs as two-column list */}
      {allTabs.length > 0 && !searchMode && (
        <>
          <div className="smb-group-header">Open Tabs</div>
          <div className="smb-tab-columns">
            {allTabs.map((tab, i) => {
              const label = labels.get(i) ?? '';
              return (
                <div
                  key={tab.id}
                  className="smb-tab-col-item"
                  title={tab.title}
                  onClick={() => tab.tabId && onTabGridSelect(tab.tabId)}
                  role="option"
                  aria-label={tab.title}
                >
                  {label && <span className="smb-tab-col-label">{label}</span>}
                  {showFavicons && <Favicon src={tab.icon} size={14} />}
                  <span className="smb-tab-col-title">{tab.title}</span>
                  {tab.discarded && (
                    <span
                      className="smb-sleep-badge"
                      title="Sleeping tab — wakes on switch"
                      aria-hidden="true"
                    >
                      {'\u23FE'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bookmarks tree — labels offset by tab count */}
      {visibleItems.map((item, index) => {
        const header = getSectionHeader(visibleItems, index);
        const label = labels.get(allTabs.length + index) ?? '';
        return (
          <React.Fragment key={item.id}>
            {header && (
              <div className="smb-group-header">{header}</div>
            )}
            <TreeItem
              item={item}
              index={index}
              label={label}
              isSelected={selectedIndex === index}
              showFavicons={showFavicons}
              onSelect={onSelectItem}
              searchMode={searchMode}
            />
          </React.Fragment>
        );
      })}

      {/* Empty-state explanation (e.g. '>' mode when actions failed to load) */}
      {visibleItems.length === 0 && emptyStateMessage && (
        <div className="smb-empty-folder" role="presentation">
          {emptyStateMessage}
        </div>
      )}

      {/* Action divider */}
      <div className="smb-action-divider" />

      {/* All actions in one grid */}
      <div className="smb-actions-grid">
        {[...TAB_ACTIONS, ...OTHER_ACTIONS].map((action) => (
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
