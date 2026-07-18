# Automation Coverage Map (Audit 3)

Maps every TESTSCENARIOS.md row to its automated-test evidence, verified
by opening each cited test and confirming an assertion (not mere setup)
covers the scenario. Evidence cites test TITLES, never line numbers.
Generated 2026-07-18; regenerate per the procedure at the bottom.

**198 scenarios** — e2e: 35, e2e+unit: 69, gap: 0, infeasible: 6, manual: 12, superseded: 5, unit: 71

## Scenario map

| TS | Status | Evidence |
|----|--------|----------|
| TS-001 | e2e | e2e/extension.spec.ts :: extension loads without console errors (asserts extension-attributed console errors === []; launch helper hard-fails if the extension service worker never registers, and the extension id is resolved from the registered worker) |
| TS-002 | e2e | e2e/extension.spec.ts :: extension loads without console errors (launchBrowserWithExtension throws if the MV3 service worker does not register; test then asserts zero extension errors after load) |
| TS-003 | unit | src/__tests__/background/index.test.ts :: onInstalled with reason "install" opens the onboarding tab (asserts chrome.tabs.create called with the onboarding.html URL) |
| TS-004 | unit | src/__tests__/background/index.test.ts :: onInstalled with reason "install" opens the onboarding tab (second half asserts tabs.create NOT called for reason 'update'; real onInstalled-update/browser-restart is in the infeasible register, unit-pinned here) |
| TS-005 | e2e | e2e/extension.spec.ts :: settings page renders all sections; e2e/settings.spec.ts :: Settings page loads (both navigate to chrome-extension://<id>/settings.html and assert rendered content) |
| TS-006 | e2e | e2e/extension.spec.ts :: onboarding page renders step 1 (shortcut picker); e2e/onboarding.spec.ts :: Onboarding page loads (navigate to chrome-extension://<id>/onboarding.html and assert rendered content) |
| TS-007 | infeasible | Toolbar icon rendering is native browser chrome, not scriptable (known register: real toolbar icon click); icon assets are unit-pinned in src/__tests__/assets/icons.test.ts :: ships icon-%i.png matching the WXT discoverIcons pattern / icon-%i.png is a valid PNG with exact %ix%i dimensions |
| TS-008 | e2e | e2e/robustness.spec.ts :: settings survive a browser restart on the same profile (TS-008) — fixed userDataDir relaunched, stored settings asserted intact |
| TS-009 | e2e+unit | e2e/command-bar.spec.ts :: Opens with shortcut (default Ctrl/Meta+Shift+Space, asserts overlay backdrop present); src/__tests__/content/index.test.tsx :: opens overlay when default shortcut Ctrl+Shift+Space is pressed (trusted) (asserts preventDefault + rendered overlay in shadow root) |
| TS-010 | e2e | e2e/command-bar.spec.ts :: Shortcut toggles close; e2e/keyboard.spec.ts :: Shortcut toggles command bar open and closed (both assert overlay open, press the same shortcut, assert backdrop gone) |
| TS-011 | e2e | e2e/command-bar.spec.ts :: Escape closes; e2e/keyboard.spec.ts :: Escape key closes the command bar (assert open -> press Escape -> backdrop absent) |
| TS-012 | e2e+unit | e2e/command-bar.spec.ts :: Backdrop click closes (clicks .smb-backdrop, asserts overlay closed); src/__tests__/components/CommandBar.test.tsx :: calls onDismiss when clicking the backdrop (also 'does not dismiss when clicking inside the container' for the boundary) |
| TS-013 | e2e | e2e/command-bar.spec.ts :: Escape closes; e2e/command-bar.spec.ts :: Shortcut toggles close (isOverlayOpen asserts querySelector('.smb-backdrop') returns null after close — the overlay's root element is absent from the shadow DOM, not merely hidden) |
| TS-014 | e2e+unit | e2e/command-bar.spec.ts :: Clean state on reopen (asserts input value '' when reopened after typing); src/__tests__/components/SearchInput.test.tsx :: has autoFocus set (asserts document.activeElement is the search input on render) |
| TS-015 | e2e | e2e/robustness.spec.ts :: closing the palette releases focus and keystrokes to the page (TS-015) — post-close typing reaches a host-page input |
| TS-016 | e2e+unit | e2e/command-bar.spec.ts :: Opens with shortcut (default config, Meta/Ctrl+Shift+Space per platform); src/__tests__/content/index.test.tsx :: opens overlay when default shortcut Ctrl+Shift+Space is pressed (trusted); src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Command+Shift+Space |
| TS-017 | unit | src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Ctrl+Shift+L; src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Command+Shift+L (it.each preset suite asserts preventDefault + rendered overlay) |
| TS-018 | e2e+unit | e2e/settings-live.spec.ts :: shortcut change applies live without a reload (sets shortcut 'Ctrl+.', asserts Control+Period opens the overlay and the old default is dead); src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Ctrl+.; src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Command+. |
| TS-019 | unit | src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Ctrl+/; src/__tests__/content/index.test.tsx :: opens the overlay for configured shortcut Command+/ (asserts preventDefault + rendered overlay) |
| TS-020 | infeasible | Real chrome.commands shortcuts set via chrome://extensions/shortcuts cannot be driven by Playwright (known register: real chrome.commands OS shortcuts); the toggle-command-bar command routing is unit-pinned in src/__tests__/background/index.test.ts :: toggle-command-bar with a scriptable tab arg sends typed TOGGLE_OVERLAY without tabs.query (plus the restricted-tab/openPopup and tabs.query fallback tests) |
| TS-021 | unit | src/__tests__/lib/url-safety.test.ts :: accepts http, https and file URLs (isInjectableUrl('http://example.com/') === true — the content script's injection gate, the only scheme-dependent step; injection + shortcut-open behavior on injectable pages is pinned by src/__tests__/content/index.test.tsx and the https e2e) |
| TS-022 | e2e+unit | e2e/command-bar.spec.ts :: Opens with shortcut (runs on https://example.com, asserts overlay opens); src/__tests__/content/index.test.tsx :: injects host element with shadow root on https pages |
| TS-023 | unit | src/__tests__/content/index.test.tsx :: skips injection on non-http(s)/file schemes (location chrome://newtab/ — asserts #slashmebaby-root is null); src/__tests__/lib/url-safety.test.ts :: rejects browser-internal and extension URLs (chrome://newtab/, chrome://extensions/ rejected); the compensating popup fallback on chrome:// pages is e2e-covered in e2e/action-routing.spec.ts :: keeps the default popup on chrome:// pages |
| TS-024 | unit | src/__tests__/lib/url-safety.test.ts :: rejects browser-internal and extension URLs (asserts isInjectableUrl('about:newtab') and isInjectableUrl('about:blank') are false — the content script's injection gate) |
| TS-025 | unit | src/__tests__/lib/url-safety.test.ts :: rejects browser-internal and extension URLs (asserts isInjectableUrl('chrome-extension://abcdef/popup.html') and moz-extension:// are false); src/__tests__/content/index.test.tsx :: skips injection on non-http(s)/file schemes pins the no-injection behavior for non-injectable schemes |
| TS-026 | e2e+unit | e2e/surface-parity.spec.ts :: popup and overlay render identical jump-first surfaces for the same data; e2e/command-bar.spec.ts :: Shows tree items on open; e2e/command-bar.spec.ts :: Actions section visible in tree view; src/__tests__/components/TreeView.test.tsx :: renders pinned tabs in the pinned grid; src/__tests__/components/TreeView.test.tsx :: renders the all-tabs grid with one cell per tab; src/__tests__/components/TreeView.test.tsx :: renders all 13 action items in grid and rows |
| TS-027 | superseded | Superseded by TS-026 (marked in TESTSCENARIOS.md: popup no longer shows a smart-suggestions list) |
| TS-028 | superseded | Superseded by TS-026 (marked in TESTSCENARIOS.md) |
| TS-029 | unit | src/__tests__/background/actions.test.ts :: shows "Mute Tab" when the tab is audible and not muted; src/__tests__/background/actions.test.ts :: shows "Unmute Tab" when the tab is already muted (even if silent); src/__tests__/background/index.test.ts :: contextualizes action labels to the sender tab (Unpin for pinned) — both surfaces render chip titles from this same GET_ACTIONS path |
| TS-030 | superseded | Merged into TS-029 (marked in TESTSCENARIOS.md) |
| TS-031 | superseded | Superseded (marked in TESTSCENARIOS.md: contextual-action prioritization retired with the smart-suggestions list; see TS-026) |
| TS-032 | e2e+unit | e2e/history-search.spec.ts :: results render Tabs → Bookmarks → History with per-group caps (asserts Open Tabs:2 for typed query); src/__tests__/components/CommandBar.test.tsx :: search includes open tabs, not just bookmarks |
| TS-033 | e2e | e2e/search-results.spec.ts :: Enter on a bookmark result navigates the current tab (fuzzy 'zebra' selects bookmark 'Zebra Notes'); e2e/search-results.spec.ts :: diacritics folding: 'sozcu' matches 'Sözcü' (asserts item inside Bookmarks section); e2e/history-search.spec.ts :: results render Tabs → Bookmarks → History with per-group caps (Bookmarks:2) |
| TS-034 | e2e+unit | e2e/history-search.spec.ts :: visited pages appear under History in overlay search; src/__tests__/components/CommandBar.test.tsx :: shows matching history items under a History header when searching |
| TS-035 | e2e+unit | e2e/search-results.spec.ts :: '>' shows only actions and '>clo' filters them; src/__tests__/components/surface-parity.test.tsx :: '/' then '>' enters action mode with identical Actions rows on both surfaces (asserts identical rows popup vs overlay) |
| TS-036 | unit | src/__tests__/components/CommandBar.test.tsx :: fuzzy search tolerates a typo in a tab title ('githb' asserted to surface 'GitHub' — same partial-match semantics as 'gmil'/'Gmail') |
| TS-037 | e2e+unit | e2e/search-results.spec.ts :: Enter on a bookmark result navigates the current tab (lowercase 'zebra' asserted to match 'Zebra Notes'); src/__tests__/components/CommandBar.test.tsx :: search includes open tabs, not just bookmarks (lowercase 'github' asserted to surface 'GitHub'); src/__tests__/lib/diacritics.test.ts :: lowercases ASCII uppercase |
| TS-038 | unit | src/__tests__/components/CommandBar.test.tsx :: matches a query that only appears in a URL field (TS-038) — 'xylophone' exists only in a bookmark URL |
| TS-039 | e2e+unit | e2e/search-navigation.spec.ts :: Search mode shows filtered results (clears input, asserts tree items reappear); src/__tests__/components/CommandBar.test.tsx :: clearing the query restores the normal tree state; src/__tests__/components/Popup.test.tsx :: native '/' keydown enters search mode and toggles back (popup side returns to jump placeholder) |
| TS-040 | e2e+unit | e2e/history-search.spec.ts :: results render Tabs → Bookmarks → History with per-group caps (asserts exact ordered shape); e2e/search-results.spec.ts :: go-to-URL row navigates for a path-bearing query (Navigate header present, row is last); src/__tests__/lib/search.test.ts :: groups results in order: tabs, bookmarks, history, actions; src/__tests__/components/CommandBar.test.tsx :: renders the Go-to row under a "Navigate" section header |
| TS-041 | e2e+unit | e2e/history-search.spec.ts :: results render Tabs → Bookmarks → History with per-group caps (asserts header text 'Open Tabs'/'Bookmarks'/'History'); src/__tests__/components/TreeView.test.tsx :: shows "Open Tabs" header before the first tab/group item; src/__tests__/components/TreeView.test.tsx :: shows "Bookmarks" header before the first folder/bookmark item |
| TS-042 | e2e+unit | e2e/search-results.spec.ts :: '>' shows only actions and '>clo' filters them (sections asserted equal to ['Actions'] — hitless groups render no section); e2e/settings-live.spec.ts :: disabling the bookmarks source removes the Bookmarks section live (header absent once the group has no results); src/__tests__/components/CommandBar.test.tsx :: ",>" alone lists all actions under an Actions header and hides other sources; src/__tests__/lib/search.test.ts :: returns empty array when no items match |
| TS-043 | e2e+unit | e2e/settings-live.spec.ts :: maxResultsPerGroup caps results and applies live while open (asserts default cap 5, then 2); src/__tests__/lib/search.test.ts :: limits results per group to default 5; src/__tests__/lib/search.test.ts :: respects custom maxResultsPerGroup option; src/__tests__/components/CommandBar.test.tsx :: caps each result group at maxResultsPerGroup |
| TS-044 | e2e+unit | e2e/history-search.spec.ts :: results render Tabs → Bookmarks → History with per-group caps (asserts exactly cap×groups rows: 2+2+2, no extra sections); src/__tests__/lib/search.test.ts :: limits results per group to default 5. Note: no test drives cap×groups past a hypothetical global cap, but the total bound itself is asserted |
| TS-045 | e2e+unit | src/__tests__/components/TreeItem.test.tsx :: renders the item title; e2e/search-results.spec.ts :: diacritics folding: 'sozcu' matches 'Sözcü' (asserts row titles read from .smb-title) |
| TS-046 | unit | src/__tests__/components/CommandBar.test.tsx :: rows expose the title via tooltip and aria-label, no visible URL (TS-046) — matches the reworded scenario (jump-first design shows no URL text) |
| TS-047 | unit | src/__tests__/components/TreeItem.test.tsx :: renders favicon when showFavicons is true and icon exists; src/__tests__/components/TreeItem.test.tsx :: does not render favicon when showFavicons is false (e2e/settings-live.spec.ts carries a NOTE: no honest e2e — fresh profiles cache no favicons, so the prop pass-through is unit-pinned) |
| TS-048 | e2e+unit | src/__tests__/components/Favicon.test.tsx :: renders a globe svg (not an img) after the proxied load also fails; src/__tests__/components/Favicon.test.tsx :: shows the globe if the proxied data: url also errors; e2e/favicon.spec.ts :: palette favicons never render as broken images |
| TS-049 | unit | src/__tests__/lib/search.test.ts :: items within tabs group are sorted by recency (most recent first) (1h-old tab asserted above 3h-old equally-matched tab); src/__tests__/lib/search.test.ts :: returns a smaller score for older timestamps |
| TS-050 | unit | src/__tests__/lib/search.test.ts :: returns a smaller score for older timestamps; src/__tests__/lib/search.test.ts :: works with a 168h (one week) half-life (the bookmarks half-life); src/__tests__/lib/search.test.ts :: items within tabs group are sorted by recency (most recent first) — pins the shared within-group recency sort used for all categories |
| TS-051 | unit | src/__tests__/lib/search.test.ts :: returns a smaller score for older timestamps (24h half-life); src/__tests__/lib/search.test.ts :: applies 60/40 weighting correctly; src/__tests__/lib/search.test.ts :: items within tabs group are sorted by recency (most recent first) — same ranking path applies to the history category |
| TS-052 | unit | src/__tests__/lib/search.test.ts :: returns 0 when halfLifeHours is 0 (actions category); src/__tests__/lib/search.test.ts :: handles action items with 0 half-life — recency score is 0 |
| TS-053 | e2e+unit | e2e/search-results.spec.ts :: '>' shows only actions and '>clo' filters them (sections asserted equal to ['Actions']); src/__tests__/components/CommandBar.test.tsx :: ",>" alone lists all actions under an Actions header and hides other sources (asserts tab/bookmark/history fixtures absent); src/__tests__/lib/search.test.ts :: returns only actions when query starts with > |
| TS-054 | e2e+unit | e2e/search-results.spec.ts :: '>' shows only actions and '>clo' filters them (lone '>' asserted to list >5 actions as the only section); src/__tests__/components/surface-parity.test.tsx :: '/' then '>' enters action mode with identical Actions rows on both surfaces |
| TS-055 | e2e+unit | e2e/search-results.spec.ts :: '>' shows only actions and '>clo' filters them (list shrinks and top hit asserted to be a Close-named action); src/__tests__/components/CommandBar.test.tsx :: ">pin" filters the action list (matching action kept, non-matching absent). Note: no assertion names both 'Close Tab' and 'Close Other Tabs' simultaneously — deliberately, since fuzzy matching keeps weak extra hits |
| TS-056 | e2e+unit | src/__tests__/components/CommandBar.test.tsx :: clearing the query restores the normal tree state (starts from '>', clears to empty, asserts tree returns); e2e/search-navigation.spec.ts :: Search mode shows filtered results (clearing the input asserted to bring tree items back) |
| TS-057 | unit | src/__tests__/lib/search.test.ts :: strips the > before searching; src/__tests__/components/CommandBar.test.tsx :: never matches ">" as literal text against tabs or bookmarks |
| TS-058 | e2e+unit | e2e/search-navigation.spec.ts :: Arrow down moves selection; src/__tests__/components/CommandBar.test.tsx :: ArrowDown still moves one item at a time in search mode |
| TS-059 | e2e | e2e/search-navigation.spec.ts :: Arrow up moves selection (unit CommandBar ArrowUp tests are smoke-only, not credited) |
| TS-060 | unit | src/__tests__/components/CommandBar.test.tsx :: ArrowDown crosses from the last tab into the first bookmark section (TS-060) |
| TS-061 | unit | src/__tests__/components/CommandBar.test.tsx :: ArrowDown crosses from the last tab into the first bookmark section (TS-060) — final ArrowUp assertion crosses back into the previous section's last item |
| TS-062 | e2e+unit | e2e/keyboard.spec.ts :: Tab jumps to the next result section in search mode and Shift+Tab returns; src/__tests__/components/CommandBar.test.tsx :: Tab jumps from the tabs section to the first bookmark result; src/__tests__/components/CommandBar.test.tsx :: Tab walks section starts and wraps to the top; src/__tests__/components/CommandBar.test.tsx :: Tab wraps from the last top-level folder to the first |
| TS-063 | e2e+unit | e2e/keyboard.spec.ts :: Tab jumps to the next result section in search mode and Shift+Tab returns; src/__tests__/components/CommandBar.test.tsx :: Shift+Tab from the first result wraps to the last section start; src/__tests__/components/CommandBar.test.tsx :: Shift+Tab from a folder's child jumps to the PREVIOUS group (wrapping) |
| TS-064 | e2e+unit | e2e/search-results.spec.ts :: Enter on a bookmark result navigates the current tab; src/__tests__/components/CommandBar.test.tsx :: Enter on a bookmark URL dispatches NAVIGATE; src/__tests__/components/CommandBar.test.tsx :: Enter on an action row dispatches EXECUTE_ACTION and dismisses on success |
| TS-065 | e2e+unit | e2e/keyboard.spec.ts :: Escape key closes the command bar; e2e/command-bar.spec.ts :: Escape closes; src/__tests__/lib/palette-keys.test.ts :: Escape yields dismiss |
| TS-066 | e2e+unit | e2e/command-bar.spec.ts :: Backspace on empty does NOT close; e2e/popup-keyboard.spec.ts :: Backspace never closes the popup; Escape does; src/__tests__/components/surface-parity.test.tsx :: Backspace is inert on both surfaces (never closes, never navigates) |
| TS-067 | e2e+unit | e2e/popup-keyboard.spec.ts :: Backspace never closes the popup; Escape does (asserts 'exa' -> 'ex' after Backspace); src/__tests__/lib/palette-keys.test.ts :: Backspace is not special-cased: passes with a writable input, forwards without one |
| TS-068 | e2e+unit | e2e/keyboard.spec.ts :: Tab jumps to the next result section in search mode and Shift+Tab returns (initial poll asserts selection sits in first section 'Open Tabs' when results appear); src/__tests__/components/CommandBar.test.tsx :: Tab moves selection to the next top-level folder (premise assertion: first item 'Bookmarks Bar' selected on render) |
| TS-069 | unit | src/__tests__/components/TreeItem.test.tsx :: shows keyboard hint when selected |
| TS-070 | unit | src/__tests__/components/TreeItem.test.tsx :: does not show keyboard hint when not selected |
| TS-071 | e2e+unit | e2e/actions.spec.ts :: Action c: Close Tab; src/__tests__/background/actions.test.ts :: executes close-tab action |
| TS-072 | e2e+unit | e2e/actions.spec.ts :: Action x: Close Other Tabs; src/__tests__/background/actions.test.ts :: executes close-other-tabs action (keeps active tab, skips pinned) |
| TS-073 | unit | src/__tests__/background/actions.test.ts :: executes pin-tab action (toggles pinned state); src/__tests__/background/actions.test.ts :: with a pinned-tab context, labels the pin action "Unpin Tab" (e2e 'Action p: Pin Tab' asserts only overlay dismissal, not credited) |
| TS-074 | unit | src/__tests__/background/actions.test.ts :: executes pin-tab action — already pinned tab gets unpinned; src/__tests__/background/actions.test.ts :: with an unpinned-tab context, labels the pin action "Pin Tab" |
| TS-075 | unit | src/__tests__/background/actions.test.ts :: shows "Mute Tab" when the tab is audible and not muted; src/__tests__/background/actions.test.ts :: executes mute-tab action (toggles muted state) (e2e 'Action m: Mute Tab' asserts only overlay dismissal, not credited) |
| TS-076 | unit | src/__tests__/background/actions.test.ts :: shows "Unmute Tab" when the tab is already muted (even if silent); src/__tests__/background/actions.test.ts :: executes mute-tab action — already muted tab gets unmuted |
| TS-077 | unit | src/__tests__/background/actions.test.ts :: hides the mute action when the tab is neither audible nor muted; src/__tests__/background/actions.test.ts :: never suggests the mute action for a silent unmuted tab |
| TS-078 | e2e+unit | e2e/actions.spec.ts :: Action d: Duplicate Tab; src/__tests__/background/actions.test.ts :: executes duplicate-tab action |
| TS-079 | unit | src/__tests__/background/actions.test.ts :: executes move-to-window action (asserts windows.create({tabId:42})); e2e 'Action w: Move to New Window' asserts only overlay dismissal, not credited |
| TS-080 | unit | src/__tests__/background/actions.test.ts :: executes reload-tab action (asserts tabs.reload(42)); e2e 'Action r: Reload Tab' asserts only dismissal and unchanged URL, not credited |
| TS-081 | e2e+unit | e2e/actions.spec.ts :: Action t: New Tab; src/__tests__/background/actions.test.ts :: executes new-tab action |
| TS-082 | e2e+unit | e2e/actions.spec.ts :: Action z: Recently Closed (overlay dismissed in one shot, no sub-list); src/__tests__/background/actions.test.ts :: falls back to restoring last closed session when no undo is recorded (asserts sessions.restore('sess-1') in a single execute) |
| TS-083 | unit | src/__tests__/background/actions.test.ts :: after closing a tab, undo restores recently-closed sessions; src/__tests__/background/actions.test.ts :: after closing a tab, undo restores a whole-window session when that is what was closed (covers the close-tab path; Close Other/Duplicates variants untested but same undo mechanism) |
| TS-084 | e2e+unit | e2e/search-results.spec.ts :: go-to-URL row navigates for a path-bearing query; src/__tests__/components/CommandBar.test.tsx :: appends a "Go to" row for a domain-like query; src/__tests__/components/CommandBar.test.tsx :: Enter on the Go-to row navigates the current tab and dismisses |
| TS-085 | e2e+unit | e2e/actions.spec.ts :: Action q: Close All Duplicates; src/__tests__/background/actions.test.ts :: executes close-duplicates action (asserts tab 2 removed, tabs 1 and 3 kept) |
| TS-086 | unit | src/__tests__/background/actions.test.ts :: executes sort-by-domain action — asserts the exact move sequence [[2,0],[3,1],[1,2]] (alpha < middle < zebra) |
| TS-087 | e2e+unit | e2e/actions.spec.ts :: Action comma: Settings; src/__tests__/background/actions.test.ts :: executes settings action |
| TS-088 | e2e+unit | e2e/jump-labels.spec.ts :: tab-grid label switches to that tab (asserts active tab URL via service worker); src/__tests__/components/CommandBar.test.tsx :: label key for a tab dispatches SWITCH_TAB |
| TS-089 | e2e+unit | e2e/search-results.spec.ts :: Enter on a bookmark result navigates the current tab; e2e/jump-labels.spec.ts :: single-char label activates a bookmark and navigates the current tab; src/__tests__/components/CommandBar.test.tsx :: Enter on a bookmark URL dispatches NAVIGATE |
| TS-090 | unit | src/__tests__/components/CommandBar.test.tsx :: Enter on a history item dispatches NAVIGATE to its URL; src/__tests__/background/index.test.ts :: updates active tab URL when active tab exists (NAVIGATE handler) |
| TS-091 | e2e+unit | src/__tests__/components/CommandBar.test.tsx :: keeps the overlay open and shows an error strip on failure; src/__tests__/components/CommandBar.test.tsx :: auto-hides the error strip after ~2.5 seconds; src/__tests__/components/CommandBar.test.tsx :: still dismisses on success; e2e/actions.spec.ts :: Action u: Copy Clean Link strips tracking params and dismisses (success-path dismissal) |
| TS-092 | unit | src/__tests__/lib/storage.test.ts :: writes settings to chrome.storage.sync under "settings" key; src/__tests__/lib/storage.test.ts :: round-trips: saved settings are returned by getSettings (restart persistence itself rides on chrome.storage.sync; e2e uses an ephemeral profile) |
| TS-093 | infeasible | storage.sync cross-device propagation requires two signed-in browser profiles on separate devices (known infeasible register: storage.sync cross-device); the sync write itself is pinned by storage.test.ts |
| TS-094 | e2e+unit | src/__tests__/lib/storage.test.ts :: returns DEFAULT_SETTINGS when storage is empty; e2e/settings.spec.ts :: Default shortcut selected |
| TS-095 | e2e+unit | e2e/settings.spec.ts :: Shows shortcut options; src/__tests__/components/Settings.test.tsx :: renders all 4 shortcut options |
| TS-096 | unit | src/__tests__/components/platform-labels.test.tsx :: shows ⌘ labels on macOS / shows Ctrl labels on non-mac platforms — UA stubbed per case with vi.resetModules + fresh import |
| TS-097 | e2e+unit | e2e/settings-live.spec.ts :: shortcut change applies live without a reload; src/__tests__/content/index.test.tsx :: updates shortcut when chrome.storage.onChanged fires for sync area |
| TS-098 | e2e+unit | e2e/settings-live.spec.ts :: shortcut change applies live without a reload (old default asserted dead after propagation is proven); src/__tests__/content/index.test.tsx :: does not open for old default after a preset change |
| TS-099 | e2e+unit | e2e/settings-live.spec.ts :: position setting controls overlay placement (top/center/bottom) (center box at 15-30% of viewport); src/__tests__/components/CommandBar.test.tsx :: applies the correct position class; src/__tests__/components/CommandBar.test.tsx :: calls onDismiss when clicking the backdrop |
| TS-100 | e2e | e2e/settings-live.spec.ts :: position setting controls overlay placement (top/center/bottom) (asserts smb-container--top class and box.top <= 80px) |
| TS-101 | e2e | e2e/settings-live.spec.ts :: position setting controls overlay placement (top/center/bottom) (asserts smb-container--bottom class and innerHeight - box.bottom <= 80px) |
| TS-102 | e2e | e2e/settings-live.spec.ts :: position setting controls overlay placement (top/center/bottom) (setSetting then re-open, polls for the new smb-container--{position} class each time) |
| TS-103 | unit | src/__tests__/hooks/useTheme.test.tsx :: returns "dark" when setting is "system" and OS prefers dark; src/__tests__/components/CommandBar.test.tsx :: setting 'system' resolves from prefers-color-scheme and tracks it live (real OS-level theme flip is in the infeasible register; mocked matchMedia pins the semantics) |
| TS-104 | unit | src/__tests__/hooks/useTheme.test.tsx :: returns "light" when setting is "system" and OS prefers light; src/__tests__/hooks/useTheme.test.tsx :: updates when system theme changes |
| TS-105 | e2e+unit | src/__tests__/components/CommandBar.test.tsx :: setting 'light' lands data-theme='light' on the shadow host (page prefers dark — explicit setting must win); src/__tests__/hooks/useTheme.test.tsx :: returns "light" when setting is "light"; e2e/settings-live.spec.ts :: seeded theme lands data-theme on the live overlay and switches live |
| TS-106 | e2e+unit | src/__tests__/components/CommandBar.test.tsx :: setting 'dark' lands data-theme='dark' on the shadow host (page prefers light — explicit setting must win); src/__tests__/hooks/useTheme.test.tsx :: returns "dark" when setting is "dark"; e2e/settings-live.spec.ts :: seeded theme lands data-theme on the live overlay and switches live |
| TS-107 | unit | src/__tests__/lib/search.test.ts :: respects custom maxResultsPerGroup option (7 items, cap exactly 3, asserts <= 3); src/__tests__/components/Settings.test.tsx :: reflects a non-default stored value (stored 3 shown selected) |
| TS-108 | e2e+unit | src/__tests__/lib/search.test.ts :: limits results per group to default 5; e2e/settings-live.spec.ts :: maxResultsPerGroup caps results and applies live while open (8 seeded bookmarks, default cap polls to exactly 5 rows) |
| TS-109 | unit | src/__tests__/components/Settings.test.tsx :: calls onUpdate with a number when a different count is selected (asserts onUpdate('maxResultsPerGroup', 8)); src/__tests__/lib/search.test.ts :: respects custom maxResultsPerGroup option (engine honors any configured cap) — covered compositionally |
| TS-110 | unit | src/__tests__/components/TreeItem.test.tsx :: renders favicon when showFavicons is true and icon exists (asserts img.smb-favicon with src); src/__tests__/components/Settings.test.tsx :: is on by default (aria-checked true). No honest e2e per note in e2e/settings-live.spec.ts: fresh Playwright profiles have no cached favicons |
| TS-111 | unit | src/__tests__/components/TreeItem.test.tsx :: does not render favicon when showFavicons is false (asserts img.smb-favicon is null, nothing rendered in its place); src/__tests__/components/Settings.test.tsx :: calls onUpdate with false when toggled off |
| TS-112 | unit | src/__tests__/components/CommandBar.test.tsx :: omits tabs from search results when searchSources.tabs is false; src/__tests__/background/index.test.ts :: omits the tabs group when searchSources.tabs is toggled off |
| TS-113 | e2e+unit | e2e/settings-live.spec.ts :: disabling the bookmarks source removes the Bookmarks section live; src/__tests__/components/CommandBar.test.tsx :: omits bookmarks from search results when searchSources.bookmarks is false |
| TS-114 | unit | src/__tests__/components/CommandBar.test.tsx :: omits history from search results when searchSources.history is false |
| TS-115 | e2e | e2e/settings-live.spec.ts :: disabling the bookmarks source removes the Bookmarks section live — extended: re-enables the source and polls the Bookmarks header returning |
| TS-116 | unit | src/__tests__/background/index.test.ts :: still suggests actions when every search source is toggled off (all three sources false; asserts tabs/bookmarks groups absent and the actions group present with items.length > 0) |
| TS-117 | e2e+unit | e2e/onboarding.spec.ts :: Step 1 shows shortcut options; e2e/extension.spec.ts :: onboarding page renders step 1 (shortcut picker); src/__tests__/components/Onboarding.test.tsx :: renders all 4 shortcut options; calls onSelect when an option is clicked |
| TS-118 | e2e+unit | e2e/onboarding.spec.ts :: Next advances to step 2; src/__tests__/components/Onboarding.test.tsx :: calls onSelect when an option is clicked; advances to step 1 (TryItStep) when Next is clicked |
| TS-119 | unit | src/__tests__/components/Onboarding.test.tsx :: renders the shortcut in the prompt (TryItStep renders the passed shortcut, asserted with a non-default value); calls onSelect when an option is clicked (selection emits the chosen shortcut) |
| TS-120 | e2e+unit | src/__tests__/components/Onboarding.test.tsx :: renders the animated bar placeholder; asks the user to try it on a regular website tab; explains the popup fallback on restricted pages; e2e/extension.spec.ts :: onboarding advances through all 5 steps (Next on step 2 asserted to land on step 3) |
| TS-121 | e2e+unit | e2e/onboarding.spec.ts :: Step 3 shows navigation guide (title + 5 key rows); src/__tests__/components/Onboarding.test.tsx :: renders all keyboard navigation hints; renders key badges |
| TS-122 | unit | src/__tests__/components/Onboarding.test.tsx :: renders pro tips (asserts 'Use the > prefix' on the completion step, now step 5 of the 5-step flow) |
| TS-123 | unit | src/__tests__/components/Onboarding.test.tsx :: renders pro tips (asserts 'Customize in settings') |
| TS-124 | unit | src/__tests__/components/Onboarding.test.tsx :: marks onboarding as completed when Start Browsing is clicked (asserts chrome.storage.local.set with completed: true) |
| TS-125 | e2e+unit | e2e/extension.spec.ts :: onboarding page renders step 1 (shortcut picker) (5 dots); e2e/design-baselines.spec.ts :: onboarding steps match baselines (dark) (active/completed dot states inside .smb-onboarding-container pixel-pinned per step); src/__tests__/components/Onboarding.test.tsx :: renders 5 progress dots |
| TS-126 | unit | src/__tests__/components/Onboarding.test.tsx :: saves progress when advancing steps (each advance persists completedStep to chrome.storage.local, so closing mid-flow loses nothing) |
| TS-127 | unit | src/__tests__/components/Onboarding.test.tsx :: resumes from saved step; shows the pin step when resuming at step 3; falls back to the completion step for out-of-range saved steps |
| TS-128 | unit | src/__tests__/components/Onboarding.test.tsx :: saves progress when advancing steps; marks onboarding as completed when Start Browsing is clicked (both assert the exact { onboarding: { completedStep, completed } } shape) |
| TS-129 | infeasible | Real toolbar icon click cannot be automated; the routing that arms the popup fallback on chrome:// tabs is unit-pinned in src/__tests__/background/action-routing.test.ts :: onUpdated url change into chrome:// restores the manifest default popup; onActivated restores the default popup on a restricted tab; calls openPopup synchronously for restricted tabs without querying tabs |
| TS-130 | infeasible | Real toolbar icon click cannot be automated; about: pages' restricted classification is unit-pinned in src/__tests__/lib/url-safety.test.ts :: rejects browser-internal and extension URLs (about:newtab/about:blank not injectable), feeding the restricted-tab popup arming pinned in src/__tests__/background/action-routing.test.ts |
| TS-131 | e2e+unit | e2e/popup.spec.ts :: Shows search input; src/__tests__/components/Popup.test.tsx :: renders the same jump-first palette surface as the overlay |
| TS-132 | e2e+unit | e2e/popup-keyboard.spec.ts :: opens in jump mode; '/' enters typed search which filters immediately; src/__tests__/components/Popup.test.tsx :: filters client-side and never sends SEARCH or SMART_SUGGESTIONS; src/__tests__/components/surface-parity.test.tsx :: '/' toggles into typed search and back identically on both surfaces |
| TS-133 | e2e+unit | e2e/popup-keyboard.spec.ts :: jump label in the popup switches the active tab; e2e/surface-parity.spec.ts :: a digit key switches to the pinned tab from the popup; src/__tests__/components/Popup.test.tsx :: clicking a tab in the grid sends SWITCH_TAB and closes the window; a jump label key on entry switches to the labeled tab |
| TS-134 | e2e+unit | e2e/popup.spec.ts :: Has no backdrop; src/__tests__/components/Popup.test.tsx :: has no backdrop and uses the popup container variant |
| TS-135 | e2e | e2e/design-baselines.spec.ts :: popup jump view matches baseline (dark and light) (asserts data-theme flips with the setting, pixel baseline per theme); e2e/surface-parity-visual.spec.ts :: the results region renders pixel-identical (within tolerance) in popup and overlay (asserts both surfaces settle on the same theme before comparing) |
| TS-136 | unit | src/__tests__/components/surface-parity.test.tsx :: Tab and Shift+Tab land on the same section-jump targets on both surfaces (asserted on the popup surface); src/__tests__/components/Popup.test.tsx :: Enter with no matching results neither acts nor closes; src/__tests__/components/CommandBar.test.tsx :: search-mode ArrowDown/ArrowUp still cycle the selection one item at a time (same CommandBar component the popup renders) |
| TS-137 | e2e+unit | e2e/command-bar.spec.ts :: Opens with shortcut; src/__tests__/content/index.test.tsx :: injects host element with shadow root on https pages |
| TS-138 | e2e | e2e/robustness.spec.ts :: overlay resists hostile host-page CSS (TS-138/140/141/142) — aggressive inherited body styles injected; overlay computed font-size/family/color asserted on tokens |
| TS-139 | unit | src/__tests__/content/index.test.tsx :: injects host element with shadow root on https pages |
| TS-140 | e2e | e2e/robustness.spec.ts :: overlay resists hostile host-page CSS (TS-138/140/141/142) — global `* { margin/padding/box-sizing !important }` reset in the same payload |
| TS-141 | e2e | e2e/robustness.spec.ts :: overlay resists hostile host-page CSS (TS-138/140/141/142) — framework-style aggressive element selectors (`div, span, input { all: revert !important }`) in the same payload; this payload caught and fixed a real font-family leak (see :host !important reset in command-bar.css) |
| TS-142 | e2e | e2e/robustness.spec.ts :: overlay resists hostile host-page CSS (TS-138/140/141/142) — high-specificity injected rules (`div[id] span`) in the same payload, lime/letter-spacing asserted NOT applied |
| TS-143 | e2e+unit | e2e/command-bar.spec.ts :: Opens with shortcut; src/__tests__/content/index.test.tsx :: injects host element with shadow root on https pages |
| TS-144 | unit | src/__tests__/content/index.test.tsx :: injects host element with shadow root on https pages |
| TS-145 | e2e | e2e/extension.spec.ts :: extension loads without console errors; e2e/command-bar.spec.ts :: Opens with shortcut |
| TS-146 | manual | scripts/firefox-smoke-test.sh (Firefox build, MV2 manifest checks, web-ext lint); runtime P0 pass in real Firefox is human-verified (register: Firefox runtime behavior) |
| TS-147 | manual | Requires loading the Chrome build in real Brave; no automation harness for Chromium forks |
| TS-148 | manual | Requires loading the Chrome build in real Microsoft Edge; no automation harness for Chromium forks |
| TS-149 | infeasible | Web Store review acceptance is external (register: real Web Store page); manifest floors are unit-pinned in src/__tests__/manifest.test.ts :: chrome manifest requires minimum_chrome_version 127 for action.openPopup |
| TS-150 | manual | scripts/firefox-smoke-test.sh (MV2 manifest validation incl. gecko strict_min_version 126.0 + web-ext lint); AMO review acceptance itself is external |
| TS-151 | unit | src/__tests__/background/index.test.ts :: returns flat "Open Tabs" group for single window, no tab groups; src/__tests__/background/index.test.ts :: groups tabs by tab group when chrome.tabGroups is available |
| TS-152 | manual | .github/workflows/ci.yml build job (steps 'Build Chrome MV3 bundle' and 'Build Firefox MV2 bundle' + extension-bundles artifact upload) — verified by every CI run, not by a test suite |
| TS-153 | manual | e2e/perf.spec.ts :: palette open and search latency logs [PERF-E2E] open timings for human review; the 50ms target is deliberately not asserted (loose <5s sanity bound to avoid flakes) |
| TS-154 | manual | e2e/perf.spec.ts :: palette open and search latency logs [PERF-E2E] query→filtered-results timings; the 16ms target is deliberately not asserted (flake policy) |
| TS-155 | manual | Zero-impact-when-inactive requires DevTools performance profiling of a host page with the extension idle; no automated proxy exists |
| TS-156 | unit | src/__tests__/background/index.test.ts :: returns grouped search results for tabs |
| TS-157 | manual | PERF=1-gated benchmark src/__tests__/perf/search-router.perf.test.ts :: measures SEARCH round-trip through the message router (100-tab corpus; timings logged to PERF_OUT, thresholds deliberately unasserted) |
| TS-158 | manual | PERF=1-gated benchmark src/__tests__/perf/search-router.perf.test.ts :: measures SEARCH round-trip through the message router (1,000-item history corpus; timings logged, no 16ms assertion) |
| TS-159 | manual | Service-worker memory usage needs a human check via the browser task manager / DevTools memory profiling; no automated measurement in the harness |
| TS-160 | unit | src/__tests__/components/CommandBar.test.tsx :: open/close animation duration token is 150ms (TS-160) — pins --duration-base and its use on .smb-container |
| TS-161 | unit | src/__tests__/background/index.test.ts :: returns 0 groups when there are no tabs; src/__tests__/hooks/useTreeData.test.tsx :: handles empty responses gracefully; src/__tests__/components/TreeView.test.tsx :: renders with no visible items (just actions) |
| TS-162 | unit | src/__tests__/lib/search.test.ts :: returns correct grouped results over a 120-tab corpus (describe 'search engine at scale (TS-162)') |
| TS-163 | unit | src/__tests__/hooks/useTreeData.test.tsx :: handles empty responses gracefully; src/__tests__/components/TreeView.test.tsx :: renders with no visible items (just actions) |
| TS-164 | unit | src/__tests__/lib/search.test.ts :: handles empty items array without crashing; src/__tests__/background/history.test.ts :: returns empty array before refresh |
| TS-165 | unit | src/__tests__/components/CommandBar.test.tsx :: long titles truncate on a single line with an ellipsis (TS-165) + long grid titles truncate on a single line with an ellipsis (TS-165) — pins nowrap/hidden/ellipsis on .smb-title and .smb-tab-col-title |
| TS-166 | superseded | No URL element exists in the jump-first design (TS-046 rewording); the dead .smb-url CSS rule was removed. URL truncation is not a reachable state — superseded by TS-165 (title truncation) |
| TS-167 | e2e+unit | e2e/favicon.spec.ts :: palette favicons never render as broken images; src/__tests__/components/Favicon.test.tsx :: renders a globe svg (not an img) after the proxied load also fails |
| TS-168 | e2e | e2e/robustness.spec.ts :: rapid shortcut toggling never duplicates the overlay (TS-168) — 6 rapid presses, exactly one host, ≤1 backdrop, no extension console errors |
| TS-169 | e2e | e2e/keystroke-leak.spec.ts :: palette search keystrokes do not leak to the host page; e2e/perf.spec.ts :: palette open and search latency |
| TS-170 | unit | src/__tests__/components/CommandBar.test.tsx :: a no-match query renders an empty list and Enter is a no-op (TS-170) |
| TS-171 | unit | src/__tests__/components/CommandBar.test.tsx :: renders HTML-special characters in titles as literal text (TS-171) |
| TS-172 | e2e | e2e/keystroke-leak.spec.ts :: palette search keystrokes do not leak to the host page |
| TS-173 | unit | src/__tests__/background/index.test.ts :: reloads a discarded tab after activating it |
| TS-174 | unit | src/__tests__/background/actions.test.ts :: close-duplicates returns success when there are no duplicates |
| TS-175 | unit | src/__tests__/background/actions.test.ts :: sort-by-domain succeeds with a single-tab corpus (TS-175) |
| TS-176 | unit | src/__tests__/background/actions.test.ts :: undo with no recorded entry and no closed sessions still returns success |
| TS-177 | e2e+unit | e2e/surface-parity.spec.ts :: popup and overlay render identical jump-first surfaces for the same data (asserts readOnly=true and gridLabels>0 plus full-state equality); e2e/popup-keyboard.spec.ts :: opens in jump mode; '/' enters typed search which filters immediately; src/__tests__/components/surface-parity.test.tsx :: popup and overlay render identical entry state: jump placeholder and read-only input |
| TS-178 | e2e+unit | e2e/surface-parity.spec.ts :: a digit key switches to the pinned tab from the popup (polls active-tab URL via SW); src/__tests__/components/surface-parity.test.tsx :: a digit key sends the same SWITCH_TAB pinned-tab message from both surfaces, exactly once |
| TS-179 | e2e+unit | e2e/popup-keyboard.spec.ts :: opens with jump labels; '/' toggles typed search and back (asserts readOnly false then true); src/__tests__/components/surface-parity.test.tsx :: '/' toggles into typed search and back identically on both surfaces |
| TS-180 | e2e+unit | e2e/popup-keyboard.spec.ts :: Backspace never closes the popup; Escape does (asserts popup.isClosed() false after Backspace, true after Escape); e2e/command-bar.spec.ts :: Backspace on empty does NOT close; e2e/command-bar.spec.ts :: Escape closes; src/__tests__/components/surface-parity.test.tsx :: Backspace is inert on both surfaces (never closes, never navigates) |
| TS-181 | e2e+unit | e2e/surface-parity.spec.ts :: popup and overlay render identical jump-first surfaces for the same data (toEqual on headers, gridLabels, treeBadges, sections); src/__tests__/components/surface-parity.test.tsx :: popup and overlay render identical section header sequences; popup and overlay render identical tab-grid label sets; popup and overlay render identical bookmark tree-row label badges |
| TS-182 | e2e | e2e/surface-parity-visual.spec.ts :: the results region renders pixel-identical (within tolerance) in popup and overlay (asserts equal capture dimensions and pixelmatch diffRatio <= 0.005 at equalized 720px width) |
| TS-183 | e2e+unit | e2e/surface-parity.spec.ts :: a two-char label combo activates from the popup (polls for the target seed URL opening); src/__tests__/components/surface-parity.test.tsx :: two-char labels appear and activate the same target on both surfaces |
| TS-184 | unit | src/__tests__/background/index.test.ts :: reloads a discarded tab after activating it (asserts tabs.reload(7) and activate→focus→reload ordering); e2e/tab-states.spec.ts :: activating a hibernated tab from the palette reloads and shows the page exists but is test.fixme-gated (chrome.tabs.discard segfaults the Chromium-for-Testing build); manual check via Memory Saver per spec header |
| TS-185 | unit | src/__tests__/background/index.test.ts :: reloads a discarded tab after activating it (wake path is surface-agnostic SWITCH_TAB); src/__tests__/components/surface-parity.test.tsx :: a digit key sends the same SWITCH_TAB pinned-tab message from both surfaces, exactly once (popup leg emits the identical message); e2e/tab-states.spec.ts :: activating a hibernated tab from the popup reloads and shows the page is fixme-gated (same chrome.tabs.discard segfault) |
| TS-186 | unit | src/__tests__/components/surface-parity.test.tsx :: popup and overlay render identical sleep badges on discarded tab rows; src/__tests__/components/TreeView.test.tsx :: shows a sleep badge on discarded tabs in the tab grid; src/__tests__/components/TreeItem.test.tsx :: shows a sleep badge on a discarded tab row in search mode; e2e/tab-states.spec.ts :: discarded tabs show the sleep badge on both surfaces is fixme-gated (chrome.tabs.discard segfault) |
| TS-187 | unit | src/__tests__/background/index.test.ts :: reloads a frozen tab after activating it (asserts tabs.reload(7)); src/__tests__/background/index.test.ts :: folds frozen (Chrome-only) into discarded: true |
| TS-188 | manual | Marked Manual in TESTSCENARIOS.md (TS-188 row): incognito is in the infeasible register — no `incognito` manifest key, palette invisibility verified by enabling 'Allow in Incognito' by hand |
| TS-189 | e2e | e2e/design-baselines.spec.ts :: overlay jump view matches baseline (dark, center) (toHaveScreenshot overlay-jump-dark.png with pinned grid, baseline checked in under e2e/__screenshots__/darwin/) |
| TS-190 | e2e | e2e/design-baselines.spec.ts :: overlay position variants match baseline (dark) (toHaveScreenshot overlay-jump-top-dark.png and overlay-jump-bottom-dark.png) |
| TS-191 | e2e | e2e/design-baselines.spec.ts :: overlay search results match baseline (dark) (polls until History section present, then toHaveScreenshot overlay-search-example-dark.png) |
| TS-192 | e2e | e2e/design-baselines.spec.ts :: overlay action mode matches baseline (dark) (asserts Actions header then toHaveScreenshot overlay-actions-dark.png) |
| TS-193 | e2e | e2e/design-baselines.spec.ts :: overlay jump view matches baseline (light) (toHaveScreenshot overlay-jump-light.png after data-theme=light gate) |
| TS-194 | e2e | e2e/design-baselines.spec.ts :: popup jump view matches baseline (dark and light) (toHaveScreenshot popup-jump-dark.png and popup-jump-light.png) |
| TS-195 | e2e | e2e/design-baselines.spec.ts :: popup search and action modes match baseline (dark) (toHaveScreenshot popup-search-example-dark.png and popup-actions-dark.png) |
| TS-196 | e2e | e2e/design-baselines.spec.ts :: settings page matches baseline (dark and light) (emulates prefers-color-scheme, toHaveScreenshot settings-dark.png and settings-light.png) |
| TS-197 | e2e | e2e/design-baselines.spec.ts :: onboarding steps match baselines (dark) (toHaveScreenshot onboarding-step1..5-dark.png with the async pin-status badge masked) |
| TS-198 | e2e | e2e/design-baselines.spec.ts :: error strip visible state matches baseline (dark) (forces the visible strip state, toHaveScreenshot overlay-error-strip-dark.png; trigger logic pinned separately by CommandBar unit tests) |

## Feature map

| Feature | Name | Covered by scenario rows |
|---------|------|--------------------------|
| F01 | Command bar overlay | TS-009..TS-015, TS-129..TS-137 (Shadow DOM), TS-189 |
| F02 | Tab search & switch | TS-032, TS-041..TS-044, TS-184..TS-187 (hibernation) |
| F03 | Bookmark search | TS-033, TS-045 |
| F04 | History search | TS-034, TS-047 |
| F05 | Recency scoring (background SEARCH API) | TS-048..TS-052 |
| F06 | Grouped results | TS-040..TS-046 |
| F07 | Keyboard navigation | TS-053..TS-070 |
| F08 | Smart suggestions | Superseded — TS-026..TS-031 rewritten/superseded |
| F09 | Tab actions | TS-071..TS-085 |
| F10 | Navigation actions | TS-087..TS-090 |
| F11 | Utility actions | TS-086, TS-091..TS-093 |
| F12 | Action prefix mode | TS-053..TS-059 |
| F13 | Keyboard shortcut | TS-016..TS-020, TS-094..TS-098 |
| F14 | Theme | TS-104..TS-108, TS-193..TS-196 |
| F15 | Shadow DOM isolation | TS-129..TS-142 |
| F16 | Cross-browser | TS-143..TS-149 |
| F17 | Onboarding | TS-116..TS-125, TS-197 |
| F18 | Settings | TS-099..TS-115 |
| F19 | Position options | TS-101..TS-103, TS-190 |
| F20 | Icon click & popup | TS-126..TS-128, TS-177..TS-183 |
| F21-F24 | (not implemented) | n/a |
| F25 | Tree view | TS-063..TS-066 |
| F26 | EasyJump labels | TS-067..TS-070, TS-183 |
| F27 | Jump/search toggle | TS-062, TS-179 |
| F28 | Smart tab grouping | TS-150..TS-153 |
| F29 | Nested bookmark folders | TS-064..TS-066 |

## Known-untestable register

- Real toolbar icon click (`action.onClicked` user gesture) — routing unit-tested; physical click manual.
- Browser-level `chrome.commands` shortcuts and `chrome://extensions/shortcuts` customization — Playwright cannot deliver OS-level commands; the in-page shortcut path is e2e-covered.
- The native 720×540 action-popup window chrome — popup.html is tested as a tab; the real popup frame is manual.
- Firefox MV2 runtime behavior — built + smoke-linted by `scripts/firefox-smoke-test.sh`; interactive behavior manual.
- Incognito mode — requires manual per-profile enablement (no `incognito` manifest key).
- Enterprise-policy pages (`runtime_blocked_hosts`) — needs managed-policy provisioning.
- Real Chrome Web Store page injection block — host blocklist unit-tested; the real page manual.
- `storage.sync` cross-device propagation — local semantics unit-tested.
- `onInstalled` reason `update` in a live browser — unit-pinned.
- OS-level `prefers-color-scheme` flip — emulated via `emulateMedia`; the OS toggle manual.
- `chrome.tabs.discard` e2e — segfaults the current Chromium-for-Testing build (macOS arm64); complete specs are fixme-gated in `e2e/tab-states.spec.ts`, behavior unit-pinned, manual via Memory Saver.

## Regeneration procedure

1. Freeze scope: `grep -o "TS-[0-9]\{3\}" TESTSCENARIOS.md | sort -u` — the map row count MUST equal this count.
2. Harvest candidates per row by keyword over `e2e/*.spec.ts` and `src/__tests__/**` (test titles are descriptive sentences).
3. MANDATORY: open every candidate and confirm an assertion (not setup) verifies the row before citing it.
4. Classify the remainder: manual (with pointer), infeasible (one-line reason), superseded (pointer). No blank rows.
5. Reverse check: every test file must appear in the map at least once; orphans mean a mapping miss or dead test.
6. Any automatable `gap` row becomes a new test or an explicit manual marker with justification.
