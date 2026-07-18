// Key-routing decisions for an open palette. Extracted from the content
// script so the action popup (a plain extension page without the shadow-DOM
// forwarder) can reuse the exact same rules. Host-specific concerns —
// isTrusted filtering, the activation shortcut, and where the forwarded
// event is dispatched — stay with each host.

export interface PaletteKeyContext {
  /** The element that currently has focus inside the palette:
   *  shadow.activeElement (overlay) or document.activeElement (popup). */
  activeElement: Element | null;
}

export type PaletteKeyDecision =
  | { kind: 'dismiss' }
  | { kind: 'forward'; key: string; shiftKey: boolean }
  | { kind: 'pass' };

const NAVIGATION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'];

export function routePaletteKey(e: KeyboardEvent, ctx: PaletteKeyContext): PaletteKeyDecision {
  // Browser chords (Ctrl/Cmd/Alt + key) are never palette keys — routing
  // them would turn Ctrl+C into the close-tab action. Shift stays allowed:
  // Shift+Enter, Shift+Tab, and shifted labels are palette gestures.
  if (e.ctrlKey || e.metaKey || e.altKey) return { kind: 'pass' };

  // Bare modifier keydowns are not palette keys either — forwarding the
  // 'Shift' keydown that precedes a shifted combo character would burn an
  // armed two-char label prefix.
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
    return { kind: 'pass' };
  }

  if (e.key === 'Escape') return { kind: 'dismiss' };

  // Don't intercept typing when a writable input is focused (search mode).
  const activeEl = ctx.activeElement as HTMLInputElement | null;
  const isSearchInputActive = activeEl?.tagName === 'INPUT' && !activeEl?.readOnly;

  // '/' toggles jump/search mode, but while a non-empty query is being
  // typed it must stay typeable as literal text — path-bearing go-to-URL
  // queries like "example.com/admin" (F10) die at the '/' otherwise. So
  // it only acts as the toggle when the search input isn't focused or is
  // still empty; in every other case it falls through to the native input.
  const slashTogglesMode =
    e.key === '/' && (!isSearchInputActive || (activeEl?.value.length ?? 0) === 0);

  const isSpecialKey = NAVIGATION_KEYS.includes(e.key) || slashTogglesMode;

  if (isSpecialKey || !isSearchInputActive) {
    // Normalize key to lowercase so label matching works with Shift held.
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return { kind: 'forward', key, shiftKey: e.shiftKey };
  }
  return { kind: 'pass' };
}
