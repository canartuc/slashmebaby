// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Function form so permissions/keys can vary per target browser.
  manifest: ({ browser }) => ({
    name: 'SlashMeBaby',
    description: 'A keyboard-driven command palette for your browser. Switch tabs, search bookmarks and history, and run actions in one keystroke.',
    version: '1.1.1',
    // Note: "commands" is a manifest key, not a permission, and "activeTab"
    // is unused (no executeScript/captureVisibleTab/insertCSS anywhere).
    // "tabGroups" is Chrome-only — Firefox rejects it, and the background's
    // F28 tab-group enrichment feature-detects chrome.tabGroups at runtime.
    permissions: [
      'tabs',
      'bookmarks',
      'history',
      'storage',
      'sessions',
      ...(browser === 'chrome' ? ['tabGroups'] : []),
    ],
    host_permissions: ['<all_urls>'],
    options_ui: {
      page: 'settings.html',
      open_in_tab: true,
    },
    action: {
      default_popup: 'popup/index.html',
      default_title: 'SlashMeBaby',
    },
    commands: {
      'toggle-command-bar': {
        suggested_key: {
          default: 'Ctrl+Shift+Space',
          mac: 'Command+Shift+Space',
        },
        description: 'Open SlashMeBaby command bar',
      },
    },
    // Chrome 127 is the floor because chrome.action.openPopup() — the
    // restricted-page fallback for the keyboard shortcut — is undefined for
    // normal installs on earlier versions (118-126 exposed it to
    // policy-installed extensions only).
    ...(browser === 'chrome' ? { minimum_chrome_version: '127' } : {}),
    // AMO requires data_collection_permissions for new extensions
    // (since Nov 2025). SlashMeBaby collects no data.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'slashmebaby@canartuc',
              // Firefox 126 is the floor: commands.onCommand only passes the
              // active tab from 126, and the handler needs it to call
              // openPopup synchronously (user-input rule before Firefox 149).
              strict_min_version: '126.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
