import React from 'react';
import type { UserSettings } from '../../lib/messaging';

export interface MaxResultsSettingProps {
  settings: UserSettings;
  onUpdate: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

const MAX_RESULTS_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: '3 results' },
  { value: 5, label: '5 results' },
  { value: 8, label: '8 results' },
];

export const MaxResultsSetting: React.FC<MaxResultsSettingProps> = ({ settings, onUpdate }) => {
  return (
    <div className="smb-settings-section">
      <h2 className="smb-settings-section-title">Results Per Group</h2>
      <p className="smb-settings-section-desc">
        Maximum number of results shown for each group
      </p>
      <div className="smb-settings-radio-group">
        {MAX_RESULTS_OPTIONS.map((option) => (
          <label key={option.value} className="smb-settings-radio-label">
            <input
              type="radio"
              name="maxResultsPerGroup"
              value={option.value}
              checked={settings.maxResultsPerGroup === option.value}
              onChange={() => onUpdate('maxResultsPerGroup', option.value)}
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
