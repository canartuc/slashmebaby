import { useEffect } from 'react';
import { routePaletteKey } from '../../lib/palette-keys';

/**
 * Translates native keydown events on the popup document into the
 * `smb-keydown` CustomEvents CommandBar consumes — the popup counterpart of
 * the content script's shadow-DOM forwarder. Every key behaves exactly as
 * in the overlay (strict surface parity); the only popup-specific mapping
 * is Escape → window.close(), the popup's dismissal. No isTrusted
 * filtering: this is our own extension page, and jsdom's synthetic events
 * must work in tests.
 */
export function usePopupKeySource(onDismiss: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      const decision = routePaletteKey(e, { activeElement });
      if (decision.kind === 'dismiss') {
        e.preventDefault();
        onDismiss();
        return;
      }
      if (decision.kind === 'forward') {
        e.preventDefault();
        e.stopPropagation();
        document.dispatchEvent(
          new CustomEvent('smb-keydown', {
            detail: { key: decision.key, shiftKey: decision.shiftKey },
          })
        );
      }
      // 'pass': the native <input> handles the keystroke.
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onDismiss]);
}
