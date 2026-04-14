import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from '../../styles/command-bar.css?inline';
import { App } from './App';
import { DEFAULT_SETTINGS } from '../../lib/messaging';

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
    // and inside non-http(s) schemes (chrome-error://, view-source://, etc).
    const loc = window.location;
    const proto = loc.protocol;
    if (proto !== 'http:' && proto !== 'https:' && proto !== 'file:') return;

    const host = document.createElement('div');
    host.id = 'slashmebaby-root';
    // Dataset marker makes it easy to detect + ignore from user styles.
    host.setAttribute('data-slashmebaby', '1');
    document.body.appendChild(host);

    // Closed shadow prevents page JS from reading bookmarks/tabs DOM,
    // observing keystrokes, or synthesizing events that trigger actions.
    const shadow = host.attachShadow({ mode: 'closed' });

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

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

      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
        return;
      }

      // Forward to the shadow root. We use the closed-over `shadow`
      // reference here because mode:'closed' makes host.shadowRoot null.
      // Don't intercept if a writable input is focused (search mode)
      const activeEl = shadow.activeElement as HTMLInputElement | null;
      const isSearchInputActive = activeEl?.tagName === 'INPUT' && !activeEl?.readOnly;

      // Always forward special keys
      const specialKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', '/'];
      const isSpecialKey = specialKeys.includes(e.key);

      if (isSpecialKey || !isSearchInputActive) {
        e.preventDefault();
        e.stopPropagation();
        // Normalize key to lowercase so label matching works with Shift held
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        shadow.dispatchEvent(new CustomEvent('smb-keydown', {
          detail: { key, shiftKey: e.shiftKey },
        }));
      }
    }, true);

    // Also listen for toggle from background (chrome.commands)
    chrome.runtime.onMessage.addListener((message, sender) => {
      // Only accept messages from our own extension's background.
      if (!sender || sender.id !== chrome.runtime.id) return;
      if (message && typeof message === 'object' && (message as { type?: string }).type === 'TOGGLE_OVERLAY') {
        if (root) dismiss();
        else open();
      }
    });
  },
});
