import React from 'react';
import type { UserSettings } from '../../lib/messaging';

export interface SearchSourcesProps {
  settings: UserSettings;
  onUpdate: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

const SOURCE_OPTIONS: { key: keyof UserSettings['searchSources']; label: string }[] = [
  { key: 'tabs', label: 'Tabs' },
  { key: 'bookmarks', label: 'Bookmarks' },
  { key: 'history', label: 'History' },
];

export const SearchSources: React.FC<SearchSourcesProps> = ({ settings, onUpdate }) => {
  const handleToggle = (sourceKey: keyof UserSettings['searchSources']) => {
    onUpdate('searchSources', {
      ...settings.searchSources,
      [sourceKey]: !settings.searchSources[sourceKey],
    });
  };

  return (
    <div className="smb-settings-section">
      <h2 className="smb-settings-section-title">Search Sources</h2>
      <p className="smb-settings-section-desc">Choose which sources to include in search results</p>
      <div className="smb-settings-toggle-group">
        {SOURCE_OPTIONS.map((source) => (
          <label key={source.key} className="smb-settings-toggle-label">
            <span className="smb-settings-toggle-text">{source.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.searchSources[source.key]}
              className={`smb-settings-toggle ${
                settings.searchSources[source.key] ? 'smb-settings-toggle--on' : ''
              }`}
              onClick={() => handleToggle(source.key)}
            >
              <span className="smb-settings-toggle-thumb" />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
};
