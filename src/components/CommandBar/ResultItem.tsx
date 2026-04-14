import React, { useRef, useEffect } from 'react';
import type { SearchResultItem } from '../../lib/messaging';
import { Favicon } from './Favicon';

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
  const ref = useRef<HTMLDivElement>(null);
  const hostname = extractHostname(item.url);
  const className = [
    'smb-result-item',
    isSelected && 'smb-result-item--selected',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <div
      ref={ref}
      className={className}
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
      aria-label={item.url ? `${item.title} — ${item.url}` : item.title}
    >
      {showFavicons && <Favicon src={item.icon} size={16} />}
      <div className="smb-item-text">
        <span className="smb-title">{item.title}</span>
        {hostname && <span className="smb-url">{hostname}</span>}
      </div>
      {isSelected && <span className="smb-kbd">&#9166;</span>}
    </div>
  );
};
