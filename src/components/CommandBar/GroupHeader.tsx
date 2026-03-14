import React from 'react';
import type { Source } from '../../lib/messaging';

export interface GroupHeaderProps {
  category: Source;
}

const CATEGORY_LABELS: Record<Source, string> = {
  tabs: 'Open Tabs',
  bookmarks: 'Bookmarks',
  history: 'History',
  actions: 'Actions',
};

export const GroupHeader: React.FC<GroupHeaderProps> = ({ category }) => {
  return (
    <div className="smb-group-header" role="presentation">
      {CATEGORY_LABELS[category]}
    </div>
  );
};
