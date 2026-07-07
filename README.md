# SlashMeBaby

A cross-browser command palette, inspired by Arc and Zen. Press one keyboard shortcut on any page to search your open tabs, bookmarks, and history, and to run tab-management actions — without leaving the keyboard.

Works in Chrome (Manifest V3) and Firefox (Manifest V2).

## Features

- **Tab switching** — fuzzy-search every open tab in every window and jump to it with Enter. (In the toolbar popup, results are additionally ranked by recency.)
- **Bookmark search** — search your full bookmark tree, including nested folders.
- **History search** — search your recent browsing history. (In the toolbar popup, results are additionally ranked by how recently you visited each page.)
- **Tab actions** — close tab, close other tabs, pin/unpin, mute/unmute, duplicate, move to a new window, reload, new tab, go to URL, restore recently closed tabs, **close duplicate tabs**, and **sort tabs by domain**.
- **Action-only mode** — type `>` as the first character to filter the palette to actions only (for example `>close`).
- **Smart suggestions** — with an empty query, the toolbar popup shows your most recent tabs, newest bookmarks, and contextual actions. (The overlay's empty state shows a navigable tree of all tabs and bookmarks instead.)
- **Onboarding** — a short interactive tutorial opens on first install to help you pick a shortcut and learn the keyboard navigation.
- **Settings** — configure the activation shortcut, palette position (center / top / bottom), theme (system / light / dark), maximum results per group, favicon display, and which search sources are enabled. Settings sync via your browser account.
- **Popup fallback** — on pages where content scripts cannot run (`chrome://`, `about:`, the Chrome Web Store), the toolbar icon opens a popup with the same search.

## Keyboard shortcut

The default shortcut is **Ctrl+Shift+Space** (**Cmd+Shift+Space** on macOS). You can change it in the extension's settings or at `chrome://extensions/shortcuts`.

Inside the palette: arrow keys move between results, Tab jumps between groups, Enter executes, and Escape closes.

## Install from source

Requires Node.js 24 or later.

```bash
npm install
npm run build
```

Then load the unpacked extension:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `.output/chrome-mv3`

For Firefox, run `npm run build:firefox` and load a temporary add-on from `.output/firefox-mv2` via `about:debugging#/runtime/this-firefox`.

See [docs/developer-guide.md](docs/developer-guide.md) for the full development workflow and [docs/user-guide.md](docs/user-guide.md) for usage details.

## Privacy

Everything runs on-device: no telemetry, no analytics, and no data ever leaves your browser. See [PRIVACY.md](PRIVACY.md) for the full policy.

## Tech stack

- [WXT](https://wxt.dev/) — cross-browser extension framework
- React 19 + TypeScript (strict)
- [Fuse.js](https://www.fusejs.io/) — fuzzy search
- Vitest (unit tests) + Playwright (end-to-end tests)

## License

MIT — see [LICENSE](LICENSE).
