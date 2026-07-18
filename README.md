# SlashMeBaby

[![CI](https://github.com/canartuc/slashmebaby/actions/workflows/ci.yml/badge.svg)](https://github.com/canartuc/slashmebaby/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/canartuc/slashmebaby)](https://github.com/canartuc/slashmebaby/releases)
[![License: MIT](https://img.shields.io/github/license/canartuc/slashmebaby)](LICENSE)

A cross-browser command palette, inspired by Arc and Zen. Press one keyboard shortcut on any page to search your open tabs, bookmarks, and history, and to run tab-management actions without leaving the keyboard.

Works in Chrome (Manifest V3) and Firefox (Manifest V2).

## Features

- **Tab switching.** Fuzzy-search every open tab in every window and jump to it with Enter. Sleeping (Memory-Saver) tabs show a ⏾ badge and wake automatically when you switch to them.
- **Bookmark search.** Search your full bookmark tree, including nested folders.
- **History search.** Search your recent browsing history.
- **Tab actions.** Close tab, close other tabs, pin/unpin, mute/unmute, duplicate, move to a new window, reload, new tab, go to URL, restore recently closed tabs, close duplicate tabs, and sort tabs by domain.
- **Action-only mode.** Type `>` as the first character to filter the palette to actions only (for example `>close`).
- **Jump-first empty state.** Open either surface with no query and you get the full jump view — pinned tabs, the open-tab grid, your bookmark tree, and action chips, all with instant keyboard labels.
- **Onboarding.** A short interactive tutorial opens on first install to help you pick a shortcut and learn the keyboard navigation.
- **Settings.** Configure the activation shortcut, palette position (center / top / bottom), theme (system / light / dark), maximum results per group, favicon display, and which search sources are enabled. Settings sync via your browser account.
- **Popup fallback.** On pages where content scripts cannot run (`chrome://`, `about:`, the Chrome Web Store), the toolbar icon opens a popup running the identical palette — same jump labels, keys, and search.

## Keyboard shortcut

The default shortcut is **Ctrl+Shift+Space** (**Cmd+Shift+Space** on macOS). You can change it in the extension's settings or at `chrome://extensions/shortcuts`.

Inside the palette: arrow keys move between results, Tab jumps between groups, Enter executes, and Escape closes.

## Install from source

Requires Node.js 24 or later.

```bash
npm install
npm run build
```

For development with hot reload, use `npm run dev` (Chrome) or `npm run dev:firefox` instead of `npm run build`.

Then load the unpacked extension:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `.output/chrome-mv3`

For Firefox, run `npm run build:firefox` and load a temporary add-on from `.output/firefox-mv2` via `about:debugging#/runtime/this-firefox`.

See [docs/developer-guide.md](docs/developer-guide.md) for the full development workflow and [docs/user-guide.md](docs/user-guide.md) for usage details.

## Privacy

Everything runs on-device: no telemetry or analytics, and no data ever leaves your browser. See [PRIVACY.md](PRIVACY.md) for the full policy.

## Tech stack

- [WXT](https://wxt.dev/) (cross-browser extension framework)
- React 19 + TypeScript (strict)
- [Fuse.js](https://www.fusejs.io/) (fuzzy search)
- Vitest (unit tests) + Playwright (end-to-end tests)

## Contributing

Bug reports, feature requests, and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the development setup and the checks a PR must pass. AI-assisted contributions are fine with disclosure (see [AI_CONTRIBUTIONS.md](AI_CONTRIBUTIONS.md)). The project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Report security issues privately as described in [SECURITY.md](SECURITY.md), not in the issue tracker.

## License

MIT. See [LICENSE](LICENSE).
