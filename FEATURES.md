# FEATURES.md — SlashMeBaby Feature Tracker

Last updated: 2026-07-07

---

## P0 — Must Have (Launch Blockers)

These features are required for the initial public release on Chrome Web Store and Firefox Add-ons. No launch without these.

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F01 | Command Bar Overlay | Center-stage modal overlay with search input and grouped result list. Dimmed backdrop behind the panel. Opens via keyboard shortcut, closes via Escape or clicking backdrop. | Complete |
| F02 | Tab Search & Switch | Fuzzy search across all open tabs in all windows. Results show tab title, URL, and favicon. Pressing Enter switches to the selected tab. | Complete |
| F03 | Bookmark Search | Fuzzy search across the full flattened bookmark tree. Results show title and URL. Pressing Enter navigates the current tab to the bookmark URL. | Complete |
| F04 | History Search | Fuzzy search across the last 1,000 browsing history items (cached in the background, refreshed every 5 minutes). Available in both the main overlay (a History group appears once a query is typed; never in the empty tree state) and the popup. Results show title and URL. Pressing Enter navigates the current tab to the URL. | Complete |
| F05 | Recency-Weighted Scoring | Combined scoring formula: `finalScore = (1 - fuseScore) * 0.6 + recencyScore * 0.4` (Fuse scores 0 = best, so the match score is inverted first). Recency uses exponential decay: `Math.exp(-ln(2) * ageInHours / halfLifeHours)`. Half-lives: Tabs 2h, Bookmarks 168h, History 24h. | Complete |
| F06 | Grouped Results | Results are displayed in labelled sections. Popup order: Tabs → Bookmarks → History → Actions. Overlay order: Open Tabs → Bookmarks → History, with a Navigate ("Go to URL") row last when applicable. Each group is capped by the Results Per Group setting (3/5/8, default 5); there is no separate global cap. Sections only appear if they have matching results. | Complete |
| F07 | Keyboard Navigation | Arrow keys move between items across group boundaries (wrapping at the ends). Tab / Shift+Tab move selection to the next / previous item. Enter executes the selected item. Escape dismisses. Backspace edits the query normally and never dismisses. | Complete |
| F08 | Smart Suggestions | Popup empty state (no query typed): 3 most recently accessed tabs + 2 most recently added bookmarks + up to 2 contextual actions prioritized by the active tab's state (Unmute/Mute first when the tab is muted/audible, then Unpin/Pin, then New Tab). The overlay's empty state shows the tree view (F25) instead. | Complete |
| F09 | Tab Actions | Contextual actions applied to the active tab: Close Tab, Close Other Tabs (keeps pinned tabs), Pin/Unpin (label flips with the tab's pinned state), Mute/Unmute (label flips; hidden entirely when the tab is neither audible nor muted), Duplicate Tab, Move to New Window, Reload Tab. | Complete |
| F10 | Navigation Actions | Global navigation commands: New Tab (open blank tab); Recently Closed (single-shot undo — reverses the last palette action: restores tabs the palette closed via `chrome.sessions.restore()`, re-toggles pin/mute, or closes a just-created tab; otherwise restores the most recently closed tab; no sub-list); Go to URL (when the query looks like a URL or domain, the overlay appends a "Go to <url>" row that navigates the current tab; default scheme https, unsafe schemes rejected). | Complete |
| F11 | Utility Actions | Browser management commands: Close Duplicate Tabs (closes tabs with identical URLs, keeping one per URL), Sort Tabs by Domain (reorders the current window's tabs alphabetically by domain), Open Settings (opens the SlashMeBaby settings page). | Complete |
| F12 | Action Prefix Mode | Typing `>` as the first character strips it from the query and filters results to Actions only (Tabs, Bookmarks, History groups hidden); a lone `>` lists all actions in the overlay. Deleting back to empty restores full multi-source mode. Works in both the overlay and the popup. | Complete |
| F13 | Keyboard Shortcut | Configurable activation shortcut handled in-page by the content script. Default: Ctrl+Shift+Space (⌘+Shift+Space on Mac). Additional presets: Ctrl+Shift+L, Ctrl+., Ctrl+/ (⌘ variants on Mac). A browser-level `chrome.commands` binding (`toggle-command-bar`, same default) also toggles the bar and can be customized via `chrome://extensions/shortcuts`. | Complete |
| F14 | System Theme | Default "System" theme auto-detects OS light/dark preference via `prefers-color-scheme` and renders the command bar in the matching palette. A manual Light/Dark override is available in Settings (F18). | Complete |
| F15 | Shadow DOM Isolation | Content script creates a `<div id="slashmebaby-root">` attached to `document.body` with an open Shadow DOM root. All styles scoped inside. Zero CSS leakage to/from host page. | Complete |
| F16 | Cross-Browser Support | Chrome MV3 (and Chromium forks: Edge, Brave). Firefox MV2 (with `browser_specific_settings.gecko` id and data-collection declaration). Built via WXT with a per-browser function-form manifest; code uses the `chrome.*` API surface (supported natively by Firefox) and feature-detects Chrome-only APIs such as `tabGroups`. Separate CI build targets for both. | Complete |
| F25 | Tree View | Full tree of all tabs and bookmarks with expand/collapse | Complete |
| F26 | EasyJump Labels | Dynamic keyboard labels for instant navigation | Complete |
| F27 | Jump/Search Mode Toggle | `/` key toggles between jump and search modes | Complete |
| F28 | Smart Tab Grouping | Tabs grouped by window and Chrome tab group with nested display in the tree. Uses the `tabGroups` permission on Chrome for real group titles; Firefox (no tabGroups API) falls back to window-based grouping | Complete |
| F29 | Nested Bookmark Folders | Full bookmark tree with unlimited folder nesting | Complete |

---

## P1 — Should Have

These features significantly improve the product experience but are not required for launch. Target: first minor release post-launch.

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F17 | Onboarding Tutorial | 4-step tutorial on first install: (1) Choose Shortcut, (2) Try It Now (shows the chosen shortcut with a static demo animation — advance with the Next button; content scripts cannot run on extension pages, so the demo is not live), (3) Navigate Results (keyboard cheat sheet), (4) You're Ready (pro tips). Opens via `runtime.onInstalled`. Progress saved to `chrome.storage.local`. | Complete |
| F18 | Settings Page | Full settings UI accessible via the "Open Settings" action or the extension's options entry (icon right-click → Options). Configures all six settings: shortcut, bar position, theme, search source toggles (tabs/bookmarks/history), max results per group (3/5/8), and favicon display. Settings persisted via `chrome.storage.sync`. | Complete |
| F19 | Position Options | User-selectable bar position: Center Stage (default, Spotlight-style centered with backdrop), Top Anchored (drops from top, Arc-style), Bottom Anchored (rises from bottom). | Complete |
| F20 | Popup Fallback | For restricted pages (`chrome://`, `about:`, browser internal pages) where content scripts cannot run, the extension icon opens a minimal popup with the same search functionality. | Complete |

---

## P2 — Nice to Have (Post-Launch)

These features are desirable long-term additions. Not scheduled for v1 or immediate post-launch. Revisit after user feedback.

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F21 | Community Themes | User-installable and shareable color themes beyond the system light/dark default. Theme format: JSON token overrides. | Not Started |
| F22 | Tab Groups Integration | Tab group management actions: create group, rename group, move tab to group. (Displaying and navigating existing groups already shipped as F28.) Chrome-only (hidden on Firefox). | Not Started |
| F23 | Tab Suspension | Hibernate inactive tabs to free memory. Visual indicator on suspended tabs. Wake on selection. | Not Started |
| F24 | Bookmark Management | CRUD operations on bookmarks from within the command bar: create, rename, delete, move to folder. | Not Started |

---

## Out of Scope (v1)

The following will not be implemented in v1 regardless of priority:

- Tab sharing / sending tabs to other devices
- AI-powered query interpretation (e.g., "find my React docs tab")
- Synced command history across devices
- Extension themes marketplace or in-app purchase
- Nested sub-commands or sub-list flows (e.g., a browsable Recently Closed list — Recently Closed ships as a single-shot restore/undo instead)
- Drag-and-drop tab reordering within the command bar
- Browser profile switching
