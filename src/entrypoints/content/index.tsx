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
  main() {
    const host = document.createElement('div');
    host.id = 'slashmebaby-root';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    let root: ReturnType<typeof createRoot> | null = null;
    let currentShortcut = DEFAULT_SETTINGS.shortcut;

    chrome.storage.sync.get('settings', (result) => {
      if (result.settings?.shortcut) {
        currentShortcut = result.settings.shortcut;
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings?.newValue?.shortcut) {
        currentShortcut = changes.settings.newValue.shortcut;
      }
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

      // Forward to shadow DOM — the CommandBar decides what to do based on mode
      const shadowRoot = host.shadowRoot;
      if (shadowRoot) {
        // Don't intercept if a writable input is focused (search mode)
        const activeEl = shadowRoot.activeElement as HTMLInputElement | null;
        const isSearchInputActive = activeEl?.tagName === 'INPUT' && !activeEl?.readOnly;

        // Always forward special keys
        const specialKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', '/'];
        const isSpecialKey = specialKeys.includes(e.key);

        if (isSpecialKey || !isSearchInputActive) {
          e.preventDefault();
          e.stopPropagation();
          // Normalize key to lowercase so label matching works with Shift held
          const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
          shadowRoot.dispatchEvent(new CustomEvent('smb-keydown', {
            detail: { key, shiftKey: e.shiftKey },
          }));
        }
      }
    }, true);

    // Also listen for toggle from background (chrome.commands)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TOGGLE_OVERLAY') {
        if (root) dismiss();
        else open();
      }
    });
  },
});
