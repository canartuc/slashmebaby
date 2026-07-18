# CONTEXT.md: SlashMeBaby AI Context & Prompt Templates

Last updated: 2026-03-14

This file contains copy-pasteable prompts for AI-assisted development on SlashMeBaby. Each prompt provides the right amount of context for the task at hand without overwhelming the context window.

---

## 1. Project Bootstrap Prompt

Use this prompt at the start of a fresh session when you need the AI to understand the full project before any task.

```
You are helping build SlashMeBaby, a cross-browser command palette browser extension.

Tech stack: WXT (Vite-based, cross-browser) + React 18 + TypeScript (strict mode) + Fuse.js + Vitest + Playwright.
Targets: Chrome MV3 (and Chromium forks), Firefox MV2/MV3.

Key files:
- FEATURES.md: prioritized feature tracker (P0/P1/P2)
- DESIGN.md: design language "Luminal" (exact hex tokens, spacing, animation specs)
- ARCHITECTURE.md: system components, messaging protocol TypeScript types, search algorithm
- PLAN.md: 6-sprint delivery plan with acceptance criteria

Architecture summary:
- Background service worker: TabCache, BookmarkCache, HistoryCache, ActionRegistry, SearchEngine, MessageRouter
- Content script: Shadow DOM mount, React CommandBar component tree
- All browser APIs via WXT `browser` namespace (never `chrome.*` directly)
- All inter-context communication via typed messages in src/lib/messaging.ts
- Scoring formula: finalScore = (1 - fuseScore) * 0.6 + recencyScore * 0.4
- Recency: Math.exp(-Math.LN2 * ageInHours / halfLifeHours)

Conventions:
- TDD: write failing test first, then implement
- Conventional commits: feat:, fix:, test:, docs:, chore:
- CSS scoped inside Shadow DOM only, no global styles
- TypeScript strict mode: no `any`, no non-null assertions without justification
```

---

## 2. Per-Task Context Templates

### 2A. Background / Data Layer Work

Use when working on `src/entrypoints/background/`, `src/lib/search.ts`, or `src/lib/messaging.ts`.

```
Context: Working on the background service worker for SlashMeBaby browser extension.

File structure:
- src/entrypoints/background/index.ts: MessageRouter (registers runtime.onMessage)
- src/entrypoints/background/tabs.ts: TabCache class
- src/entrypoints/background/bookmarks.ts: BookmarkCache class
- src/entrypoints/background/history.ts: HistoryCache class
- src/entrypoints/background/actions.ts: ActionRegistry class
- src/lib/search.ts: SearchEngine class (Fuse.js + recency scoring)
- src/lib/messaging.ts: All TypeScript message types

Key constraints:
- All browser APIs via WXT `browser` namespace
- No direct `chrome.*` calls
- History cache: 1000 items max, refreshed every 5 min via browser.alarms
- Recency half-lives: Tabs 2h, Bookmarks 168h, History 24h
- Actions always have recencyScore = 0
- Message handler must return true (async) for all message types

Message types (from src/lib/messaging.ts):
- SearchRequest / SearchResponse
- SmartSuggestionsRequest / SmartSuggestionsResponse
- ExecuteActionRequest / ExecuteActionResponse
- GetSettingsRequest / GetSettingsResponse
- ToggleOverlayCommand (background → content)

Task: [DESCRIBE YOUR TASK HERE]
```

### 2B. UI / Content Script Work

Use when working on `src/entrypoints/content/`, `src/components/CommandBar/`, hooks, or styles.

```
Context: Working on the CommandBar React UI for SlashMeBaby browser extension.

UI runs inside a Shadow DOM root in the content script.
Mount: ReactDOM.createRoot(mountDiv).render(<App />) on TOGGLE_OVERLAY message.
Full unmount after close animation (150ms). Search state always resets.

Component tree:
- content/index.tsx: Shadow DOM setup, message listener, mount/unmount logic
- content/App.tsx: Root component, theme provider
- components/CommandBar/CommandBar.tsx: Main layout
- components/CommandBar/SearchInput.tsx: Input with icon and Esc badge
- components/CommandBar/ResultList.tsx: Grouped result container
- components/CommandBar/ResultItem.tsx: Individual result row
- components/CommandBar/GroupHeader.tsx: Section label

Design tokens (from DESIGN.md, Luminal design language):
- Dark bg-primary: #1a1a2e, accent: #6366f1, accent-hover: #818cf8
- Light bg-primary: #ffffff, accent: #6366f1, accent-hover: #4f46e5
- Font: system-ui stack, sizes 10/12/14/16px
- Spacing: 4px grid (--space-1 through --space-8)
- Overlay: border-radius 12px, animation scale 0.95→1 + opacity, 150ms ease-out cubic-bezier(0.16,1,0.3,1)
- Stagger: 20ms delay per result group

ARIA requirements:
- Container: role="dialog" aria-label="Command palette" aria-modal="true"
- Input: role="combobox" aria-autocomplete="list" aria-expanded
- Results: role="listbox", items: role="option" aria-selected

Hooks:
- useSearch: sends SEARCH / SMART_SUGGESTIONS messages, debounce: 0ms (instant)
- useKeyboard: arrow keys, Tab (jump group), Enter, Escape, Backspace-to-dismiss
- useTheme: reads prefers-color-scheme, applies data-theme attribute
- useSettings: GET_SETTINGS on mount, subscribes to storage.onChanged

Task: [DESCRIBE YOUR TASK HERE]
```

### 2C. Test Writing Work

Use when writing unit tests (Vitest) or E2E tests (Playwright).

```
Context: Writing tests for SlashMeBaby browser extension.

Test setup:
- Unit tests: Vitest, located at src/**/*.test.ts(x)
- E2E tests: Playwright, located at e2e/**/*.spec.ts
- Coverage target: 100% for src/lib/, 90%+ for src/components/

Unit test conventions:
- Describe the module, then individual behaviors
- Mock browser APIs using vitest's vi.mock() and vi.fn()
- Never test implementation details. Test behavior and outputs
- For SearchEngine: test scoring formulas with known inputs and expected outputs
- For MessageRouter: test message dispatch without real browser APIs

Key functions to test thoroughly (from src/lib/search.ts):
- computeRecencyScore(timestampMs, halfLifeHours): should return 0.5 at exactly one half-life
- computeFinalScore(fuseScore, recencyScore): verify weights 0.6 / 0.4
- preprocessQuery(rawQuery): test '>' prefix detection and stripping
- groupResults(): test max-per-group capping, empty group omission

E2E test approach:
- Load extension in headed Chrome via Playwright's launchPersistentContext
- Test full user flows: open overlay → type query → select result
- Test keyboard navigation: arrow keys, Tab, Enter, Escape
- Test cross-browser: run critical path on Firefox target

Task: [DESCRIBE YOUR TASK HERE]
```

### 2D. Settings / Onboarding Work

Use when working on `src/entrypoints/settings/`, `src/entrypoints/onboarding/`, or related components.

```
Context: Working on Settings or Onboarding pages for SlashMeBaby extension.

Settings page (src/entrypoints/settings/):
- Component: src/components/Settings/SettingsPage.tsx (layout container)
- Sub-components: ShortcutSetting, PositionSetting, ThemeSetting, SearchSources
- Storage: chrome.storage.sync, key: 'settings'
- Schema: UserSettings type from src/lib/messaging.ts
- Defaults: shortcut alt+space, position center, theme system, maxResultsPerGroup 5, showFavicons true, all sources on
- Access: via 'Settings' action in command bar OR extension icon right-click

Onboarding wizard (src/entrypoints/onboarding/):
- Component: src/components/Onboarding/OnboardingWizard.tsx (step container)
- Steps: ShortcutPicker (1) → TryItStep (2) → NavigationGuide (3) → PinToToolbarStep (4) → CompletionStep (5)
- Trigger: runtime.onInstalled
- Storage: chrome.storage.local, key: 'onboarding', schema: { completedStep: number, completed: boolean }
- NOT synced (per-device)
- Resume: if user closes tab mid-tutorial, re-opening shows the last incomplete step

Task: [DESCRIBE YOUR TASK HERE]
```

---

## 3. File Dependency Map

| File | Depends On | Depended On By |
|------|-----------|----------------|
| `src/lib/messaging.ts` | (none) | background/index.ts, content/index.tsx, all components via hooks |
| `src/lib/search.ts` | fuse.js, messaging.ts | background/index.ts |
| `src/lib/storage.ts` | messaging.ts (UserSettings type) | background/index.ts, hooks/useSettings.ts |
| `src/entrypoints/background/tabs.ts` | browser (WXT) | background/index.ts, search.ts |
| `src/entrypoints/background/bookmarks.ts` | browser (WXT) | background/index.ts, search.ts |
| `src/entrypoints/background/history.ts` | browser (WXT) | background/index.ts, search.ts |
| `src/entrypoints/background/actions.ts` | browser (WXT), messaging.ts | background/index.ts, search.ts |
| `src/entrypoints/background/index.ts` | tabs.ts, bookmarks.ts, history.ts, actions.ts, search.ts, storage.ts | (entry point) |
| `src/entrypoints/content/index.tsx` | messaging.ts, browser (WXT), App.tsx | (entry point) |
| `src/entrypoints/content/App.tsx` | CommandBar.tsx, hooks/* | content/index.tsx |
| `src/components/CommandBar/CommandBar.tsx` | SearchInput.tsx, ResultList.tsx | App.tsx |
| `src/components/CommandBar/SearchInput.tsx` | (none) | CommandBar.tsx |
| `src/components/CommandBar/ResultList.tsx` | ResultItem.tsx, GroupHeader.tsx | CommandBar.tsx |
| `src/components/CommandBar/ResultItem.tsx` | messaging.ts (result types) | ResultList.tsx |
| `src/components/CommandBar/GroupHeader.tsx` | (none) | ResultList.tsx |
| `src/hooks/useSearch.ts` | messaging.ts, browser (WXT) | App.tsx |
| `src/hooks/useKeyboard.ts` | (none) | CommandBar.tsx |
| `src/hooks/useTheme.ts` | (none) | App.tsx |
| `src/hooks/useSettings.ts` | storage.ts, messaging.ts, browser (WXT) | App.tsx, Settings/* |
| `src/styles/command-bar.css` | (none, pure CSS) | content/index.tsx (injected into Shadow DOM) |
| `wxt.config.ts` | (none) | Build system |

---

## 4. Review Prompts

### Code Review Prompt

```
Please review this code from the SlashMeBaby browser extension:

[PASTE CODE HERE]

Check for:
1. Correctness: Does it do what the task description says?
2. TypeScript: Is it strictly typed? No `any` types? No unsafe non-null assertions?
3. Browser compatibility: Are all browser APIs accessed via WXT `browser` namespace (not `chrome.*`)?
4. Performance: Search results must render in under 16ms. Overlay must open in under 50ms. Any blocking operations?
5. Shadow DOM safety: Does any code touch document.* or window.* in ways that could leak outside the shadow root?
6. Message protocol: Does it conform to the types in src/lib/messaging.ts?
7. Test coverage: Are the corresponding tests complete and testing behavior (not implementation)?
8. ARIA: Do interactive elements have correct roles and labels per ARCHITECTURE.md section 8?
9. Conventions: Conventional commit message? No console.log left in? No TODO left unreported?

Return: list of issues (critical / warning / suggestion) with file + line references.
```

### Architecture Review Prompt

```
Please review this architectural decision for SlashMeBaby:

[DESCRIBE THE DECISION OR PASTE THE CODE]

Evaluate against these constraints:
1. Cross-browser: Must work identically on Chrome MV3 and Firefox MV2/MV3 via WXT
2. Shadow DOM isolation: Zero CSS or JS leakage to/from the host page
3. Performance targets: 50ms overlay open, 16ms search results
4. Security: No unsafe-eval, no external requests, minimal permissions
5. Offline-first: All data from browser APIs, no network calls for search
6. Full unmount on close: React tree destroyed every time overlay closes, no persistent state
7. Messaging: All cross-context communication typed in src/lib/messaging.ts

Does this decision comply? If not, propose an alternative that does.
```

---

## 5. Debugging Prompts

### Messaging Failure

```
I have a messaging bug in SlashMeBaby. Background and content script are not communicating correctly.

Extension structure:
- Background service worker: src/entrypoints/background/index.ts
- Content script: src/entrypoints/content/index.tsx
- Message types: src/lib/messaging.ts

Symptom: [DESCRIBE WHAT HAPPENS, e.g., "SEARCH message sent from content script, no response received"]

Relevant code:
[PASTE SENDER CODE]
[PASTE RECEIVER CODE]

Common causes to check:
1. Message handler not returning `true` for async responses
2. Service worker sleeping before response arrives (Chrome MV3 issue)
3. Tab ID mismatch when routing background → content messages
4. Message type string typo not caught because `any` used
5. Extension not reloaded after background script changes

Diagnose the issue and provide a fix.
```

### Shadow DOM Style Leak

```
I have a CSS isolation bug in SlashMeBaby. Styles are leaking between the Shadow DOM and the host page.

Shadow DOM setup (from content/index.tsx):
- Host: <div id="slashmebaby-root"> appended to document.body
- Shadow root: attachShadow({ mode: 'open' })
- Styles: <style> tag injected into shadow root with bundled CSS
- React mounts into <div id="slashmebaby-app"> inside shadow root

Symptom: [DESCRIBE, e.g., "host page font-size changes when overlay opens" OR "overlay inherits host page's dark theme class"]

Common causes:
1. CSS custom properties (variables) are inherited through shadow boundaries. Use :host selector to reset
2. Global styles accidentally applied to document.body instead of shadow root
3. Inherited CSS properties (color, font-size) not reset with `all: initial` on shadow host
4. z-index stacking context issues with positioned host page elements

Diagnose and fix.
```

### Cross-Browser Inconsistency

```
I have a cross-browser bug in SlashMeBaby. The feature works on Chrome but fails on Firefox (or vice versa).

Tech: WXT; browser APIs called directly via chrome.* (Firefox supports the chrome namespace).

Symptom: [DESCRIBE, e.g., "Keyboard shortcut registers on Chrome but not Firefox" OR "sessions API throws on Firefox"]

Affected code:
[PASTE CODE]

Cross-browser checklist:
1. Does the `chrome.*` API used exist on Firefox? (Firefox supports the chrome namespace, but some APIs differ or are missing)
2. Is the feature available in Firefox? (e.g., browser.sessions may be limited in Firefox)
3. Does the manifest permission exist in both Chrome and Firefox targets? (check wxt.config.ts)
4. Are there MV2 vs MV3 API differences causing the issue? (background service worker vs persistent background page)
5. Is feature detection used for Chrome-only APIs? (e.g. `if (chrome.tabGroups)` before querying)

Diagnose and provide a compatible fix.
```
