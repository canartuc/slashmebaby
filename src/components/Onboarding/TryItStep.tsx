import React from 'react';

export interface TryItStepProps {
  shortcut: string;
}

export const TryItStep: React.FC<TryItStepProps> = ({ shortcut }) => {
  return (
    <div className="smb-onboarding-step">
      <h2 className="smb-onboarding-step-title">Try it out!</h2>
      <p className="smb-onboarding-step-desc">
        Heads up: on pages like this one, the Chrome Web Store, and chrome://
        pages the shortcut opens the palette in a toolbar popup instead of the
        in-page bar — browsers block extensions from drawing on those pages.
      </p>
      <div className="smb-onboarding-try-it">
        <div className="smb-onboarding-try-it-prompt">
          <span className="smb-onboarding-try-it-label">Switch to a regular website tab, then press</span>
          <kbd className="smb-onboarding-try-it-kbd">{shortcut.replace(/\+/g, ' + ')}</kbd>
          <span className="smb-onboarding-try-it-label">to open the command bar</span>
        </div>
        <div className="smb-onboarding-try-it-animation">
          <div className="smb-onboarding-try-it-bar" aria-hidden="true">
            <div className="smb-onboarding-try-it-bar-inner">
              Search tabs, bookmarks, actions...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
