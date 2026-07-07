import React from 'react';
import type { UserSettings } from '../../lib/messaging';

export interface FaviconSettingProps {
  settings: UserSettings;
  onUpdate: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

export const FaviconSetting: React.FC<FaviconSettingProps> = ({ settings, onUpdate }) => {
  return (
    <div className="smb-settings-section">
      <h2 className="smb-settings-section-title">Favicons</h2>
      <p className="smb-settings-section-desc">Show website icons next to search results</p>
      <div className="smb-settings-toggle-group">
        <label className="smb-settings-toggle-label">
          <span className="smb-settings-toggle-text">Show favicons</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.showFavicons}
            className={`smb-settings-toggle ${
              settings.showFavicons ? 'smb-settings-toggle--on' : ''
            }`}
            onClick={() => onUpdate('showFavicons', !settings.showFavicons)}
          >
            <span className="smb-settings-toggle-thumb" />
          </button>
        </label>
      </div>
    </div>
  );
};
