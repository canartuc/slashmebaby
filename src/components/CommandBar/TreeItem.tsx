import React, { useRef, useEffect } from 'react';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';
import { LabelBadge } from './LabelBadge';

export interface TreeItemProps {
  item: TreeItemData;
  label: string;
  isSelected: boolean;
  showFavicons: boolean;
  onSelect: () => void;
  searchMode: boolean;
}

export const TreeItem: React.FC<TreeItemProps> = ({
  item,
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
    el.addEventListener('click', onSelect);
    return () => {
      el.removeEventListener('click', onSelect);
    };
  }, [onSelect]);

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
      aria-label={item.title}
      style={{ paddingLeft: 16 + item.depth * 16 }}
    >
      <LabelBadge label={label} dimmed={searchMode} />

      {isFolder && (
        <span className="smb-folder-indicator">
          {item.isExpanded ? '\u25BE' : '\u25B8'}
        </span>
      )}

      {showFavicons && item.icon && (
        <img
          className="smb-favicon"
          src={item.icon}
          alt=""
          width={16}
          height={16}
        />
      )}

      <span className="smb-title">{item.title}</span>

      {isFolder && (
        <span className="smb-child-count">({item.childCount})</span>
      )}

      {isSelected && <span className="smb-kbd">&#9166;</span>}
    </div>
  );
};
