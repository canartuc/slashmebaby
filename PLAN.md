# PLAN.md: SlashMeBaby Sprint Plan

Last updated: 2026-07-18

---

## Team Roles

| Role | Responsibilities |
|------|----------------|
| **PM** | Requirements sign-off, stakeholder communication, scope decisions |
| **Designer** | Luminal design system application, component specs, design QA |
| **Architect** | Technical decisions, code review, system design, dependency choices |
| **Context Eng** | Maintains CONTEXT.md, AI prompt templates, onboarding docs, documentation |
| **Engineer** | Feature implementation, unit tests, bug fixes |
| **QA** | Test plans, E2E tests, cross-browser verification, release sign-off |
| **Scrum Master** | Sprint ceremonies, blocker removal, process enforcement, metrics |

---

## Sprint Overview

| Sprint | Name | Duration | Goal |
|--------|------|----------|------|
| 1 | Foundation | 1 week | Project scaffold, CI, development environment, TypeScript setup |
| 2 | Core Backend | 1 week | All background service worker modules fully tested |
| 3 | Command Bar UI | 1 week | Shadow DOM mount, full CommandBar React component, keyboard nav |
| 4 | Actions & Integration | 1 week | All P0 actions wired, end-to-end flows working |
| 5 | Settings & Onboarding | 1 week | Settings page, onboarding wizard, popup fallback |
| 6 | Polish & QA | 1 week | Performance, accessibility, cross-browser, store submission |

---

## Sprint 1: Foundation

**Goal:** Every developer can clone the repo, run `npm install`, and have a working dev server with hot reload in under 5 minutes. CI is green on an empty test suite.

### Deliverables

| # | Deliverable | Owner | Acceptance Criteria |
|---|------------|-------|---------------------|
| 1.1 | WXT project scaffold | Architect | `npm run dev` starts Chrome extension dev server; `npm run build` produces `.output/chrome-mv3/`; `npm run build:firefox` produces `.output/firefox-mv2/` |
| 1.2 | TypeScript strict mode | Architect | `tsconfig.json` has `"strict": true`; `tsc --noEmit` exits 0 with no errors on clean scaffold |
| 1.3 | ESLint + Prettier config | Engineer | `npm run lint` exits 0; `npm run format` formats all files; pre-commit hook via Husky runs both |
| 1.4 | Vitest setup | Engineer | `npx vitest run` finds and runs at least one placeholder test; `--coverage` generates lcov report |
| 1.5 | Playwright setup | QA | `npx playwright test` launches Chrome with extension loaded via `launchPersistentContext`; at least one smoke test passes |
| 1.6 | GitHub Actions CI | Architect | CI pipeline runs on every PR: lint → type check → unit tests → Chrome build → Firefox build → E2E smoke test |
| 1.7 | src/ directory structure | Architect | All directories from ARCHITECTURE.md section 1 exist with placeholder index files |
| 1.8 | messaging.ts types | Architect | `src/lib/messaging.ts` contains all types from ARCHITECTURE.md section 3; compiles with no errors |
| 1.9 | wxt.config.ts | Architect | Contains all 7 permissions; keyboard command `toggle-overlay` registered with Alt+Space default |
| 1.10 | Documentation baseline | Context Eng | FEATURES.md, DESIGN.md, ARCHITECTURE.md, CONTEXT.md, CLAUDE.md, PLAN.md all present at repo root |

### QA Gate: Sprint 1

- [ ] `npm ci && npm run lint && tsc --noEmit` exits 0
- [ ] `npm run build` and `npm run build:firefox` both exit 0 with output directories present
- [ ] `npx vitest run` exits 0
- [ ] `npx playwright test` smoke test exits 0
- [ ] CI pipeline is green on the main branch

---

## Sprint 2: Core Backend

**Goal:** All background service worker modules (TabCache, BookmarkCache, HistoryCache, ActionRegistry, SearchEngine, MessageRouter) are implemented with 100% unit test coverage.

### Deliverables

| # | Deliverable | Owner | Acceptance Criteria |
|---|------------|-------|---------------------|
| 2.1 | TabCache | Engineer | `init()`, `getAll()`, `getActiveTab()` implemented; registers all tab event listeners; unit tests mock browser.tabs and verify cache is updated on events |
| 2.2 | BookmarkCache | Engineer | `init()`, `getAll()` implemented; flattened tree (leaves only); unit tests verify bookmark events trigger cache rebuild |
| 2.3 | HistoryCache | Engineer | `init()`, `getAll()`, `refresh()` implemented; max 1000 items; refresh alarm every 5 min; unit tests verify refresh logic |
| 2.4 | ActionRegistry | Engineer | All 10 v1 actions registered (7 tab + 3 navigation); `getApplicable(tab)` filters by condition; `execute(id, tabId)` dispatches correct browser API; unit tests cover all actions |
| 2.5 | SearchEngine | Engineer | Fuse.js indexes built per source; `search()` applies 0.6/0.4 scoring; `getSmartSuggestions()` returns 3 tabs + 2 bookmarks + 2 actions; unit tests verify scoring with known inputs |
| 2.6 | computeRecencyScore | Engineer | Unit test: score at exactly one half-life = 0.5 (±0.001); score at age 0 = 1.0; score approaches 0 at large ages |
| 2.7 | Action prefix mode | Engineer | `preprocessQuery('> close')` returns `{ query: 'close', actionOnly: true }`; search with actionOnly omits tabs/bookmarks/history groups |
| 2.8 | MessageRouter | Engineer | Dispatches SEARCH → SearchEngine; SMART_SUGGESTIONS → SearchEngine; EXECUTE_ACTION → ActionRegistry; GET_SETTINGS → storage; returns `true` for all handlers |
| 2.9 | Utility Actions | Engineer | Close All Duplicates finds and closes duplicate-URL tabs; Sort by Domain reorders tabs by domain name; both have unit tests |
| 2.10 | storage.ts | Engineer | `getSettings()` returns UserSettings with defaults applied; `saveSettings(partial)` deep-merges; unit tests mock chrome.storage.sync |

### QA Gate: Sprint 2

- [ ] 100% statement coverage on `src/lib/` and `src/entrypoints/background/`
- [ ] All recency scoring tests pass with exact expected values
- [ ] MessageRouter unit test exercises every message type
- [ ] No direct `chrome.*` calls (only `browser.*`), verified by grep in CI
- [ ] `npm run build` and `npm run build:firefox` still exit 0

---

## Sprint 3: Command Bar UI

**Goal:** The command bar overlay appears on Alt+Space, renders search results from real data, supports full keyboard navigation, and is visually complete per DESIGN.md (Luminal design language).

### Deliverables

| # | Deliverable | Owner | Acceptance Criteria |
|---|------------|-------|---------------------|
| 3.1 | Shadow DOM mount | Engineer | Content script appends `<div id="slashmebaby-root">` to document.body; open shadow root; React mounts on TOGGLE_OVERLAY; full unmount after 150ms close animation |
| 3.2 | CommandBar component | Engineer + Designer | Renders SearchInput + ResultList in a centered overlay with Luminal tokens; border-radius 12px; dark/light theme via data-theme attribute |
| 3.3 | SearchInput component | Engineer + Designer | 48px height; system-ui font 16px; placeholder in --color-text-muted; Esc badge visible; auto-focused on mount |
| 3.4 | ResultItem component | Engineer + Designer | Favicon 16×16; title in --color-text-primary 14px; URL in --color-text-secondary 12px; selected state: --color-bg-hover + 2px left border in --color-accent |
| 3.5 | GroupHeader component | Engineer + Designer | Uppercase, 12px, 500 weight, --color-text-muted; divider above; 8px top margin except on first group |
| 3.6 | Backdrop component | Engineer | Fixed full-viewport; --color-backdrop; click to close; z-index below command bar |
| 3.7 | Overlay animation | Engineer | Open: scale 0.95→1 + opacity 0→1, 150ms, cubic-bezier(0.16,1,0.3,1); close: reverse; prefers-reduced-motion disables animation |
| 3.8 | Result stagger | Engineer | Groups appear with 0/20/40/60ms stagger; only on initial render, not on keystrokes |
| 3.9 | useKeyboard hook | Engineer | ↑/↓ navigate across group boundaries; Tab jumps to next group header; Enter executes; Escape closes; Backspace on empty closes |
| 3.10 | useSearch hook | Engineer | Sends SEARCH on every keystroke (0ms debounce); sends SMART_SUGGESTIONS on mount (empty input); updates result state |
| 3.11 | useTheme hook | Engineer | Reads prefers-color-scheme; applies data-theme="dark"/"light" to shadow host; updates live on OS theme change |
| 3.12 | ARIA implementation | Engineer | dialog, combobox, listbox, option roles; aria-selected; aria-live result count announcer |
| 3.13 | Focus management | Engineer | Input auto-focused on open; focus trapped inside shadow DOM while open; focus returned to host page element on close |
| 3.14 | Component unit tests | Engineer + QA | 90%+ coverage on all CommandBar components; test keyboard navigation; test empty state; test theme switching |

### QA Gate: Sprint 3

- [ ] Alt+Space opens overlay on any http/https page within 50ms (measured via Performance.now() in E2E test)
- [ ] Escape closes overlay; focus returns to previously focused element
- [ ] All keyboard navigation paths tested and passing in E2E suite
- [ ] Visual design matches DESIGN.md Luminal specs (Designer sign-off)
- [ ] No CSS leakage to host page verified (E2E test: check document.body styles unchanged after overlay open/close)
- [ ] ARIA attributes verified with axe-playwright

---

## Sprint 4: Actions & Integration

**Goal:** All P0 actions (F09, F10, F11) are wired end-to-end. The full user flow (open, search, select, execute) works on both Chrome and Firefox.

### Deliverables

| # | Deliverable | Owner | Acceptance Criteria |
|---|------------|-------|---------------------|
| 4.1 | Tab action execution | Engineer | Close Tab, Close Other Tabs, Pin/Unpin, Mute/Unmute, Duplicate, Move to Window, and Reload all execute correctly via EXECUTE_ACTION message; Mute/Unmute only shows when tab is audible |
| 4.2 | Navigation actions | Engineer | New Tab opens blank tab and closes overlay; Recently Closed shows 10-item sub-list from chrome.sessions; selecting a recently closed item calls sessions.restore(); Go to URL navigates current tab |
| 4.3 | Utility actions | Engineer | Close All Duplicates removes all but one tab per URL; Sort by Domain reorders tabs; Settings opens extension settings page |
| 4.4 | Action prefix mode E2E | QA | Typing `>` in overlay filters to actions only; backspacing to empty restores all sources; E2E test covers both transitions |
| 4.5 | Smart suggestions accuracy | Engineer | Empty state returns 3 most recently accessed tabs + 2 most recently added bookmarks + contextual actions based on active tab state |
| 4.6 | Keyboard shortcut | Engineer | Alt+Space registered via chrome.commands; settings page shortcut selector updates command registration; shortcut change takes effect immediately |
| 4.7 | Firefox E2E | QA | Full user flow (open → search → tab switch) verified on Firefox build; no API errors in browser console |
| 4.8 | Restricted page popup | Engineer | Extension icon click on chrome:// pages opens popup; popup originally shipped as a separate minimal UI and shares the overlay's CommandBar component since the 2026-07 popup unification (see F20); communicates with same background |
| 4.9 | Performance validation | Engineer + QA | E2E test measures overlay open time < 50ms; search response time < 16ms; profiled with Chrome DevTools Performance panel |
| 4.10 | Error handling | Engineer | EXECUTE_ACTION returns `{ success: false, error: string }` on failure; content script shows brief error toast; no uncaught exceptions in console |

### QA Gate: Sprint 4

- [ ] All P0 features (F01–F16) manually tested end-to-end on Chrome
- [ ] All P0 features (F01–F16) manually tested end-to-end on Firefox
- [ ] Performance targets met: overlay < 50ms, search < 16ms (median over 10 runs)
- [ ] No console errors during normal operation on either browser
- [ ] Playwright E2E suite covers all P0 flows

---

## Sprint 5: Settings & Onboarding

**Goal:** F17–F20 (P1 features) are complete. First-time user experience is tested end-to-end. Settings sync across devices.

### Deliverables

| # | Deliverable | Owner | Acceptance Criteria |
|---|------------|-------|---------------------|
| 5.1 | Settings page layout | Engineer + Designer | SettingsPage.tsx renders all 6 settings with Luminal styling; accessible via Settings action in command bar |
| 5.2 | ShortcutSetting | Engineer | Radio group for 4 preset shortcuts; selection updates chrome.storage.sync; reflected immediately in command bar |
| 5.3 | PositionSetting | Engineer | Radio group: Center / Top / Bottom; changes command bar position without reload |
| 5.4 | ThemeSetting | Engineer | Radio group: System / Light / Dark; System follows prefers-color-scheme; selection persists via storage.sync |
| 5.5 | MaxResultsSetting | Engineer | Radio group: 3 / 5 / 8 results per group; updates search results immediately |
| 5.6 | SearchSources toggles | Engineer | Checkboxes for Tabs / Bookmarks / History; toggling off omits source from SEARCH payload |
| 5.7 | Settings sync | Engineer + QA | Change setting on device A; verify (manually) it appears on device B via chrome.storage.sync |
| 5.8 | Onboarding trigger | Engineer | runtime.onInstalled opens onboarding tab; does NOT open on browser update or extension update (only on fresh install) |
| 5.9 | Step 1: Choose Shortcut | Engineer + Designer | Grid of 4 shortcut options; selection highlighted; Next button advances; choice saved to storage.local |
| 5.10 | Step 2: Try It Now | Engineer + Designer | Prompts user to press chosen shortcut; command bar appears live in the onboarding tab; detecting shortcut advances to Step 3 |
| 5.11 | Step 3: Navigation Guide | Engineer + Designer | Keyboard cheat sheet with arrow keys, Tab, Enter, Escape, `>` prefix; Next button advances |
| 5.12 | Step 4: Completion | Engineer + Designer | Pro tips: `>` prefix, recency learning, settings link; Finish button marks onboarding complete in storage.local |
| 5.13 | Onboarding resume | Engineer | If user closes onboarding tab at Step 2, reopening extension icon shows step 2 (not step 1) |
| 5.14 | Onboarding unit tests | QA | Step transitions tested; storage reads/writes mocked; completion state verified |

### QA Gate: Sprint 5

- [ ] New install flow manually tested: onboarding opens, all 4 steps complete, command bar works after
- [ ] Settings changes persist after browser restart
- [ ] Position changes (Center/Top/Bottom) visually correct on both themes
- [ ] Onboarding resume works: close at step 2, reopen, see step 2
- [ ] All settings have corresponding unit tests

---

## Sprint 6: Polish & QA

**Goal:** Zero P0 bugs. Performance targets met. WCAG AA compliance. Both browser store submissions prepared and submitted.

### Deliverables

| # | Deliverable | Owner | Acceptance Criteria |
|---|------------|-------|---------------------|
| 6.1 | Full E2E regression suite | QA | All P0 + P1 user flows covered by Playwright tests; suite runs in under 3 minutes |
| 6.2 | Accessibility audit | Designer + QA | axe-playwright reports zero critical or serious violations; keyboard-only tester completes all P0 flows |
| 6.3 | Performance profiling | Engineer | Chrome DevTools Performance trace shows overlay open < 50ms (P95); search rendering < 16ms (P95) |
| 6.4 | Cross-browser final test | QA | Full manual test matrix on Chrome 127+ (floor raised for `action.openPopup`), Firefox 126+ (floor raised for the `onCommand` tab argument), Edge 127+, Brave latest |
| 6.5 | Bundle size check | Engineer | Chrome build < 500KB unzipped; Firefox build < 500KB unzipped; no unused dependencies included |
| 6.6 | Favicons fallback | Engineer | All result items show correct favicons; broken favicon URLs show globe fallback icon |
| 6.7 | Reduced motion | Engineer + QA | `prefers-reduced-motion: reduce` disables all animations; all features still functional |
| 6.8 | Privacy review | Architect + PM | Confirm no external network calls; confirm no telemetry; update store listing privacy section |
| 6.9 | Chrome Web Store listing | PM + Designer | Store listing: screenshots (5), description (short + long), privacy policy, 128px icon, 440×280 promo tile |
| 6.10 | Firefox Add-ons listing | PM + Designer | AMO listing: screenshots, description, source code zip (AMO requires source for review), privacy policy |
| 6.11 | Chrome submission | PM | Extension zip submitted to Chrome Web Store developer dashboard; review pending |
| 6.12 | Firefox submission | PM | Extension zip submitted to AMO; review pending |
| 6.13 | Release notes | Context Eng | CHANGELOG.md created with v1.0.0 entry listing all P0 and P1 features |

### QA Gate: Sprint 6 (Release Gate)

- [ ] Zero open P0 bugs
- [ ] Zero axe-playwright critical/serious violations
- [ ] E2E suite green on Chrome and Firefox
- [ ] Performance targets met (P95 measurements)
- [ ] Bundle size < 500KB
- [ ] PM sign-off on store listings
- [ ] Architect sign-off on security/permissions review
- [ ] Designer sign-off on visual QA

---

## RACI Matrix

R = Responsible (does the work), A = Accountable (owns the outcome), C = Consulted, I = Informed

| Activity | PM | Designer | Architect | Context Eng | Engineer | QA | Scrum Master |
|----------|----|---------|-----------|-----------|---------|----|-------------|
| Requirements definition | A/R | C | C | C | I | I | I |
| Feature scope decisions | A | C | C | I | I | I | I |
| Design system (Luminal) | I | A/R | C | C | I | I | I |
| Component visual specs | I | A/R | C | I | C | I | I |
| Technical architecture | C | I | A/R | C | C | I | I |
| Implementation | I | I | C | I | A/R | I | I |
| Unit tests | I | I | C | I | A/R | C | I |
| E2E test suite | I | I | C | I | C | A/R | I |
| Cross-browser testing | I | I | C | I | C | A/R | I |
| Accessibility audit | I | C | I | I | I | A/R | I |
| Performance profiling | I | I | C | I | R | A | I |
| Documentation (CONTEXT.md etc.) | C | I | C | A/R | I | I | I |
| AI prompt maintenance | I | I | I | A/R | I | I | I |
| Sprint ceremonies | I | I | I | I | I | I | A/R |
| Blocker removal | C | I | C | I | I | I | A/R |
| Store submission | A/R | C | C | I | I | I | I |
| Release sign-off | A | C | C | I | C | C | I |

---

## Scrum Master Enforcement Rules

The Scrum Master is responsible for process health. The following rules are non-negotiable:

### Definition of Done (DoD)

A story or task is not Done unless ALL of the following are true:
1. Implementation committed to main branch with a conventional commit message
2. Unit tests written (TDD: test was written before implementation)
3. All CI checks pass (lint, type check, unit tests, build)
4. Code reviewed and approved by at least one other engineer (or the Architect)
5. QA gate criteria for the current sprint are not broken by this change
6. Acceptance criteria in this PLAN.md are checkably met

### Sprint Rules

1. **No scope creep without PM sign-off.** If a new requirement emerges mid-sprint, the PM must explicitly add it to the backlog. The Scrum Master blocks any undeclared work from being started.
2. **Blockers reported within 24 hours.** Any blocker that prevents a deliverable must be surfaced in the next standup (or sooner via async message). The Scrum Master owns removal within 48 hours or escalates.
3. **Velocity is for forecasting only.** The Scrum Master does not use story points or velocity to pressure engineers.
4. **CI must be green at end of every sprint.** The Scrum Master does not allow a sprint to close with a broken CI pipeline. Any broken build is a P0 blocker regardless of feature completeness.
5. **QA gates are mandatory.** No sprint closes until the QA gate checklist is fully checked. QA work runs throughout the sprint, not only at the end.
6. **No "done in my head."** If it's not committed, tested, and in CI, it's not done. The Scrum Master enforces this strictly to prevent false progress reports.
7. **Retrospective is timeboxed to 45 minutes.** It covers one thing that went well, one thing to improve, and one concrete action item assigned to one person with a due date.
8. **Technical debt is tracked.** If a shortcut is taken under time pressure, it must be filed as a GitHub issue with a `tech-debt` label before the sprint closes.
