import React from 'react';

const KEYS = [
  { keys: ['\u2191', '\u2193'], action: 'Move between results' },
  { keys: ['Tab'], action: 'Jump to next group' },
  { keys: ['Shift', 'Tab'], action: 'Jump to previous group' },
  { keys: ['Enter'], action: 'Open selected result' },
  { keys: ['Esc'], action: 'Close the command bar' },
] as const;

export const NavigationGuide: React.FC = () => {
  return (
    <div className="smb-onboarding-step">
      <h2 className="smb-onboarding-step-title">Navigate like a pro</h2>
      <p className="smb-onboarding-step-desc">
        The command bar is designed for keyboard-first navigation. Here are the shortcuts you need.
      </p>
      <div className="smb-onboarding-keys-list">
        {KEYS.map((entry, i) => (
          <div key={i} className="smb-onboarding-key-row">
            <div className="smb-onboarding-key-badges">
              {entry.keys.map((k, j) => (
                <kbd key={j} className="smb-onboarding-key-badge">{k}</kbd>
              ))}
            </div>
            <span className="smb-onboarding-key-action">{entry.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
