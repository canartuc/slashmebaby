# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-07

Initial public release.

### Added

- Command bar overlay: a centered modal palette rendered in an isolated Shadow DOM on any page, opened with a keyboard shortcut (default Ctrl+Shift+Space, Cmd+Shift+Space on macOS) and dismissed with Escape or a click on the backdrop (the toolbar popup additionally closes on Backspace with an empty query).
- Tab search and switch: fuzzy search across all open tabs in all windows, with title, URL, and favicon shown per result.
- Bookmark search across the full bookmark tree, including nested folders.
- History search across the most recent browsing history (ranked by recency in the toolbar popup).
- Recency-weighted scoring in the toolbar popup that blends Fuse.js fuzzy-match quality with an exponential-decay recency score (per-category half-lives); the overlay ranks by fuzzy-match quality.
- Grouped results in fixed order — Tabs, Bookmarks, History, Actions — with a configurable per-group cap.
- Full keyboard navigation: arrow keys across group boundaries, Tab/Shift+Tab between groups, Enter to execute.
- Smart suggestions in the toolbar popup on empty query: recent tabs, newest bookmarks, and contextual actions (the overlay's empty state shows the tab and bookmark tree instead).
- Tab actions: close tab, close other tabs, pin/unpin, mute/unmute, duplicate, move to new window, reload.
- Navigation actions: new tab, go to URL, and a Recently Closed action that restores the most recently closed tab (or undoes the palette's last tab operation) via the sessions API — a single-shot restore, with no sub-list.
- Utility actions: close duplicate tabs, sort tabs by domain, open settings.
- Action prefix mode: a leading `>` filters results to actions only.
- Tree view of all tabs and bookmarks with expand/collapse, window/tab-group grouping (Chrome), EasyJump keyboard labels, and a `/` toggle between jump and search modes.
- First-run onboarding: a four-step tutorial (choose shortcut, a static shortcut demo, learn navigation, pro tips), with progress stored locally.
- Settings page: activation shortcut presets, palette position (center/top/bottom), theme (system/light/dark), max results per group, favicon display toggle, and per-source search toggles, persisted via browser sync storage.
- System theme detection (`prefers-color-scheme`) with manual light/dark override.
- Popup fallback with the same search for restricted pages where content scripts cannot run.
- Background favicon proxy: fetches site favicons image-only with credentials omitted, converts them to `data:` URLs, and caches them in memory, with a globe-glyph fallback.
- Cross-browser builds via WXT: Chrome MV3 (primary) and Firefox MV2.

[1.0.0]: https://github.com/canartuc/slashmebaby/releases/tag/v1.0.0
