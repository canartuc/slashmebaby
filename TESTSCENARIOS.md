# TESTSCENARIOS.md — SlashMeBaby QA Test Scenarios

Last updated: 2026-07-07

Each scenario has a unique ID (TS-NNN), a priority (P0/P1), and a one-line description of what is verified.

---

## 1. Extension Lifecycle

| ID | Priority | Description |
|----|----------|-------------|
| TS-001 | P0 | Extension installs without errors and appears in the browser extensions list |
| TS-002 | P0 | Background service worker starts without console errors after installation |
| TS-003 | P0 | Onboarding page opens automatically on first install |
| TS-004 | P0 | Onboarding page does NOT re-open on browser restart or extension update after completion |
| TS-005 | P1 | Settings page loads at `chrome-extension://<id>/settings.html` without errors |
| TS-006 | P1 | Onboarding page loads at `chrome-extension://<id>/onboarding.html` without errors |
| TS-007 | P0 | Extension icon appears in the browser toolbar after installation |
| TS-008 | P1 | Extension survives a browser restart with settings preserved |

---

## 2. Command Bar Activation

### 2.1 Shortcut Opens and Closes

| ID | Priority | Description |
|----|----------|-------------|
| TS-009 | P0 | Pressing the configured shortcut (default Ctrl+Shift+Space; ⌘+Shift+Space on Mac) opens the command bar overlay |
| TS-010 | P0 | Pressing the shortcut again while the overlay is open closes it |
| TS-011 | P0 | Pressing Escape closes the overlay |
| TS-012 | P0 | Clicking the backdrop outside the command bar closes the overlay |
| TS-013 | P0 | Overlay is fully unmounted from DOM after closing (no hidden element persisting) |
| TS-014 | P0 | Search input is empty and focused when the overlay opens |
| TS-015 | P0 | Focus is released back to the host page after closing (the unmounted overlay retains no focus or key handlers) |

### 2.2 All Four Shortcut Options

| ID | Priority | Description |
|----|----------|-------------|
| TS-016 | P0 | Ctrl+Shift+Space (⌘+Shift+Space on Mac) opens the command bar when configured as the activation shortcut (default) |
| TS-017 | P0 | Ctrl+Shift+L (⌘+Shift+L on Mac) opens the command bar when configured as the activation shortcut |
| TS-018 | P0 | Ctrl+. (⌘+. on Mac) opens the command bar when configured as the activation shortcut |
| TS-019 | P0 | Ctrl+/ (⌘+/ on Mac) opens the command bar when configured as the activation shortcut |
| TS-020 | P1 | Custom shortcut set via chrome://extensions/shortcuts (command `toggle-command-bar`) opens the command bar |

### 2.3 Page Compatibility

| ID | Priority | Description |
|----|----------|-------------|
| TS-021 | P0 | Command bar opens on http:// pages |
| TS-022 | P0 | Command bar opens on https:// pages |
| TS-023 | P0 | Command bar does NOT open on chrome:// URLs (extension cannot inject content script) |
| TS-024 | P0 | Command bar does NOT open on about: pages |
| TS-025 | P0 | Command bar does NOT open on chrome-extension:// pages |

---

## 3. Search and Results

### 3.1 Smart Suggestions (Empty State)

| ID | Priority | Description |
|----|----------|-------------|
| TS-026 | P0 | Opening the popup with no query shows smart suggestions immediately (the overlay's empty state shows the pinned-tab grid and tree view instead) |
| TS-027 | P0 | Smart suggestions include the 3 most recently accessed open tabs |
| TS-028 | P0 | Smart suggestions include the 2 most recently added bookmarks |
| TS-029 | P0 | Smart suggestions include contextual action "Mute Tab" only when the current tab is audible |
| TS-030 | P0 | Smart suggestions include contextual action "Unmute Tab" when the current tab is muted |
| TS-031 | P0 | Smart suggestions show no more than 2 contextual actions |

### 3.2 Fuzzy Search

| ID | Priority | Description |
|----|----------|-------------|
| TS-032 | P0 | Typing a query returns fuzzy-matched results from open tabs |
| TS-033 | P0 | Typing a query returns fuzzy-matched results from bookmarks |
| TS-034 | P0 | Typing a query returns fuzzy-matched results from browsing history |
| TS-035 | P0 | Typing a query in the popup returns fuzzy-matched actions by name (in the overlay, actions are matched via the `>` prefix) |
| TS-036 | P0 | Partial query matches (e.g. "gmil" matches "Gmail") |
| TS-037 | P0 | Case-insensitive matching works (e.g. "GMAIL" matches "Gmail") |
| TS-038 | P0 | URL fields are searched in addition to titles |
| TS-039 | P0 | Clearing the query returns to the empty state (smart suggestions in the popup, tree view in the overlay) |

### 3.3 Grouped Results

| ID | Priority | Description |
|----|----------|-------------|
| TS-040 | P0 | Popup results are grouped in order: Tabs, Bookmarks, History, Actions; overlay results in order: Open Tabs, Bookmarks, History, then a Navigate row when the query looks like a URL |
| TS-041 | P0 | Each group shows a visible group header label |
| TS-042 | P0 | A group section is not shown at all when it has no matching results |
| TS-043 | P0 | Each group shows at most the configured Results Per Group value (3/5/8, default 5) |
| TS-044 | P0 | Total visible results never exceed the per-group cap multiplied by the number of result groups (there is no separate global cap) |
| TS-045 | P0 | Each result row shows the item's title |
| TS-046 | P0 | Each result row shows the item's URL (where applicable) |
| TS-047 | P1 | Each result row shows the item's favicon (when Show Favicons setting is On) |
| TS-048 | P1 | A globe fallback icon is shown for items with a missing or broken favicon |

### 3.4 Recency Scoring

| ID | Priority | Description |
|----|----------|-------------|
| TS-049 | P0 | A tab accessed 5 minutes ago ranks higher than an equally-matched tab accessed 3 hours ago |
| TS-050 | P0 | A bookmark added today ranks higher than an equally-matched bookmark added one month ago |
| TS-051 | P0 | A history item visited an hour ago ranks higher than an equally-matched item visited 2 days ago |
| TS-052 | P0 | Actions are ranked purely by fuzzy match score (no recency boost) |

### 3.5 Action Prefix Mode (>)

| ID | Priority | Description |
|----|----------|-------------|
| TS-053 | P0 | Typing ">" as the first character hides Tabs, Bookmarks, and History groups |
| TS-054 | P0 | Typing ">" shows only the Actions group (a lone ">" lists all actions in the overlay) |
| TS-055 | P0 | Typing "> close" matches actions named "Close Tab" and "Close Other Tabs" |
| TS-056 | P0 | Deleting back to an empty input (removing ">") restores all groups |
| TS-057 | P0 | The ">" prefix is stripped before the query is passed to Fuse.js |

---

## 4. Keyboard Navigation

| ID | Priority | Description |
|----|----------|-------------|
| TS-058 | P0 | Arrow Down moves selection to the next result item |
| TS-059 | P0 | Arrow Up moves selection to the previous result item |
| TS-060 | P0 | Arrow Down from the last item in one group moves to the first item in the next group |
| TS-061 | P0 | Arrow Up from the first item in one group moves to the last item in the previous group |
| TS-062 | P0 | Tab key moves selection to the next result item, wrapping at the end of the list |
| TS-063 | P0 | Shift+Tab moves selection to the previous result item, wrapping at the top of the list |
| TS-064 | P0 | Pressing Enter executes the currently selected item |
| TS-065 | P0 | Pressing Escape dismisses the overlay |
| TS-066 | P0 | Pressing Backspace on an empty query does NOT dismiss the overlay |
| TS-067 | P0 | Pressing Backspace on a non-empty query deletes the last character (normal text editing) |
| TS-068 | P0 | The first result item is automatically selected when results appear |
| TS-069 | P0 | The selected item shows keyboard hint badges (e.g., Enter) |
| TS-070 | P0 | Non-selected items do not show keyboard hint badges |

---

## 5. Tab Actions

| ID | Priority | Description |
|----|----------|-------------|
| TS-071 | P0 | "Close Tab" action closes the current tab |
| TS-072 | P0 | "Close Other Tabs" action closes all unpinned tabs in the current window except the current one (pinned tabs are kept) |
| TS-073 | P0 | "Pin Tab" action pins an unpinned tab and the label updates to "Unpin Tab" |
| TS-074 | P0 | "Unpin Tab" action unpins a pinned tab and the label updates to "Pin Tab" |
| TS-075 | P0 | "Mute Tab" action appears and mutes the tab when the current tab is audible |
| TS-076 | P0 | "Unmute Tab" action appears and unmutes the tab when the current tab is muted |
| TS-077 | P0 | "Mute Tab" / "Unmute Tab" actions do NOT appear when the tab is not audible and not muted |
| TS-078 | P0 | "Duplicate Tab" action opens an identical copy of the current tab |
| TS-079 | P0 | "Move to New Window" action moves the current tab to a new browser window |
| TS-080 | P0 | "Reload Tab" action reloads the current tab |
| TS-081 | P0 | "New Tab" action opens a blank new tab |
| TS-082 | P0 | "Recently Closed" action restores the most recently closed tab in a single shot (no sub-list is shown) |
| TS-083 | P0 | After closing tabs via the palette (Close Tab / Close Other Tabs / Close Duplicate Tabs), "Recently Closed" restores the tabs closed by that action |
| TS-084 | P0 | A "Go to <url>" row appears when the typed query looks like a URL or domain; Enter navigates the current tab to it |
| TS-085 | P0 | "Close Duplicate Tabs" action closes all tabs with duplicate URLs, keeping one per URL |
| TS-086 | P0 | "Sort Tabs by Domain" action reorders the current window's tabs alphabetically by their domain |
| TS-087 | P0 | "Open Settings" action opens the SlashMeBaby settings page |
| TS-088 | P0 | Executing a tab-switch action (selecting a tab result) switches focus to that tab |
| TS-089 | P0 | Executing a bookmark result navigates the current tab to the bookmark URL |
| TS-090 | P0 | Executing a history result navigates the current tab to the history item URL |
| TS-091 | P0 | The overlay closes after any action is executed successfully; on failure it stays open and shows an inline error strip that auto-hides after ~2.5s |

---

## 6. Settings

### 6.1 Settings Persistence

| ID | Priority | Description |
|----|----------|-------------|
| TS-092 | P1 | Settings are saved to chrome.storage.sync and persist across browser restarts |
| TS-093 | P1 | Settings sync across multiple devices when logged into the same browser profile |
| TS-094 | P1 | Default settings are applied on first install before any user configuration |

### 6.2 Activation Shortcut Setting

| ID | Priority | Description |
|----|----------|-------------|
| TS-095 | P1 | Settings page shows all four shortcut options: Ctrl+Shift+Space, Ctrl+Shift+L, Ctrl+., Ctrl+/ (⌘ variants on Mac) |
| TS-096 | P1 | On Mac, shortcut labels display the Command (⌘) symbol where applicable |
| TS-097 | P1 | Changing the shortcut in settings immediately registers the new shortcut |
| TS-098 | P1 | The previously configured in-page shortcut no longer opens the command bar after changing (the separate browser-level chrome://extensions/shortcuts binding is unaffected) |

### 6.3 Position Setting

| ID | Priority | Description |
|----|----------|-------------|
| TS-099 | P1 | Selecting "Center" positions the command bar in the center of the viewport with backdrop |
| TS-100 | P1 | Selecting "Top" anchors the command bar to the top of the viewport (Arc-style) |
| TS-101 | P1 | Selecting "Bottom" anchors the command bar to the bottom of the viewport |
| TS-102 | P1 | The position setting change is reflected immediately on the next overlay open |

### 6.4 Theme Setting

| ID | Priority | Description |
|----|----------|-------------|
| TS-103 | P1 | Selecting "System" theme applies the dark palette when the OS is in dark mode |
| TS-104 | P1 | Selecting "System" theme applies the light palette when the OS is in light mode |
| TS-105 | P1 | Selecting "Light" forces the light palette regardless of OS preference |
| TS-106 | P1 | Selecting "Dark" forces the dark palette regardless of OS preference |

### 6.5 Max Results Per Group

| ID | Priority | Description |
|----|----------|-------------|
| TS-107 | P1 | Setting max results to 3 limits each group to 3 results |
| TS-108 | P1 | Setting max results to 5 limits each group to 5 results (default) |
| TS-109 | P1 | Setting max results to 8 limits each group to 8 results |

### 6.6 Show Favicons

| ID | Priority | Description |
|----|----------|-------------|
| TS-110 | P1 | Setting "Show Favicons" to On displays favicon images in result rows |
| TS-111 | P1 | Setting "Show Favicons" to Off hides favicon images and shows no placeholder |

### 6.7 Search Sources Toggles

| ID | Priority | Description |
|----|----------|-------------|
| TS-112 | P1 | Disabling the "Tabs" source removes tab results from all searches |
| TS-113 | P1 | Disabling the "Bookmarks" source removes bookmark results from all searches |
| TS-114 | P1 | Disabling the "History" source removes history results from all searches |
| TS-115 | P1 | Re-enabling a disabled source immediately restores its results on the next search |
| TS-116 | P1 | Disabling all three sources still shows Actions results |

---

## 7. Onboarding

### 7.1 Four-Step Flow

| ID | Priority | Description |
|----|----------|-------------|
| TS-117 | P1 | Step 1 ("Choose Your Shortcut") shows all four shortcut options as selectable tiles |
| TS-118 | P1 | Step 1 allows the user to select a shortcut and advance to step 2 |
| TS-119 | P1 | Step 2 ("Try It Now") displays the shortcut that was chosen in step 1 |
| TS-120 | P1 | Step 2 shows a static command-bar demo animation and invites the user to try the shortcut on a real page; the step advances via the Next button (content scripts cannot run on extension pages, so no live bar opens there) |
| TS-121 | P1 | Step 3 ("Navigate Results") shows a keyboard cheat sheet (arrow keys, Tab, Enter, Escape) |
| TS-122 | P1 | Step 4 ("You're Ready") shows pro tips including the ">" prefix for actions |
| TS-123 | P1 | Step 4 includes a pro tip pointing to the settings page ("Customize in settings") |
| TS-124 | P1 | Completing step 4 marks onboarding as complete in chrome.storage.local |
| TS-125 | P1 | A progress indicator (four dots) highlights the current step and marks completed steps |

### 7.2 Progress Persistence

| ID | Priority | Description |
|----|----------|-------------|
| TS-126 | P1 | Closing the onboarding tab mid-flow saves the current step to chrome.storage.local |
| TS-127 | P1 | Re-opening the onboarding page resumes from the last saved step |
| TS-128 | P1 | Completed step is stored as `{ onboarding: { completedStep: number, completed: boolean } }` |

---

## 8. Popup Fallback

| ID | Priority | Description |
|----|----------|-------------|
| TS-129 | P0 | Clicking the extension icon on a chrome:// page opens the popup fallback |
| TS-130 | P0 | Clicking the extension icon on an about: page opens the popup fallback |
| TS-131 | P0 | The popup fallback contains the search input field |
| TS-132 | P0 | Typing in the popup search input returns search results |
| TS-133 | P0 | Selecting a result in the popup executes the action (e.g., switches to the selected tab) |
| TS-134 | P0 | The popup fallback does NOT show a backdrop element |
| TS-135 | P1 | The popup fallback applies the same theme (light/dark) as the main overlay |
| TS-136 | P1 | Keyboard navigation (arrow keys, Enter) works inside the popup fallback |

---

## 9. Shadow DOM Isolation

| ID | Priority | Description |
|----|----------|-------------|
| TS-137 | P0 | The command bar is mounted inside a Shadow DOM root (`#slashmebaby-root`) |
| TS-138 | P0 | Host page CSS does not affect the command bar appearance (styles do not leak in) |
| TS-139 | P0 | Command bar CSS does not affect the host page appearance (styles do not leak out) |
| TS-140 | P0 | The command bar renders correctly on pages with global CSS resets (e.g., `* { margin: 0 }`) |
| TS-141 | P0 | The command bar renders correctly on pages with heavy custom stylesheets (e.g., Bootstrap, Tailwind) |
| TS-142 | P0 | The command bar renders correctly on pages that use CSS-in-JS (e.g., Emotion, styled-components) |
| TS-143 | P1 | The Shadow DOM mode is "open" (inspectable in devtools) |
| TS-144 | P0 | All design tokens (CSS custom properties) are scoped inside the Shadow DOM and not visible on the host page |

---

## 10. Cross-Browser

| ID | Priority | Description |
|----|----------|-------------|
| TS-145 | P0 | Chrome build installs and all P0 features work in the latest stable Chrome |
| TS-146 | P0 | Firefox build installs and all P0 features work in the latest stable Firefox |
| TS-147 | P0 | Chrome build works in Brave (Chromium fork, no separate build required) |
| TS-148 | P0 | Chrome build works in Microsoft Edge (Chromium fork, no separate build required) |
| TS-149 | P0 | Chrome MV3 manifest is valid and accepted by the Chrome Web Store review |
| TS-150 | P0 | Firefox MV2 manifest is valid and accepted by the Firefox Add-ons review (includes gecko id and data_collection_permissions) |
| TS-151 | P0 | Cross-browser API differences are handled: the chrome.* API surface works on Firefox, and Chrome-only APIs (e.g., tabGroups) are feature-detected at runtime |
| TS-152 | P1 | CI pipeline produces both Chrome and Firefox build artifacts without errors |

---

## 11. Performance

| ID | Priority | Description |
|----|----------|-------------|
| TS-153 | P0 | Command bar overlay appears within 50ms of the activation shortcut being pressed |
| TS-154 | P0 | Search results update within 16ms (one frame) of each keystroke |
| TS-155 | P0 | The extension has zero impact on host page rendering or JavaScript performance when inactive |
| TS-156 | P0 | Fuse.js search runs in the background service worker, not on the content script UI thread |
| TS-157 | P1 | Opening the command bar on a page with 100+ open tabs still meets the 50ms target |
| TS-158 | P1 | Searching across 1,000 history items still returns results within 16ms |
| TS-159 | P1 | Memory usage of the background service worker stays within acceptable browser limits |
| TS-160 | P0 | Overlay open/close animations complete in approximately 150ms |

---

## 12. Edge Cases

| ID | Priority | Description |
|----|----------|-------------|
| TS-161 | P0 | Command bar opens and shows an empty state gracefully when there are 0 open tabs |
| TS-162 | P0 | Command bar opens and search works correctly when there are 100+ open tabs |
| TS-163 | P0 | Command bar opens and shows results gracefully when there are no bookmarks |
| TS-164 | P0 | Command bar opens and shows results gracefully when there is no browsing history |
| TS-165 | P0 | Tab titles longer than the result row width are truncated with ellipsis (no wrapping) |
| TS-166 | P0 | URLs longer than the result row width are truncated with ellipsis (no wrapping) |
| TS-167 | P0 | Tabs with no favicon show the globe fallback icon without breaking the layout |
| TS-168 | P0 | Rapidly opening and closing the command bar in quick succession does not leave stale overlays or errors |
| TS-169 | P0 | Typing very fast (burst of keystrokes) returns correct results for the final query state |
| TS-170 | P0 | Searching with a query that matches nothing shows an appropriate empty results message |
| TS-171 | P0 | Tab titles containing special HTML characters (e.g., `<`, `>`, `&`) are rendered safely (no XSS) |
| TS-172 | P1 | Command bar opens correctly on a page that aggressively captures keyboard events |
| TS-173 | P1 | Switching to a tab in a different window via the command bar focuses that window |
| TS-174 | P1 | "Close All Duplicates" when there are no duplicates completes without error |
| TS-175 | P1 | "Sort Tabs by Domain" when there is only one tab completes without error |
| TS-176 | P0 | "Recently Closed" completes without error when no tabs have been closed this session (nothing to restore) |
