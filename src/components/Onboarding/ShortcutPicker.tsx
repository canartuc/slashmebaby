import React from 'react';

export interface ShortcutPickerProps {
  selectedShortcut: string;
  onSelect: (shortcut: string) => void;
}

const SHORTCUT_OPTIONS = [
  { value: 'Alt+Space', label: 'Alt + Space', description: 'Quick and universal' },
  { value: 'Ctrl+Shift+L', label: 'Ctrl + Shift + L', description: 'Familiar for launcher users' },
  { value: 'Ctrl+.', label: 'Ctrl + .', description: 'Fast single-hand access' },
  { value: 'Ctrl+/', label: 'Ctrl + /', description: 'Common command shortcut' },
] as const;

export const ShortcutPicker: React.FC<ShortcutPickerProps> = ({ selectedShortcut, onSelect }) => {
  return (
    <div className="smb-onboarding-step">
      <h2 className="smb-onboarding-step-title">Pick your shortcut</h2>
      <p className="smb-onboarding-step-desc">
        Choose a keyboard shortcut to summon the command bar. You can change this later in settings.
      </p>
      <div className="smb-onboarding-shortcut-grid">
        {SHORTCUT_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`smb-onboarding-shortcut-option ${
              selectedShortcut === option.value ? 'smb-onboarding-shortcut-option--selected' : ''
            }`}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            <span className="smb-onboarding-shortcut-key">{option.label}</span>
            <span className="smb-onboarding-shortcut-desc">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
