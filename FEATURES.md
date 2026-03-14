# FEATURES.md — SlashMeBaby Feature Tracker

Last updated: 2026-03-14

---

## P0 — Must Have (Launch Blockers)

These features are required for the initial public release on Chrome Web Store and Firefox Add-ons. No launch without these.

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F01 | Command Bar Overlay | Center-stage modal overlay with search input and grouped result list. Dimmed backdrop behind the panel. Opens via keyboard shortcut, closes via Escape or clicking backdrop. | Complete |
| F02 | Tab Search & Switch | Fuzzy search across all open tabs in all windows. Results show tab title, URL, and favicon. Pressing Enter switches to the selected tab. | Complete |
| F03 | Bookmark Search | Fuzzy search across the full flattened bookmark tree. Results show title and URL. Pressing Enter navigates the current tab to the bookmark URL. | Complete |
| F04 | History Search | Fuzzy search across the last 1,000 browsing history items. Results show title, URL, and last visit time. Pressing Enter navigates to the URL. | Complete |
| F05 | Recency-Weighted Scoring | Combined scoring formula: `finalScore = fuseScore * 0.6 + recencyScore * 0.4`. Recency uses exponential decay: `Math.exp(-ln(2) * ageInHours / halfLifeHours)`. Half-lives: Tabs 2h, Bookmarks 168h, History 24h. | Complete |
| F06 | Grouped Results | Results are displayed in labelled sections: Tabs → Bookmarks → History → Actions. Max 5 items per group, 15 total visible. Sections only appear if they have matching results. | Complete |
| F07 | Keyboard Navigation | Arrow keys move between items across group boundaries. Tab jumps to the next group header. Enter executes the selected item. Escape dismisses. Backspace on empty input dismisses. | Complete |
| F08 | Smart Suggestions | Empty-state (no query typed): show 3 most recently accessed tabs + 2 most recently added bookmarks + 2 contextual actions (e.g., "Mute Tab" only if current tab is audible). | Complete |
| F09 | Tab Actions | Contextual actions applied to a specific tab: Close Tab, Close Other Tabs, Pin/Unpin (label toggles), Mute/Unmute (only if audible), Duplicate Tab, Move to New Window, Reload Tab. | Complete |
| F10 | Navigation Actions | Global navigation commands: New Tab (open blank tab), Recently Closed (sub-list of 10 most recently closed tabs via `chrome.sessions.getRecentlyClosed()`, select to restore via `chrome.sessions.restore()`), Go to URL (navigate typed URL in current tab). | Complete |
| F11 | Utility Actions | Browser management commands: Close All Duplicates (find and close tabs with identical URLs), Sort Tabs by Domain (reorder open tabs grouping by domain), Settings (open SlashMeBaby settings page). | Complete |
| F12 | Action Prefix Mode | Typing `>` as the first character strips it from the query and filters results to Actions only (Tabs, Bookmarks, History groups hidden). Deleting back to empty restores full multi-source mode. | Complete |
| F13 | Keyboard Shortcut | Configurable activation shortcut. Default: Alt+Space. Additional presets: Ctrl+Shift+L, Ctrl+., Ctrl+/. Registered via `chrome.commands`. Users can also set custom shortcuts via `chrome://extensions/shortcuts`. | Complete |
| F14 | System Theme | Auto-detects OS light/dark preference via `prefers-color-scheme`. Command bar renders in matching theme. No manual toggle required for v1. | Complete |
| F15 | Shadow DOM Isolation | Content script creates a `<div id="slashmebaby-root">` attached to `document.body` with an open Shadow DOM root. All styles scoped inside. Zero CSS leakage to/from host page. | Complete |
| F16 | Cross-Browser Support | Chrome MV3 (and Chromium forks: Edge, Brave). Firefox MV2/MV3. Built via WXT with `browser` namespace auto-polyfill. Separate CI build targets for both. | Complete |

---

## P1 — Should Have

These features significantly improve the product experience but are not required for launch. Target: first minor release post-launch.

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F17 | Onboarding Tutorial | 4-step interactive tutorial on first install: (1) Choose Shortcut, (2) Try It Now (live test), (3) Navigate Results (keyboard cheat sheet), (4) You're Ready (pro tips). Opens via `runtime.onInstalled`. Progress saved to `chrome.storage.local`. | Complete |
| F18 | Settings Page | Full settings UI accessible from Actions menu or extension icon right-click. Configures: shortcut, bar position, theme, max results per group, favicon display, and search source toggles. Settings persisted via `chrome.storage.sync`. | Complete |
| F19 | Position Options | User-selectable bar position: Center Stage (default, Spotlight-style centered with backdrop), Top Anchored (drops from top, Arc-style), Bottom Anchored (rises from bottom). | Complete |
| F20 | Popup Fallback | For restricted pages (`chrome://`, `about:`, browser internal pages) where content scripts cannot run, the extension icon opens a minimal popup with the same search functionality. | Complete |

---

## P2 — Nice to Have (Post-Launch)

These features are desirable long-term additions. Not scheduled for v1 or immediate post-launch. Revisit after user feedback.

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F21 | Community Themes | User-installable and shareable color themes beyond the system light/dark default. Theme format: JSON token overrides. | Not Started |
| F22 | Tab Groups Integration | Show and navigate Chrome tab groups. Actions: create group, rename group, move tab to group. Chrome-only (hidden on Firefox). | Not Started |
| F23 | Tab Suspension | Hibernate inactive tabs to free memory. Visual indicator on suspended tabs. Wake on selection. | Not Started |
| F24 | Bookmark Management | CRUD operations on bookmarks from within the command bar: create, rename, delete, move to folder. | Not Started |

---

## Out of Scope (v1)

The following will not be implemented in v1 regardless of priority:

- Tab sharing / sending tabs to other devices
- AI-powered query interpretation (e.g., "find my React docs tab")
- Synced command history across devices
- Extension themes marketplace or in-app purchase
- Nested sub-commands beyond the Recently Closed sub-list
- Drag-and-drop tab reordering within the command bar
- Browser profile switching
