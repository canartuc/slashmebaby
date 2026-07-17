import React, { useEffect, useState } from 'react';

const PIN_POLL_INTERVAL_MS = 1500;

/**
 * Onboarding step asking the user to pin the extension icon — the palette's
 * entry point on pages where the keyboard shortcut opens the popup.
 * Instructions are browser-specific via the WXT build-time constant; the
 * live "Pinned" confirmation polls chrome.action.getUserSettings, which is
 * feature-detected (absent on the Firefox MV2 build — its action namespace
 * is browserAction, and getUserSettings needs Firefox 117+ once the build
 * migrates to MV3).
 */
export const PinToToolbarStep: React.FC = () => {
  // Read at render time, not module scope — Vitest stubs import.meta.env
  // per test and a module-level const would freeze the Chrome branch.
  const isFirefox = import.meta.env.BROWSER === 'firefox';
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const action = (
      chrome as unknown as {
        action?: { getUserSettings?: () => Promise<{ isOnToolbar?: boolean }> };
      }
    ).action;
    const getUserSettings = action?.getUserSettings?.bind(action);
    if (!getUserSettings) return;

    let cancelled = false;
    const poll = () => {
      getUserSettings()
        .then((settings) => {
          if (!cancelled && settings?.isOnToolbar) setPinned(true);
        })
        .catch(() => undefined);
    };
    poll();
    const timer = setInterval(poll, PIN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="smb-onboarding-step">
      <h2 className="smb-onboarding-step-title">Pin it to your toolbar</h2>
      <p className="smb-onboarding-step-desc">
        Keep SlashMeBaby one click away. Pin the icon so it&apos;s always there
        when you need it — clicking it opens the palette on any page.
      </p>
      <div className="smb-onboarding-pin">
        <img
          className="smb-onboarding-pin-icon"
          src="/icon-48.png"
          alt="SlashMeBaby icon"
          width={48}
          height={48}
        />
        <ol className="smb-onboarding-pin-steps">
          {isFirefox ? (
            <>
              <li className="smb-onboarding-pin-step">
                Look for the SlashMeBaby icon in your toolbar — Firefox may
                have placed it there already
              </li>
              <li className="smb-onboarding-pin-step">
                If it&apos;s inside the Extensions panel, right-click the
                SlashMeBaby icon and choose &quot;Pin to Toolbar&quot;
              </li>
            </>
          ) : (
            <>
              <li className="smb-onboarding-pin-step">
                Click the puzzle-piece Extensions button in the toolbar
              </li>
              <li className="smb-onboarding-pin-step">
                Find SlashMeBaby and click the pushpin next to it
              </li>
            </>
          )}
        </ol>
        {/* Always mounted so the aria-live announcement fires when the text
            appears (same pattern as the palette's error strip). */}
        <p className="smb-onboarding-pin-status" aria-live="polite">
          {pinned ? 'Pinned ✓ — ready to go' : ''}
        </p>
      </div>
    </div>
  );
};
