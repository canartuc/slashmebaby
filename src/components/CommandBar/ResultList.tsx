import React from 'react';
import type { ResultGroup, SearchResultItem } from '../../lib/messaging';
import { GroupHeader } from './GroupHeader';
import { ResultItem } from './ResultItem';

export interface ResultListProps {
  groups: ResultGroup[];
  selectedIndex: number;
  showFavicons: boolean;
  onSelectItem: (item: SearchResultItem) => void;
}

export const ResultList: React.FC<ResultListProps> = ({
  groups,
  selectedIndex,
  showFavicons,
  onSelectItem,
}) => {
  let flatIndex = 0;

  return (
    <div className="smb-results" role="listbox" id="slashmebaby-results">
      {groups.map((group) => (
        <div key={group.category} className="smb-result-group">
          <GroupHeader category={group.category} />
          {group.items.map((item) => {
            const currentIndex = flatIndex++;
            return (
              <ResultItem
                key={item.id}
                item={item}
                isSelected={currentIndex === selectedIndex}
                showFavicons={showFavicons}
                onSelect={() => onSelectItem(item)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};
