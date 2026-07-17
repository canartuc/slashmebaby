import { useEffect } from 'react';
import { routePaletteKey } from '../../lib/palette-keys';

/**
 * Translates native keydown events on the popup document into the
 * `smb-keydown` CustomEvents CommandBar consumes — the popup counterpart of
 * the content script's shadow-DOM forwarder. Popup-specific additions:
 * Escape and Backspace (in jump mode or on an empty query) close the popup
 * window. No isTrusted filtering: this is our own extension page, and
 * jsdom's synthetic events must work in tests.
 */
export function usePopupKeySource(onDismiss: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const input =
        activeElement instanceof HTMLInputElement && !activeElement.readOnly
          ? activeElement
          : null;

      // Backspace-close matches the shipped popup's muscle memory: one key
      // dismisses unless the user is mid-query (then it edits the query).
      if (e.key === 'Backspace' && (!input || input.value.length === 0)) {
        e.preventDefault();
        onDismiss();
        return;
      }

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
