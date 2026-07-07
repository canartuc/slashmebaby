import React from 'react';
import { useSettings } from '../../hooks/useSettings';
import { ShortcutSetting } from './ShortcutSetting';
import { PositionSetting } from './PositionSetting';
import { ThemeSetting } from './ThemeSetting';
import { SearchSources } from './SearchSources';
import { MaxResultsSetting } from './MaxResultsSetting';
import { FaviconSetting } from './FaviconSetting';

export const SettingsPage: React.FC = () => {
  const { settings, updateSetting, isLoading } = useSettings();

  if (isLoading) {
    return (
      <div className="smb-settings-page">
        <div className="smb-settings-container">
          <h1 className="smb-settings-title">SlashMeBaby Settings</h1>
          <p className="smb-settings-loading">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="smb-settings-page">
      <div className="smb-settings-container">
        <h1 className="smb-settings-title">SlashMeBaby Settings</h1>
        <ShortcutSetting settings={settings} onUpdate={updateSetting} />
        <PositionSetting settings={settings} onUpdate={updateSetting} />
        <ThemeSetting settings={settings} onUpdate={updateSetting} />
        <SearchSources settings={settings} onUpdate={updateSetting} />
        <MaxResultsSetting settings={settings} onUpdate={updateSetting} />
        <FaviconSetting settings={settings} onUpdate={updateSetting} />
      </div>
    </div>
  );
};
