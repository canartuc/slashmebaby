import React from 'react';

/* Hibernated-tab marker. Plain "zzz" text, not U+23FE — the power-sleep
   glyph is missing from common Windows/Linux system fonts and renders as
   tofu there. aria-hidden: the row's aria-label carries the state (see
   sleepAriaLabel), so the badge is decoration to assistive tech. */
export function SleepBadge() {
  return (
    <span className="smb-sleep-badge" title="Sleeping tab — wakes on switch" aria-hidden="true">
      zzz
    </span>
  );
}

export function sleepAriaLabel(title: string, discarded: boolean | undefined): string {
  return discarded ? `${title} (sleeping)` : title;
}
