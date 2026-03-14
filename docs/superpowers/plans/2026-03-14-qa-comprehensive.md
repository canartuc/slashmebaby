# SlashMeBaby Comprehensive QA Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve production-quality QA: fix all failing tests, create TESTSCENARIOS.md, write comprehensive Playwright E2E tests for every feature, reach 100% unit test coverage on core logic, and verify the extension works end-to-end in a real browser.

**Architecture:** Fix existing test failures first, then create comprehensive test scenarios document, then implement E2E tests using Playwright with a real Chrome extension loaded. All keyboard handling uses native DOM events (React synthetic events don't work in Shadow DOM).

**Tech Stack:** Vitest (unit), Playwright (E2E), @testing-library/react (components), Chrome extension APIs

**Platform:** macOS (current). Keyboard shortcuts use Command key (Meta in Playwright).

**Spec:** `docs/superpowers/specs/2026-03-14-slashmebaby-design.md`

---

## Current State

- **249 tests** (248 passing, 1 failing)
- **Failing test:** `CommandBar > calls onDismiss when pressing Backspace on empty query` — behavior was intentionally removed but test not updated
- **E2E tests:** 4 keyboard tests + 5 extension page tests (basic coverage only)
- **Coverage:** No coverage report generating (needs `--coverage` flag to output)
- **Known issue:** React synthetic events don't work in Shadow DOM — all interaction tests must use native DOM events or Playwright

---

## Chunk 1: Fix Failing Tests & Create TESTSCENARIOS.md

### Task 1: Fix the Failing Backspace Test

**Files:**
- Modify: `src/__tests__/components/CommandBar.test.tsx:101-109`

- [ ] **Step 1: Remove the obsolete backspace dismiss test**

The backspace-on-empty dismiss behavior was intentionally removed in commit `5a63569`. The test must be removed to match.

Replace the test at line 101-109:
```typescript
// Old test that expects backspace dismiss (REMOVED — behavior removed in 5a63569)
```

Replace with:
```typescript
  it('does not dismiss when pressing Backspace on empty query', async () => {
    const onDismiss = vi.fn();
    render(<CommandBar onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());

    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify all pass**

```bash
npx vitest run
```

Expected: 249 tests, all passing.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/CommandBar.test.tsx
git commit -m "fix: update backspace test to match removed dismiss behavior"
```

### Task 2: Create TESTSCENARIOS.md

**Files:**
- Create: `TESTSCENARIOS.md`

- [ ] **Step 1: Read all project documentation**

Read: `FEATURES.md`, `DESIGN.md`, `ARCHITECTURE.md`, `docs/superpowers/specs/2026-03-14-slashmebaby-design.md`, `docs/user-guide.md`

- [ ] **Step 2: Write TESTSCENARIOS.md**

Create a comprehensive test scenarios document covering every feature, edge case, and user behavior. The document MUST contain these sections with exact test cases:

```markdown
# SlashMeBaby — Test Scenarios

## 1. Extension Lifecycle

### 1.1 Installation
- TS-001: Extension loads without errors in Chrome
- TS-002: Onboarding page opens automatically on first install
- TS-003: Extension icon appears in toolbar
- TS-004: No console errors on any page after installation

### 1.2 Extension Pages
- TS-005: Settings page loads and renders all sections
- TS-006: Onboarding page loads and shows step 1
- TS-007: Popup page loads when clicking extension icon

## 2. Command Bar Activation

### 2.1 Keyboard Shortcut
- TS-010: Default shortcut (Cmd+Shift+Space on Mac) opens command bar
- TS-011: Same shortcut toggles command bar closed
- TS-012: Command bar opens on any http/https page
- TS-013: Command bar does NOT open on chrome:// pages (popup fallback instead)
- TS-014: Changing shortcut in settings takes effect immediately on all tabs
- TS-015: All 4 shortcut options work when selected (Cmd+Shift+Space, Cmd+Shift+L, Cmd+., Cmd+/)

### 2.2 Visual Appearance
- TS-020: Command bar appears centered (default position)
- TS-021: Backdrop dims the page behind the command bar
- TS-022: Open animation plays (scale 0.95→1 + opacity 0→1)
- TS-023: Search input is auto-focused on open
- TS-024: Placeholder text reads "Search tabs, bookmarks, actions..."

## 3. Search & Results

### 3.1 Smart Suggestions (Empty State)
- TS-030: Opening command bar shows smart suggestions immediately
- TS-031: Smart suggestions include recent tabs (up to 3)
- TS-032: Smart suggestions include bookmarks (up to 2)
- TS-033: Smart suggestions include actions (up to 2)
- TS-034: Results are grouped with section headers ("Open Tabs", "Bookmarks", "Actions")

### 3.2 Fuzzy Search
- TS-040: Typing filters results instantly (no debounce)
- TS-041: Fuzzy matching works (e.g., "ghub" matches "GitHub")
- TS-042: Results show across all sources: tabs, bookmarks, history
- TS-043: Each group shows max 5 results by default
- TS-044: Clearing search input returns to smart suggestions

### 3.3 Recency Scoring
- TS-050: Recently accessed tabs rank higher than older ones
- TS-051: Tabs half-life is 2 hours (tab accessed 2h ago scores ~0.5)
- TS-052: Bookmarks half-life is 168 hours (1 week)
- TS-053: History half-life is 24 hours
- TS-054: Actions have no recency (scored by string match only)

### 3.4 Action Prefix Mode
- TS-060: Typing ">" shows only actions
- TS-061: "> close" matches "Close Tab", "Close Other Tabs", "Close All Duplicates"
- TS-062: Deleting ">" returns to normal multi-source search
- TS-063: Action prefix strips ">" before matching

## 4. Keyboard Navigation

### 4.1 Arrow Keys
- TS-070: ArrowDown moves selection down
- TS-071: ArrowUp moves selection up
- TS-072: ArrowDown wraps from last item to first
- TS-073: ArrowUp wraps from first item to last
- TS-074: Arrow keys cross group boundaries seamlessly

### 4.2 Group Navigation
- TS-080: Tab key jumps to next group
- TS-081: Shift+Tab jumps to previous group

### 4.3 Execution
- TS-090: Enter on a tab item switches to that tab
- TS-091: Enter on a bookmark opens the URL
- TS-092: Enter on a history item opens the URL
- TS-093: Enter on "Settings" action opens settings page
- TS-094: Enter on "New Tab" action opens a new tab
- TS-095: Enter on "Close Tab" closes the current tab

### 4.4 Dismissal
- TS-100: Escape key closes the command bar
- TS-101: Clicking the backdrop closes the command bar
- TS-102: Activation shortcut toggles close
- TS-103: Backspace on empty does NOT close (intentionally disabled)
- TS-104: Command bar unmounts completely on close (clean state on reopen)

## 5. Tab Actions

### 5.1 All 13 Actions
- TS-110: Close Tab — closes the active tab
- TS-111: Close Other Tabs — closes all except active (skips pinned)
- TS-112: Pin/Unpin Tab — toggles pin state
- TS-113: Mute/Unmute Tab — toggles mute state
- TS-114: Duplicate Tab — creates a copy
- TS-115: Move to New Window — detaches to new window
- TS-116: Reload Tab — refreshes the tab
- TS-117: New Tab — opens blank tab
- TS-118: Go to URL — handled by UI (navigates current tab)
- TS-119: Recently Closed — triggers sub-list mode
- TS-120: Close All Duplicates — removes tabs with same URL
- TS-121: Sort by Domain — reorders by hostname
- TS-122: Settings — opens settings page

## 6. Settings

### 6.1 Persistence
- TS-130: Settings persist after closing and reopening settings page
- TS-131: Settings sync across devices (chrome.storage.sync)
- TS-132: Default settings load when storage is empty

### 6.2 Shortcut Setting
- TS-140: Shows 4 shortcut options with platform-correct labels
- TS-141: On Mac: labels show ⌘ (Command) not Ctrl
- TS-142: Selected shortcut is highlighted
- TS-143: Changing shortcut saves immediately

### 6.3 Position Setting
- TS-150: Center position renders bar in center
- TS-151: Top position renders bar at top
- TS-152: Bottom position renders bar at bottom

### 6.4 Theme Setting
- TS-160: System theme follows OS preference
- TS-161: Light theme forces light mode
- TS-162: Dark theme forces dark mode

### 6.5 Max Results Per Group
- TS-170: Default is 5 results per group
- TS-171: Changing to 3 limits each group to 3 results
- TS-172: Changing to 8 shows up to 8 results per group

### 6.6 Show Favicons
- TS-175: Favicons shown by default
- TS-176: Disabling hides all favicons from results

### 6.7 Search Sources
- TS-180: Disabling Tabs hides tab results
- TS-181: Disabling Bookmarks hides bookmark results
- TS-182: Disabling History hides history results
- TS-183: Actions are always visible regardless of settings

## 7. Onboarding

### 7.1 Flow
- TS-200: Step 1 shows 4 shortcut options
- TS-201: Selecting a shortcut highlights it
- TS-202: Next button advances to step 2
- TS-203: Step 2 shows the chosen shortcut and prompts user to try it
- TS-204: Step 3 shows keyboard navigation guide
- TS-205: Step 4 shows pro tips and "Start Browsing" button
- TS-206: "Start Browsing" marks onboarding complete

### 7.2 Persistence
- TS-210: Closing tab during onboarding saves progress
- TS-211: Reopening onboarding resumes at saved step
- TS-212: Completed onboarding doesn't show again

## 8. Popup Fallback

- TS-220: Popup opens when clicking extension icon
- TS-221: Popup shows search input
- TS-222: Popup shows search results
- TS-223: Popup works on chrome:// pages (where content script can't inject)

## 9. Shadow DOM Isolation

- TS-230: Command bar styles don't leak to host page
- TS-231: Host page styles don't affect command bar
- TS-232: Command bar renders correctly on pages with aggressive CSS resets

## 10. Cross-Browser (macOS)

- TS-240: Chrome build succeeds
- TS-241: Firefox build succeeds
- TS-242: Extension loads in Chrome without errors
- TS-243: Command bar opens and functions in Chrome

## 11. Performance

- TS-250: Overlay appears in under 50ms
- TS-251: Search results render in under 16ms
- TS-252: No memory leaks on repeated open/close cycles

## 12. Edge Cases

- TS-260: Works with 0 open tabs (empty results)
- TS-261: Works with 100+ open tabs
- TS-262: Works with no bookmarks
- TS-263: Handles tabs with very long titles (truncation)
- TS-264: Handles tabs with no favicon gracefully
- TS-265: Handles pages with Content Security Policy
- TS-266: Multiple rapid open/close doesn't crash
- TS-267: Typing very fast doesn't cause race conditions
```

- [ ] **Step 3: Commit**

```bash
git add TESTSCENARIOS.md
git commit -m "docs: add comprehensive test scenarios for QA"
```

---

## Chunk 2: E2E Tests — Core Command Bar

### Task 3: Refactor E2E Helpers & Setup

**Files:**
- Modify: `e2e/helpers.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Update playwright.config.ts**

Set `workers: 1` (extensions can't run in parallel), increase timeout, add `retries: 2`:

```typescript
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 2,
  workers: 1,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('.output/chrome-mv3')}`,
            `--load-extension=${path.resolve('.output/chrome-mv3')}`,
            '--no-first-run',
            '--disable-default-apps',
          ],
        },
      },
    },
  ],
});
```

- [ ] **Step 2: Rewrite e2e/helpers.ts**

```typescript
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export async function launchBrowserWithExtension(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
  await new Promise(r => setTimeout(r, 2000));
  return context;
}

export async function openPage(context: BrowserContext, url: string = 'https://example.com'): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));
  return page;
}

export async function openCommandBar(page: Page): Promise<void> {
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
}

export async function isOverlayOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-backdrop');
  });
}

export async function getSelectedItemTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const selected = host?.shadowRoot?.querySelector('.smb-result-item--selected');
    return selected?.querySelector('.smb-title')?.textContent || '';
  });
}

export async function getResultCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return host?.shadowRoot?.querySelectorAll('.smb-result-item').length || 0;
  });
}

export async function getGroupHeaders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const headers = host?.shadowRoot?.querySelectorAll('.smb-group-header');
    return Array.from(headers || []).map(h => h.textContent || '');
  });
}

export async function typeInCommandBar(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    if (input) {
      input.value = t;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, text);
  await new Promise(r => setTimeout(r, 500));
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await page.goto('chrome://extensions/');
  await new Promise(r => setTimeout(r, 1000));
  const id = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager');
    const items = manager?.shadowRoot?.querySelector('extensions-item-list');
    const item = items?.shadowRoot?.querySelector('extensions-item');
    return item?.getAttribute('id') || '';
  });
  await page.close();
  return id;
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers.ts playwright.config.ts
git commit -m "test: refactor E2E helpers with comprehensive shadow DOM utilities"
```

### Task 4: E2E — Command Bar Open/Close (TS-010 to TS-024, TS-100 to TS-104)

**Files:**
- Create: `e2e/command-bar.spec.ts`

- [ ] **Step 1: Write the test file**

Tests to cover:
- TS-010: Default shortcut opens command bar
- TS-011: Same shortcut toggles close
- TS-020: Bar appears centered
- TS-023: Input is auto-focused
- TS-024: Placeholder text correct
- TS-030: Smart suggestions appear on open
- TS-034: Results are grouped with headers
- TS-100: Escape closes
- TS-101: Backdrop click closes
- TS-102: Shortcut toggles close
- TS-103: Backspace on empty does NOT close
- TS-104: Clean state on reopen

Each test uses `launchBrowserWithExtension()`, `openPage()`, `openCommandBar()`, and shadow DOM query helpers.

- [ ] **Step 2: Build and run**

```bash
npm run build && npx playwright test e2e/command-bar.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/command-bar.spec.ts
git commit -m "test: add E2E tests for command bar open/close/dismiss"
```

### Task 5: E2E — Search & Navigation (TS-040 to TS-063, TS-070 to TS-095)

**Files:**
- Create: `e2e/search-navigation.spec.ts`

- [ ] **Step 1: Write the test file**

Tests to cover:
- TS-040: Typing filters results
- TS-044: Clearing input returns to suggestions
- TS-060: ">" prefix shows actions only
- TS-062: Deleting ">" returns to normal
- TS-070/071: Arrow keys move selection
- TS-072/073: Arrow keys wrap around
- TS-090: Enter on tab switches to it (verify page navigation or tab switch)
- TS-093: Enter on Settings opens settings page

- [ ] **Step 2: Build and run**

```bash
npm run build && npx playwright test e2e/search-navigation.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/search-navigation.spec.ts
git commit -m "test: add E2E tests for search, filtering, and keyboard navigation"
```

---

## Chunk 3: E2E Tests — Extension Pages & Actions

### Task 6: E2E — Settings Page (TS-130 to TS-173)

**Files:**
- Create: `e2e/settings.spec.ts`

- [ ] **Step 1: Write the test file**

Navigate directly to `chrome-extension://${extensionId}/settings.html`. Test:
- TS-005: Page renders all sections (shortcut, position, theme, sources)
- TS-140: Shows 4 shortcut options
- TS-141: Mac labels show ⌘
- TS-142: Default shortcut is selected
- TS-150/151/152: Position options present
- TS-160/161/162: Theme options present
- TS-170-173: Search source toggles present

- [ ] **Step 2: Build and run**

```bash
npm run build && npx playwright test e2e/settings.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/settings.spec.ts
git commit -m "test: add E2E tests for settings page"
```

### Task 7: E2E — Onboarding (TS-180 to TS-186)

**Files:**
- Create: `e2e/onboarding.spec.ts`

- [ ] **Step 1: Write the test file**

Navigate to `chrome-extension://${extensionId}/onboarding.html`. Test:
- TS-180: Step 1 shows shortcut picker
- TS-182: Next advances to step 2
- TS-184: Step 3 shows navigation guide
- TS-185: Step 4 shows completion
- TS-186: "Start Browsing" button exists

- [ ] **Step 2: Build and run**

```bash
npm run build && npx playwright test e2e/onboarding.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding.spec.ts
git commit -m "test: add E2E tests for onboarding wizard"
```

### Task 8: E2E — Popup Fallback (TS-200 to TS-203)

**Files:**
- Create: `e2e/popup.spec.ts`

- [ ] **Step 1: Write the test file**

Navigate to `chrome-extension://${extensionId}/popup.html`. Test:
- TS-200: Popup renders
- TS-201: Shows search input
- TS-202: Shows results

- [ ] **Step 2: Build and run**

```bash
npm run build && npx playwright test e2e/popup.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/popup.spec.ts
git commit -m "test: add E2E tests for popup fallback"
```

---

## Chunk 4: Coverage Gaps & Edge Cases

### Task 9: Fix Coverage Gaps in Unit Tests

**Files:**
- Modify: various test files based on coverage report

- [ ] **Step 1: Run coverage and identify gaps**

```bash
npx vitest run --coverage 2>&1
```

Check the HTML coverage report at `coverage/index.html`. Identify uncovered lines/branches.

- [ ] **Step 2: Add tests for uncovered paths**

Focus on:
- Error paths in actions (tab not found, permission errors)
- Edge cases in search (empty items, undefined timestamps)
- Storage fallbacks (corrupted data, missing keys)
- Content script edge cases (missing document.body, already mounted)

- [ ] **Step 3: Run coverage and verify thresholds**

```bash
npx vitest run --coverage
```

Expected: 100% on `src/lib/`, 90%+ on `src/entrypoints/background/`, 90%+ on components.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/
git commit -m "test: increase unit test coverage to meet thresholds"
```

### Task 10: E2E — Edge Cases & Performance (TS-230 to TS-247)

**Files:**
- Create: `e2e/edge-cases.spec.ts`

- [ ] **Step 1: Write the test file**

Test:
- TS-246: Multiple rapid open/close doesn't crash
- TS-244: Handles pages with no special content
- TS-210: Shadow DOM isolation (inject custom CSS, verify bar unaffected)
- TS-220/222: Chrome build loads and works

- [ ] **Step 2: Build and run**

```bash
npm run build && npx playwright test e2e/edge-cases.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/edge-cases.spec.ts
git commit -m "test: add E2E tests for edge cases and Shadow DOM isolation"
```

---

## Chunk 5: Cross-Browser, Final Verification & Feature Gap Analysis

### Task 11: Firefox Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Build for Firefox**

```bash
npm run build:firefox
```

Expected: Build succeeds.

- [ ] **Step 2: Verify manifest**

Check `.output/firefox-mv2/manifest.json` or `.output/firefox-mv3/manifest.json` for correct structure.

- [ ] **Step 3: Document any Firefox-specific issues**

If there are differences, document them in TESTSCENARIOS.md under "Cross-Browser" section.

### Task 12: Full Test Suite Run & Gap Analysis

**Files:**
- Modify: `FEATURES.md` (update statuses if needed)
- Modify: `TESTSCENARIOS.md` (add any discovered gaps)

- [ ] **Step 1: Run ALL unit tests with coverage**

```bash
npx vitest run --coverage
```

Expected: ALL tests pass, coverage thresholds met.

- [ ] **Step 2: Run ALL E2E tests**

```bash
npm run build && npx playwright test
```

Expected: ALL E2E tests pass.

- [ ] **Step 3: Gap analysis**

Cross-reference TESTSCENARIOS.md with actual test results:
- Every TS-XXX scenario must have either a unit test or E2E test covering it
- Any untested scenario must be flagged with a reason (can't test, deferred, etc.)
- Update FEATURES.md if any feature is found broken or incomplete

- [ ] **Step 4: Final build verification**

```bash
npm run build
npm run build:firefox
```

Both must succeed.

- [ ] **Step 5: Final commit**

```bash
git add TESTSCENARIOS.md FEATURES.md e2e/ src/__tests__/ vitest.config.ts playwright.config.ts
git commit -m "test: final QA verification — all scenarios tested"
```

- [ ] **Step 6: Push**

```bash
git push
```
