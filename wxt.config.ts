// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Function form so permissions/keys can vary per target browser.
  manifest: ({ browser }) => ({
    name: 'SlashMeBaby',
    description: 'Arc & Zen-style command palette for any browser. Switch tabs, search bookmarks, and run actions with a single keystroke.',
    version: '1.0.0',
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
    // Chrome 123 is the tested floor (PLAN.md 6.4).
    ...(browser === 'chrome' ? { minimum_chrome_version: '123' } : {}),
    // AMO requires data_collection_permissions for new extensions
    // (since Nov 2025). SlashMeBaby collects no data.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'slashmebaby@canartuc',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
