# SlashMeBaby User Guide

## What is SlashMeBaby?

SlashMeBaby is a command palette for your browser. It lets you search open tabs, bookmarks, and browsing history, and run browser actions, all from a single keyboard shortcut. It works like Spotlight on macOS or the VS Code command palette, but inside your browser.

## Installation

### Chrome Web Store

1. Visit the Chrome Web Store listing for SlashMeBaby
2. Click "Add to Chrome"
3. Confirm the permissions prompt

### Firefox Add-ons

1. Visit the Firefox Add-ons listing for SlashMeBaby
2. Click "Add to Firefox"
3. Confirm the permissions prompt

### Manual Installation (Developer Mode)

See the [Developer Guide](./developer-guide.md) for instructions on loading the extension from source.

## Getting Started

When you install SlashMeBaby for the first time, an onboarding wizard opens automatically. It guides you through:

1. **Choose your shortcut.** Pick the keyboard shortcut you prefer to open the command bar.
2. **Try it out.** A short demo of how your chosen shortcut opens the command bar (press Next to continue; the shortcut works on regular web pages once you finish).
3. **Navigate results.** Learn the keyboard shortcuts for navigating the command bar.
4. **You are ready.** Pro tips and a link to settings.

After completing onboarding, you can start using SlashMeBaby on any web page.

## Features

### Tab Search

Type any part of a tab's title or URL to find it instantly. Results show the tab title, hostname, and favicon. Press Enter to switch to the selected tab.

The overlay ranks results by fuzzy match quality. In the toolbar popup, tabs are scored by a combination of fuzzy match quality and recency, so tabs you accessed recently appear higher in its results.

### Bookmark Search

Search across your entire bookmark collection. Results show the bookmark title and URL. Press Enter to navigate the current tab to the bookmark URL.

### History Search

Search the last 1,000 items from your browsing history. Results show the page title and URL. In the toolbar popup, history results are also ranked by recency (recently visited pages score higher).

### Browser Actions

SlashMeBaby includes built-in browser actions:

| Action | Description |
|--------|-------------|
| Close Tab | Close the current tab |
| Close Other Tabs | Close all tabs except the current one (preserves pinned tabs) |
| Pin Tab | Toggle the pin state of the current tab |
| Mute Tab | Toggle mute on the current tab |
| Duplicate Tab | Create a copy of the current tab |
| Move to New Window | Move the current tab to a new browser window |
| Reload Tab | Reload the current tab |
| New Tab | Open a new blank tab |
| Go to URL | Navigate to a specific URL |
| Recently Closed | Restore the most recently closed tab, or undo the palette's last tab action (single-shot; no list is shown) |
| Close Duplicate Tabs | Find and close tabs with identical URLs |
| Sort Tabs by Domain | Reorder tabs alphabetically by their domain |
| Open Settings | Open the SlashMeBaby settings page |

### Action Prefix Mode

Type `>` as the first character in the search bar to filter results to actions only. This hides tabs, bookmarks, and history results, so browser actions are faster to find and execute.

For example, type `>close` to quickly find the Close Tab, Close Other Tabs, and Close Duplicate Tabs actions.

## Keyboard Shortcuts

### Activation

| Shortcut | Description |
|----------|-------------|
| Ctrl + Shift + Space (default; Cmd + Shift + Space on macOS) | Open the command bar |

You can change the activation shortcut in Settings or via `chrome://extensions/shortcuts`.

### Navigation (inside the command bar)

| Key | Action |
|-----|--------|
| Arrow Up / Arrow Down | Move between results |
| Tab | Jump to the next result group |
| Shift + Tab | Jump to the previous result group |
| Enter | Execute the selected result |
| Escape | Close the command bar |

Backspace edits the query as normal text editing; the on-page command bar never closes on Backspace. In the toolbar-icon popup only, pressing Backspace with an empty input also closes the popup.

## Settings

Access settings by:
- Typing `>settings` in the command bar, or
- Right-clicking the extension icon and selecting "Options"

### Available Settings

- **Keyboard Shortcut**: Choose from Ctrl+Shift+Space, Ctrl+Shift+L, Ctrl+., or Ctrl+/ (on macOS: Cmd+Shift+Space, Cmd+Shift+L, Cmd+., or Cmd+/)
- **Command Bar Position**: Center (default), Top, or Bottom
- **Theme**: System (follows OS preference), Light, or Dark
- **Search Sources**: Toggle which sources are included (Tabs, Bookmarks, History)

Settings sync across your devices via Chrome Sync.

## FAQ

### Which pages does the command bar not work on?

The command bar overlay cannot appear on browser-internal pages such as:
- `chrome://` pages (settings, extensions, new tab)
- `chrome-extension://` pages
- `about:` pages
- The Chrome Web Store

On these pages, click the SlashMeBaby icon in the toolbar to open a popup fallback with the same search functionality.

### How do I change the keyboard shortcut?

1. Open Settings from the command bar (`>settings`)
2. Select your preferred shortcut in the Keyboard Shortcut section

Alternatively, visit `chrome://extensions/shortcuts` to set a custom key combination not in the preset list.

### Does SlashMeBaby collect any data?

No. SlashMeBaby does not transmit any data to external servers. There is no analytics, no telemetry, and no tracking. All data stays in your browser.

### Does it work in Firefox?

Yes. SlashMeBaby supports Firefox via the Firefox Add-ons store. The extension uses the WebExtension API standard supported by both Chrome and Firefox.

### Why does the command bar look different from the host page?

SlashMeBaby renders inside a Shadow DOM, which isolates its styles from the host page. The command bar keeps the same look regardless of the website's CSS.
