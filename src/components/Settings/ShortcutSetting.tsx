import React from 'react';
import type { UserSettings } from '../../lib/messaging';

export interface ShortcutSettingProps {
  settings: UserSettings;
  onUpdate: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

const SHORTCUT_OPTIONS = [
  { value: 'Alt+Space', label: 'Alt + Space' },
  { value: 'Ctrl+Shift+L', label: 'Ctrl + Shift + L' },
  { value: 'Ctrl+.', label: 'Ctrl + .' },
  { value: 'Ctrl+/', label: 'Ctrl + /' },
] as const;

export const ShortcutSetting: React.FC<ShortcutSettingProps> = ({ settings, onUpdate }) => {
  return (
    <div className="smb-settings-section">
      <h2 className="smb-settings-section-title">Keyboard Shortcut</h2>
      <p className="smb-settings-section-desc">Choose how to open the command bar</p>
      <div className="smb-settings-radio-group">
        {SHORTCUT_OPTIONS.map((option) => (
          <label key={option.value} className="smb-settings-radio-label">
            <input
              type="radio"
              name="shortcut"
              value={option.value}
              checked={settings.shortcut === option.value}
              onChange={() => onUpdate('shortcut', option.value)}
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
