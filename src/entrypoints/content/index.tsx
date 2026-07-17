import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from '../../styles/command-bar.css?inline';
import { App } from './App';
import { DEFAULT_SETTINGS, isToggleOverlayCommand } from '../../lib/messaging';
import { isInjectableUrl } from '../../lib/url-safety';
import { routePaletteKey } from '../../lib/palette-keys';

function parseShortcut(shortcut: string) {
  const parts = shortcut.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('command') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    key: parts[parts.length - 1],
  };
}

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  const eventKey = e.key === ' ' ? 'space' : e.key.toLowerCase();
  return (
    e.ctrlKey === parsed.ctrl &&
    e.metaKey === parsed.meta &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt &&
    eventKey === parsed.key
  );
}

export default defineContentScript({
  matches: ['<all_urls>'],
  // Do not inject into opaque/extension origin documents.
  runAt: 'document_idle',
  main() {
    // Skip injection inside cross-origin iframes that can't host overlay safely,
    // and inside non-http(s)/file schemes (chrome-error://, view-source://, etc).
    // Shares the predicate with the background's per-tab action routing so
    // both sides always agree on where the overlay can exist.
    if (!isInjectableUrl(window.location.href)) return;

    const host = document.createElement('div');
    host.id = 'slashmebaby-root';
    // Dataset marker makes it easy to detect + ignore from user styles.
    host.setAttribute('data-slashmebaby', '1');
    document.body.appendChild(host);

    // Open shadow: primary isolation comes from the isolated content-script
    // world (page JS cannot reach our listeners). Closed mode added no
    // meaningful barrier since page JS can override Element.prototype.attachShadow
    // before document_idle, and it breaks introspection in E2E tests.
    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    // Contain keyboard events inside the palette. The search box is a native
    // <input>, so its keystrokes would otherwise bubble out of the shadow tree
    // to the host page — where many sites focus their own search field on
    // keypress (type-to-focus) and steal focus mid-search, breaking input.
    // Stopping propagation at the shadow boundary keeps native typing (and
    // paste/IME/cursor) working while the page's key listeners never fire.
    // Navigation keys are already blocked at the document-capture listener
    // below and never reach here.
    const containKeyEvent = (e: Event) => e.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup']) {
      shadow.addEventListener(type, containKeyEvent);
    }

    let root: ReturnType<typeof createRoot> | null = null;
    let currentShortcut = DEFAULT_SETTINGS.shortcut;

    const extractShortcut = (value: unknown): string | null => {
      if (value && typeof value === 'object') {
        const candidate = (value as { shortcut?: unknown }).shortcut;
        if (typeof candidate === 'string' && candidate.length > 0) return candidate;
      }
      return null;
    };

    chrome.storage.sync.get('settings', (result) => {
      const found = extractShortcut((result as { settings?: unknown }).settings);
      if (found) currentShortcut = found;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const found = extractShortcut(changes.settings?.newValue);
      if (found) currentShortcut = found;
    });

    const dismiss = () => {
      if (root) {
        root.unmount();
        root = null;
      }
    };

    const open = () => {
      if (!root) {
        root = createRoot(mountPoint);
        root.render(<App onDismiss={dismiss} />);
      }
    };

    // ALL keyboard handling happens here on the real document,
    // NOT inside Shadow DOM or React. This is the only reliable way.
    document.addEventListener('keydown', (e) => {
      // Reject synthetic keyboard events dispatched by the host page.
      // Real user keystrokes always have isTrusted === true.
      if (!e.isTrusted) return;

      // Activation shortcut
      if (matchesShortcut(e, currentShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        if (root) {
          dismiss();
        } else {
          open();
        }
        return;
      }

      // Everything below only applies when overlay is open
      if (!root) return;

      const decision = routePaletteKey(e, { activeElement: shadow.activeElement });
      if (decision.kind === 'dismiss') {
        e.preventDefault();
        dismiss();
        return;
      }
      if (decision.kind === 'forward') {
        e.preventDefault();
        e.stopPropagation();
        shadow.dispatchEvent(new CustomEvent('smb-keydown', {
          detail: { key: decision.key, shiftKey: decision.shiftKey },
        }));
      }
      // 'pass': let the native <input> handle the keystroke.
    }, true);

    // Also listen for toggle from background (chrome.commands)
    chrome.runtime.onMessage.addListener((message, sender) => {
      // Only accept messages from our own extension's background.
      if (!sender || sender.id !== chrome.runtime.id) return;
      if (isToggleOverlayCommand(message)) {
        if (root) dismiss();
        else open();
      }
    });
  },
});
