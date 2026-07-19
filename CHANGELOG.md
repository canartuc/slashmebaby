# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-07-19

### Changed

- Bumped fuse.js to 7.5.0 (runtime search engine) and dev tooling (eslint 10.7, typescript-eslint 8.64).

### Fixed

- A test-suite race could kill otherwise-green CI runs: the content-script teardown now drains React's concurrent scheduler before removing the overlay DOM, so no render task fires after the jsdom environment is gone.

## [1.1.0] - 2026-07-18

### Fixed

- Activating a hibernated (discarded/Memory-Saver) tab from the palette now wakes it with an explicit reload on Chrome — previously the switch could land on a blank page. Firefox restores discarded tabs natively on activation and frozen tabs keep their content in memory, so neither is force-reloaded (a reload there would destroy live page state or replace session restore with a cold load).
- Tab and Shift+Tab now jump to the first item of the next/previous result section (top-level folders in the tree view) instead of duplicating ArrowDown/ArrowUp, in both search and jump modes; single-section lists (such as `>` action mode) fall back to one-item steps so Tab always moves the selection. The onboarding guide gained a matching Shift+Tab row.
- History results now refresh immediately after a page visit (debounced `history.onVisited` listener) instead of waiting up to five minutes for the next periodic refresh.
- Hostile host-page CSS (for example a `div { all: revert !important }` reset) could revert the overlay's font: the shadow `:host` reset and every design-token custom property are now `!important`-hardened, so important document rules hitting the host element can no longer override the palette's typography or inject token values (important shadow declarations win per CSS Scoping; custom properties are exempt from `all` and need their own defense).

### Added

- A "zzz" sleep badge marks hibernated tabs in the palette on both surfaces — including pinned tiles — with the state announced in each row's aria-label ("(sleeping)") for screen readers. Plain text rather than the ⏾ glyph, which is missing from common Windows/Linux fonts.
- Keyboard shortcut now works on the new tab page and other restricted pages (`chrome://`, Chrome Web Store): the browser-level command opens the palette popup there via `chrome.action.openPopup()`.
- Onboarding gains a "Pin it to your toolbar" step with browser-specific instructions (Chrome / Firefox) and a live "Pinned" confirmation where the browser supports it.

### Removed

- The popup-only "Backspace closes the window" behavior (strict overlay parity — Escape or clicking away still closes it).

### Changed

- Automated coverage expanded substantially: every activation-shortcut preset (including Command variants), settings applied live to the open overlay, theme/position placement, jump labels (including two-character combos), pinned-tab number shortcuts, tree arrow navigation, go-to-URL, `>` action mode, diacritics folding, history section rendering, popup keyboard flows, and real tab-group/multi-window round-trips.
- Clicking the toolbar icon on normal pages now opens the in-page overlay palette (same as the shortcut); the popup remains the surface on restricted pages.
- The popup is visually and behaviorally unified with the overlay palette: same CommandBar (tab grid, bookmark tree, jump/search modes, action chips) in a larger 720×540 window, opening in jump mode identical to the overlay (labels pressable on entry, `/` for typed search), with client-side fuzzy search replacing the old background-search mini list. Surface parity is enforced by dedicated unit, e2e, and pixel-diff suites.
- Minimum browser versions raised: Chrome 127 (for `action.openPopup`) and Firefox 126 (for the `commands.onCommand` tab argument).

## [1.0.0] - 2026-07-07

Initial public release.

### Added

- Command bar overlay: a centered modal palette rendered in an isolated Shadow DOM on any page, opened with a keyboard shortcut (default Ctrl+Shift+Space, Cmd+Shift+Space on macOS) and dismissed with Escape or a click on the backdrop (the toolbar popup also closes on Backspace with an empty query).
- Tab search and switch: fuzzy search across all open tabs in all windows, with title, URL, and favicon shown per result.
- Bookmark search across the full bookmark tree, including nested folders.
- History search across the most recent browsing history (ranked by recency in the toolbar popup).
- Recency-weighted scoring in the toolbar popup that blends Fuse.js fuzzy-match quality with an exponential-decay recency score (per-category half-lives); the overlay ranks by fuzzy-match quality.
- Grouped results in fixed order (Tabs, Bookmarks, History, Actions) with a configurable per-group cap.
- Full keyboard navigation: arrow keys across group boundaries, Tab/Shift+Tab between groups, Enter to execute.
- Smart suggestions in the toolbar popup on empty query: recent tabs, newest bookmarks, and contextual actions (the overlay's empty state shows the tab and bookmark tree instead).
- Tab actions: close tab, close other tabs, pin/unpin, mute/unmute, duplicate, move to new window, reload.
- Navigation actions: new tab, go to URL, and a Recently Closed action that restores the most recently closed tab (or undoes the palette's last tab operation) via the sessions API (a single-shot restore, with no sub-list).
- Utility actions: close duplicate tabs, sort tabs by domain, open settings.
- Action prefix mode: a leading `>` filters results to actions only.
- Tree view of all tabs and bookmarks with expand/collapse, window/tab-group grouping (Chrome), EasyJump keyboard labels, and a `/` toggle between jump and search modes.
- First-run onboarding: a four-step tutorial (choose shortcut, a static shortcut demo, learn navigation, pro tips), with progress stored locally.
- Settings page: activation shortcut presets, palette position (center/top/bottom), theme (system/light/dark), max results per group, favicon display toggle, and per-source search toggles, persisted via browser sync storage.
- System theme detection (`prefers-color-scheme`) with manual light/dark override.
- Popup fallback with the same search for restricted pages where content scripts cannot run.
- Background favicon proxy: fetches site favicons image-only with credentials omitted, converts them to `data:` URLs, and caches them in memory, with a globe-glyph fallback.
- Cross-browser builds via WXT: Chrome MV3 (primary) and Firefox MV2.

[1.1.1]: https://github.com/canartuc/slashmebaby/releases/tag/v1.1.1
[1.1.0]: https://github.com/canartuc/slashmebaby/releases/tag/v1.1.0
[1.0.0]: https://github.com/canartuc/slashmebaby/releases/tag/v1.0.0
