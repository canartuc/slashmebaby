import React from 'react';
import type { UserSettings } from '../../lib/messaging';

export interface ThemeSettingProps {
  settings: UserSettings;
  onUpdate: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

const THEME_OPTIONS: { value: UserSettings['theme']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export const ThemeSetting: React.FC<ThemeSettingProps> = ({ settings, onUpdate }) => {
  return (
    <div className="smb-settings-section">
      <h2 className="smb-settings-section-title">Theme</h2>
      <p className="smb-settings-section-desc">Choose the appearance of the command bar</p>
      <div className="smb-settings-radio-group">
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className="smb-settings-radio-label">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={settings.theme === option.value}
              onChange={() => onUpdate('theme', option.value)}
              className="smb-settings-radio"
            />
            <span className="smb-settings-radio-indicator" />
            <span className="smb-settings-radio-text">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
