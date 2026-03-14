import React from 'react';

export interface CompletionStepProps {
  onComplete: () => void;
}

export const CompletionStep: React.FC<CompletionStepProps> = ({ onComplete }) => {
  return (
    <div className="smb-onboarding-step">
      <h2 className="smb-onboarding-step-title">You're all set!</h2>
      <p className="smb-onboarding-step-desc">
        Here are a few pro tips to get the most out of SlashMeBaby.
      </p>
      <div className="smb-onboarding-tips">
        <div className="smb-onboarding-tip">
          <span className="smb-onboarding-tip-icon">&gt;</span>
          <div className="smb-onboarding-tip-content">
            <strong>Use the &gt; prefix</strong>
            <span>Type &gt; to filter to actions only</span>
          </div>
        </div>
        <div className="smb-onboarding-tip">
          <span className="smb-onboarding-tip-icon">&#9201;</span>
          <div className="smb-onboarding-tip-content">
            <strong>Recency matters</strong>
            <span>Recently visited tabs and pages rank higher</span>
          </div>
        </div>
        <div className="smb-onboarding-tip">
          <span className="smb-onboarding-tip-icon">&#9881;</span>
          <div className="smb-onboarding-tip-content">
            <strong>Customize in settings</strong>
            <span>Change theme, position, and search sources anytime</span>
          </div>
        </div>
      </div>
      <button
        className="smb-onboarding-complete-btn"
        onClick={onComplete}
        type="button"
      >
        Start Browsing
      </button>
    </div>
  );
};
