import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import { getOnboardingState, saveOnboardingState } from '../../lib/storage';
import { saveSettings, getSettings } from '../../lib/storage';
import { ShortcutPicker } from './ShortcutPicker';
import { TryItStep } from './TryItStep';
import { NavigationGuide } from './NavigationGuide';
import { CompletionStep } from './CompletionStep';

const TOTAL_STEPS = 4;

export const OnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [shortcut, setShortcut] = useState(DEFAULT_SETTINGS.shortcut);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing progress on mount
  useEffect(() => {
    let cancelled = false;

    Promise.all([getOnboardingState(), getSettings()]).then(([onboarding, settings]) => {
      if (cancelled) return;
      setCurrentStep(onboarding.completedStep);
      setShortcut(settings.shortcut);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNext = useCallback(() => {
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    saveOnboardingState({ completedStep: nextStep, completed: false });
  }, [currentStep]);

  const handleShortcutSelect = useCallback(
    (newShortcut: string) => {
      setShortcut(newShortcut);
      // Also persist shortcut to user settings
      getSettings().then((settings) => {
        saveSettings({ ...settings, shortcut: newShortcut });
      });
    },
    []
  );

  const handleComplete = useCallback(() => {
    saveOnboardingState({ completedStep: TOTAL_STEPS, completed: true });
    // Close the tab or navigate away
    window.close();
  }, []);

  if (isLoading) {
    return (
      <div className="smb-onboarding-page">
        <div className="smb-onboarding-container">
          <p className="smb-onboarding-loading">Loading...</p>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <ShortcutPicker selectedShortcut={shortcut} onSelect={handleShortcutSelect} />;
      case 1:
        return <TryItStep shortcut={shortcut} />;
      case 2:
        return <NavigationGuide />;
      case 3:
        return <CompletionStep onComplete={handleComplete} />;
      default:
        return <CompletionStep onComplete={handleComplete} />;
    }
  };

  return (
    <div className="smb-onboarding-page">
      <div className="smb-onboarding-container">
        <div className="smb-onboarding-header">
          <h1 className="smb-onboarding-title">SlashMeBaby</h1>
          <div className="smb-onboarding-progress">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`smb-onboarding-dot ${
                  i === currentStep ? 'smb-onboarding-dot--active' : ''
                } ${i < currentStep ? 'smb-onboarding-dot--completed' : ''}`}
              />
            ))}
          </div>
        </div>
        {renderStep()}
        {currentStep < TOTAL_STEPS - 1 && (
          <div className="smb-onboarding-footer">
            <button
              className="smb-onboarding-next-btn"
              onClick={handleNext}
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
