import React from 'react';
import type { UserSettings } from '../../lib/messaging';

export interface PositionSettingProps {
  settings: UserSettings;
  onUpdate: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

const POSITION_OPTIONS: { value: UserSettings['position']; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

export const PositionSetting: React.FC<PositionSettingProps> = ({ settings, onUpdate }) => {
  return (
    <div className="smb-settings-section">
      <h2 className="smb-settings-section-title">Command Bar Position</h2>
      <p className="smb-settings-section-desc">Where the command bar appears on screen</p>
      <div className="smb-settings-radio-group smb-settings-position-group">
        {POSITION_OPTIONS.map((option) => (
          <label key={option.value} className="smb-settings-position-label">
            <input
              type="radio"
              name="position"
              value={option.value}
              checked={settings.position === option.value}
              onChange={() => onUpdate('position', option.value)}
              className="smb-settings-radio"
            />
            <div
              className={`smb-settings-position-preview ${
                settings.position === option.value ? 'smb-settings-position-preview--selected' : ''
              }`}
            >
              <div className="smb-settings-position-screen">
                <div className={`smb-settings-position-bar smb-settings-position-bar--${option.value}`} />
              </div>
              <span className="smb-settings-position-text">{option.label}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
