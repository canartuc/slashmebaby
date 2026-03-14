// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SlashMeBaby',
    description: 'Arc & Zen-style command palette for any browser. Switch tabs, search bookmarks, and run actions with a single keystroke.',
    version: '1.0.0',
    permissions: ['tabs', 'bookmarks', 'history', 'storage', 'activeTab', 'sessions', 'commands'],
    action: {
      default_popup: 'popup/index.html',
      default_title: 'SlashMeBaby',
    },
    commands: {
      'toggle-command-bar': {
        suggested_key: {
          default: 'Alt+Space',
        },
        description: 'Open SlashMeBaby command bar',
      },
    },
  },
});
