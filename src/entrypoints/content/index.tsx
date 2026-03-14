import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from '../../styles/command-bar.css?inline';
import { App } from './App';
import { DEFAULT_SETTINGS } from '../../lib/messaging';

// Parse a shortcut string like "Command+Shift+Space" into key parts
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

    // Load user's configured shortcut
    chrome.storage.sync.get('settings', (result) => {
      if (result.settings?.shortcut) {
        currentShortcut = result.settings.shortcut;
      }
    });

    // Listen for settings changes in real-time
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings?.newValue?.shortcut) {
        currentShortcut = changes.settings.newValue.shortcut;
      }
    });

    const toggle = () => {
      if (root) {
        root.unmount();
        root = null;
      } else {
        root = createRoot(mountPoint);
        root.render(<App onDismiss={() => { root?.unmount(); root = null; }} />);
      }
    };

    // Listen for keyboard shortcut directly on the page
    document.addEventListener('keydown', (e) => {
      if (matchesShortcut(e, currentShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    }, true); // capture phase to beat other handlers

    // Also listen for toggle from background (chrome.commands)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TOGGLE_OVERLAY') {
        toggle();
      }
    });
  },
});
