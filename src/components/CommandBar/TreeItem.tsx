import React, { useRef, useEffect } from 'react';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';
import { LabelBadge } from './LabelBadge';
import { Favicon } from './Favicon';
import { SleepBadge, sleepAriaLabel } from './SleepBadge';

export interface TreeItemProps {
  item: TreeItemData;
  /** Index of this item in the visible list, passed back to onSelect. */
  index: number;
  label: string;
  isSelected: boolean;
  showFavicons: boolean;
  onSelect: (index: number) => void;
  searchMode: boolean;
}

// Memoized so that arrow-key navigation (which only changes `isSelected` on
// two items) re-renders two rows instead of the whole list.
export const TreeItem: React.FC<TreeItemProps> = React.memo(({
  item,
  index,
  label,
  isSelected,
  showFavicons,
  onSelect,
  searchMode,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isFolder = item.type === 'folder' || item.type === 'group';

  const className = [
    'smb-tree-item',
    isSelected && 'smb-tree-item--selected',
    isFolder && 'smb-tree-item--folder',
  ]
    .filter(Boolean)
    .join(' ');

  // Native event listener for clicks (Shadow DOM compatible)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClick = () => onSelect(index);
    el.addEventListener('click', handleClick);
    return () => {
      el.removeEventListener('click', handleClick);
    };
  }, [onSelect, index]);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <div
      ref={ref}
      className={className}
      role="option"
      aria-selected={isSelected}
      aria-label={sleepAriaLabel(item.title, item.type === 'tab' && item.discarded)}
      style={{ paddingLeft: 16 + item.depth * 16 }}
    >
      {!searchMode && <LabelBadge label={label} />}

      {isFolder && (
        <span className="smb-folder-indicator">
          {item.isExpanded ? '\u25BE' : '\u25B8'}
        </span>
      )}

      {showFavicons && <Favicon src={item.icon} size={16} />}

      <span className="smb-title">{item.title}</span>

      {item.type === 'tab' && item.discarded && <SleepBadge />}

      {isFolder && (
        <span className="smb-child-count">({item.childCount})</span>
      )}

      {isSelected && <span className="smb-kbd">&#9166;</span>}
    </div>
  );
});

TreeItem.displayName = 'TreeItem';
