import React from 'react';
import type { SearchResultItem } from '../../lib/messaging';

export interface ResultItemProps {
  item: SearchResultItem;
  isSelected: boolean;
  showFavicons: boolean;
  onSelect: () => void;
}

/**
 * Extracts hostname from a URL string, returns empty string on failure.
 */
function extractHostname(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export const ResultItem: React.FC<ResultItemProps> = ({
  item,
  isSelected,
  showFavicons,
  onSelect,
}) => {
  const hostname = extractHostname(item.url);
  const className = [
    'smb-result-item',
    isSelected && 'smb-result-item--selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
      aria-label={item.url ? `${item.title} — ${item.url}` : item.title}
    >
      {showFavicons && item.icon && (
        <img
          className="smb-favicon"
          src={item.icon}
          alt=""
          width={16}
          height={16}
        />
      )}
      <div className="smb-item-text">
        <span className="smb-title">{item.title}</span>
        {hostname && <span className="smb-url">{hostname}</span>}
      </div>
      {isSelected && <span className="smb-kbd">&#9166;</span>}
    </div>
  );
};
