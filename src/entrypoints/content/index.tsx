import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from '../../styles/command-bar.css?inline';
import { App } from './App';

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

    const dismiss = () => {
      if (root) {
        root.unmount();
        root = null;
      }
    };

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TOGGLE_OVERLAY') {
        if (root) {
          dismiss();
        } else {
          root = createRoot(mountPoint);
          root.render(<App onDismiss={dismiss} />);
        }
      }
    });
  },
});
