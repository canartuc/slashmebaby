# SlashMeBaby Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-browser command palette extension (Chrome MV3 + Firefox) that provides Arc/Zen-style tab management via a single keystroke.

**Architecture:** WXT framework with React + Shadow DOM content script overlay. Background service worker handles tab/bookmark/history APIs and Fuse.js search. Typed messaging protocol between background and content script. Settings via chrome.storage.sync, onboarding via extension pages.

**Tech Stack:** WXT, React 18, TypeScript (strict), Fuse.js, CSS Modules, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-14-slashmebaby-design.md`

---

## Chunk 1: Project Scaffolding & Documentation Foundation

### Task 1: Initialize WXT Project

**Files:**
- Create: `package.json`
- Create: `wxt.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Scaffold WXT project**

```bash
cd /Users/canartuc/Dev/slashmebaby
npx wxt@latest init . --template react --pm npm
```

If prompted for TypeScript, select it. If the command runs non-interactively, verify `tsconfig.json` was created.

- [ ] **Step 2: Install core dependencies**

```bash
npm install fuse.js react react-dom
npm install -D @types/react @types/react-dom vitest @vitest/coverage-v8 playwright @playwright/test
```

- [ ] **Step 3: Configure wxt.config.ts for cross-browser**

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SlashMeBaby',
    description: 'Arc & Zen-style command palette for any browser. Switch tabs, search bookmarks, and run actions with a single keystroke.',
    version: '1.0.0',
    permissions: ['tabs', 'bookmarks', 'history', 'storage', 'activeTab', 'sessions', 'commands'],
    commands: {
      'toggle-command-bar': {
        suggested_key: {
          default: 'Alt+Space',
        },
        description: 'Open SlashMeBaby command bar',
      },
    },
  },
});
```

- [ ] **Step 4: Update .gitignore**

Append `.superpowers/` and `.wxt/` and `node_modules/` and `dist/` to `.gitignore`.

- [ ] **Step 5: Verify build works**

```bash
npm run build
```

Expected: Build completes successfully with output in `dist/` directory. This validates the project setup without requiring a long-running dev server.

- [ ] **Step 6: Commit**

```bash
git add package.json wxt.config.ts tsconfig.json .gitignore package-lock.json
git commit -m "chore: initialize WXT project with React and TypeScript"
```

### Task 2: Create FEATURES.md (Product Manager)

**Files:**
- Create: `FEATURES.md`

- [ ] **Step 1: Write FEATURES.md**

```markdown
# SlashMeBaby — Feature Tracker

## v1.0 Features

### P0 — Must Have (Launch Blockers)

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F01 | Command Bar Overlay | Center-stage modal overlay with search input and grouped results | Not Started |
| F02 | Tab Search & Switch | Fuzzy search across all open tabs, switch on Enter | Not Started |
| F03 | Bookmark Search | Fuzzy search across all bookmarks, navigate on Enter | Not Started |
| F04 | History Search | Fuzzy search across recent browsing history | Not Started |
| F05 | Recency-Weighted Scoring | Results ranked by combined fuzzy match + exponential recency decay | Not Started |
| F06 | Grouped Results | Results displayed in groups: Tabs, Bookmarks, History, Actions | Not Started |
| F07 | Keyboard Navigation | Arrow keys, Tab between groups, Enter to act, Escape to dismiss | Not Started |
| F08 | Smart Suggestions | Empty state shows recent tabs + frequent bookmarks + contextual actions | Not Started |
| F09 | Tab Actions | Close, Pin/Unpin, Mute/Unmute, Duplicate, Move to Window, Reload | Not Started |
| F10 | Navigation Actions | New Tab, Recently Closed (sub-list + restore), Go to URL | Not Started |
| F11 | Utility Actions | Close All Duplicates, Sort by Domain, Settings | Not Started |
| F12 | Action Prefix Mode | Type `>` to filter to actions only | Not Started |
| F13 | Keyboard Shortcut | Configurable activation shortcut (default Alt+Space) | Not Started |
| F14 | System Theme | Auto light/dark theme following OS preference | Not Started |
| F15 | Shadow DOM Isolation | Overlay styles isolated from host page via Shadow DOM | Not Started |
| F16 | Cross-Browser Support | Works on Chrome, Edge, Brave (Chromium) and Firefox | Not Started |

### P1 — Should Have

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F17 | Onboarding Tutorial | 4-step interactive tutorial on first install | Not Started |
| F18 | Settings Page | Extension page to configure shortcut, position, theme, sources | Not Started |
| F19 | Position Options | User-configurable bar position: Center, Top, Bottom | Not Started |
| F20 | Popup Fallback | Toolbar icon popup for restricted pages (chrome://, about:) | Not Started |

### P2 — Nice to Have (Post-Launch)

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F21 | Community Themes | User-created and shared themes | Not Started |
| F22 | Tab Groups | Create and manage Chrome tab groups | Not Started |
| F23 | Tab Suspension | Hibernate inactive tabs to save memory | Not Started |
| F24 | Bookmark Management | Add/edit/delete bookmarks from command bar | Not Started |

## Out of Scope for v1

- Tab sharing between devices
- Sidebar/vertical tab replacement
- Split view
- AI-powered features
```

- [ ] **Step 2: Commit**

```bash
git add FEATURES.md
git commit -m "docs: add FEATURES.md with prioritized feature tracker"
```

### Task 3: Create DESIGN.md (Designer)

**Files:**
- Create: `DESIGN.md`

- [ ] **Step 1: Research name uniqueness for design language**

Search the web for "Luminal design language", "Luminal design system", "Luminal UI" to confirm the name is not taken by a major design system. Also check "Aether design", "Velvet UI", "Prism design language" as alternatives. If all are taken, use "Veil" as fallback (the command bar is a veil/overlay).

- [ ] **Step 2: Write DESIGN.md**

The design language name will be determined by the plagiarism research in Step 1. Write the complete document — minimum 150 lines. Each section below must include concrete values, not just headings.

**Acceptance criteria:** Every section must contain specific, implementable values. No "TBD" or "to be defined."

Sections:
1. **Philosophy** (3-5 sentences) — e.g., "Veil prioritizes speed of comprehension. Every element exists to reduce time-to-action. We favor muted backgrounds with vivid accents to draw focus to interactive elements."
2. **Color System** — Use the exact dark/light tokens from the plan below. Include WCAG AA contrast ratios for each text/background pair.
3. **Typography** — Font family, size scale, weight scale, line heights.
4. **Spacing** — 4px grid, named tokens, usage rules (when to use space-2 vs space-3).
5. **Radii & Shadows** — Exact values from tokens below.
6. **Animation** — Curves, durations, which elements animate and how (open: scale 0.95→1 + opacity 0→1; close: reverse; results: stagger 20ms per item).
7. **Component Patterns** — For each: SearchInput, ResultItem, GroupHeader, Backdrop — describe layout, padding, colors, hover/focus states.
8. **Accessibility** — WCAG AA minimum, focus visible rings (2px solid accent), aria-label requirements, keyboard-only operability.
9. **Icon Style** — 16x16 favicons, monoline action icons, no filled/solid icons.

Key design tokens to define:

```
Colors (Dark):
  --smb-bg-primary: #1a1a2e
  --smb-bg-secondary: #16213e
  --smb-bg-hover: rgba(99, 102, 241, 0.15)
  --smb-border: rgba(255, 255, 255, 0.1)
  --smb-text-primary: #e0e0e0
  --smb-text-secondary: #a0a4b8
  --smb-text-muted: #6c7293
  --smb-accent: #6366f1
  --smb-accent-hover: #818cf8
  --smb-backdrop: rgba(0, 0, 0, 0.5)

Colors (Light):
  --smb-bg-primary: #ffffff
  --smb-bg-secondary: #f8f9fc
  --smb-bg-hover: rgba(99, 102, 241, 0.08)
  --smb-border: rgba(0, 0, 0, 0.08)
  --smb-text-primary: #1a1a2e
  --smb-text-secondary: #4a4e69
  --smb-text-muted: #9ca3af
  --smb-accent: #6366f1
  --smb-accent-hover: #4f46e5
  --smb-backdrop: rgba(0, 0, 0, 0.3)

Typography:
  --smb-font-family: system-ui, -apple-system, sans-serif
  --smb-font-size-xs: 10px
  --smb-font-size-sm: 12px
  --smb-font-size-base: 14px
  --smb-font-size-lg: 16px

Spacing:
  --smb-space-1: 4px
  --smb-space-2: 8px
  --smb-space-3: 12px
  --smb-space-4: 16px
  --smb-space-6: 24px
  --smb-space-8: 32px

Radii:
  --smb-radius-sm: 6px
  --smb-radius-md: 8px
  --smb-radius-lg: 12px

Shadows:
  --smb-shadow-overlay: 0 20px 60px rgba(0, 0, 0, 0.5)

Animation:
  --smb-duration-fast: 100ms
  --smb-duration-normal: 150ms
  --smb-ease-out: cubic-bezier(0.16, 1, 0.3, 1)
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs: add DESIGN.md with design language specification"
```

### Task 4: Create ARCHITECTURE.md (Architect)

**Files:**
- Create: `ARCHITECTURE.md`

- [ ] **Step 1: Write ARCHITECTURE.md**

Write the complete document — minimum 200 lines. **Acceptance criteria:** Each section must contain concrete details (file paths, code snippets, diagrams in ASCII/Mermaid). Source all technical details from the spec at `docs/superpowers/specs/2026-03-14-slashmebaby-design.md`.

Sections with required content:

1. **System Overview** — ASCII diagram showing: Background Service Worker ↔ Content Script ↔ Shadow DOM. Show which files belong to each. Include Onboarding Page and Settings Page as separate extension pages.
2. **Component Architecture** — For each module (TabCache, BookmarkCache, HistoryCache, ActionRegistry, SearchEngine, MessageRouter), list: responsibility (1 sentence), file path, public methods, dependencies.
3. **Messaging Protocol** — Reproduce the full TypeScript type definitions from spec Section 7 (SearchRequest, SearchResponse, ExecuteActionRequest, etc.). This is the contract — it must be exact.
4. **Data Layer** — Table: Source → API → Cache type → Refresh trigger → Timestamp field → Half-life. Copy from spec Section 3.
5. **Search Architecture** — Fuse.js config object (keys, threshold, distance). Scoring formula with example calculation. Grouping and ordering logic.
6. **Shadow DOM Strategy** — Open mode, mount lifecycle (create div → attach shadow → inject CSS → mount React), unmount = full destroy. Reference `src/entrypoints/content/index.tsx`.
7. **Cross-Browser Compatibility** — WXT's `browser` namespace. Feature detection pattern for optional APIs. List of Chrome-only vs universal APIs used.
8. **State Management** — Table: State → Storage API → Sync behavior → Schema. Cover settings, onboarding, runtime.
9. **Security Model** — No `unsafe-eval`, no remote code loading, minimal permissions justification table (copy from spec Section 7).
10. **Build & Deploy** — `npm run build` for Chrome, `npm run build:firefox` for Firefox. CI matrix: build → test → lint → coverage.

- [ ] **Step 2: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: add ARCHITECTURE.md with full technical architecture"
```

### Task 5: Create CONTEXT.md (Context Engineer)

**Files:**
- Create: `CONTEXT.md`

- [ ] **Step 1: Write CONTEXT.md**

Write the complete document — minimum 120 lines. **Acceptance criteria:** Each section must contain usable, copy-pasteable prompts — not descriptions of what prompts should contain.

1. **Project Bootstrap Prompt** — A 5-10 line prompt to paste at conversation start. Example: "You are working on SlashMeBaby, a cross-browser command palette extension. Read CLAUDE.md first. Tech stack: WXT + React + TypeScript. Key constraint: all UI renders inside Shadow DOM. All browser APIs via WXT's `browser` namespace."
2. **Per-Task Context Templates** — 4 concrete prompts:
   - Background service work → read: `src/lib/messaging.ts`, `src/entrypoints/background/`, `src/lib/search.ts`
   - Content script/UI work → read: `src/entrypoints/content/`, `src/components/CommandBar/`, `src/styles/`, `src/hooks/`
   - Test writing → read: the file under test + its test file + `vitest.config.ts`
   - Settings/Onboarding → read: `src/components/Settings/`, `src/components/Onboarding/`, `src/lib/storage.ts`
3. **File Dependency Map** — Table: File → Must co-read with → Reason
4. **Review Prompts** — 2 prompts: code review (check types, test coverage, Shadow DOM isolation), architecture review (check messaging contract, no direct chrome.* calls outside background)
5. **Debugging Prompts** — 3 templates: messaging failure, Shadow DOM style leak, cross-browser API difference

- [ ] **Step 2: Create CLAUDE.md**

```markdown
# CLAUDE.md

## Project
SlashMeBaby — Cross-browser command palette extension (Chrome + Firefox).

## Tech Stack
WXT + React 18 + TypeScript (strict) + Fuse.js + Vitest + Playwright

## Key Files
- `FEATURES.md` — Feature tracker with priorities and status
- `DESIGN.md` — Design language specification
- `ARCHITECTURE.md` — Technical architecture
- `CONTEXT.md` — Context management guide
- `PLAN.md` — Sprint plan
- `wxt.config.ts` — Extension configuration
- `src/entrypoints/background/` — Service worker (tabs, bookmarks, history, actions, messaging)
- `src/entrypoints/content/` — Content script (Shadow DOM, React mount)
- `src/components/CommandBar/` — Command bar UI components
- `src/lib/` — Shared utilities (search, messaging, storage)

## Conventions
- TDD: Write failing test first, then implement
- All browser APIs via WXT's `browser` namespace
- Typed messaging: every message type defined in `src/lib/messaging.ts`
- CSS scoped inside Shadow DOM only
- Commits: conventional commits (feat:, fix:, test:, docs:, chore:)

## Testing
- Unit: `npx vitest run`
- E2E: `npx playwright test`
- Coverage: `npx vitest run --coverage`
```

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md CLAUDE.md
git commit -m "docs: add CONTEXT.md and CLAUDE.md for context engineering"
```

### Task 6: Create PLAN.md (Scrum Master)

**Files:**
- Create: `PLAN.md`

- [ ] **Step 1: Write PLAN.md**

Write the complete document — minimum 150 lines. **Acceptance criteria:** Each sprint must list concrete deliverables, role assignments, and acceptance criteria — not just topic headings.

**Sprint structure (6 sprints):**

| Sprint | Name | Deliverables | Owner | Depends On |
|--------|------|-------------|-------|------------|
| 1 | Foundation | WXT project, FEATURES.md, DESIGN.md, ARCHITECTURE.md, CONTEXT.md, PLAN.md | PM, Designer, Architect, Context Eng, Scrum Master | None |
| 2 | Core Backend | messaging.ts, storage.ts, search.ts, tabs.ts, bookmarks.ts, history.ts, actions.ts, background/index.ts + all unit tests | Engineer | Sprint 1 |
| 3 | Command Bar UI | content/index.tsx, Shadow DOM mount, CommandBar components, CSS, keyboard navigation hooks + component tests | Engineer | Sprint 2 |
| 4 | Actions & Integration | Action execution, smart suggestions, full data flow end-to-end, action prefix mode | Engineer | Sprint 3 |
| 5 | Settings & Onboarding | Settings page, onboarding wizard, popup fallback, storage integration | Engineer | Sprint 4 |
| 6 | Polish & QA | E2E Playwright tests, cross-browser testing, performance profiling, coverage report, production build | QA, Engineer | Sprint 5 |

**QA gates per sprint** (what QA checks):
- Sprint 2: All unit tests pass, 100% coverage on lib/ and background/
- Sprint 3: Command bar renders in Shadow DOM, keyboard nav works, no style leaks
- Sprint 4: All 13 actions work, smart suggestions populate, > prefix filters correctly
- Sprint 5: Onboarding completes 4 steps, settings persist across sessions
- Sprint 6: E2E tests pass on Chrome and Firefox, no console errors, <50ms overlay

**RACI matrix:** R=Responsible, A=Accountable, C=Consulted, I=Informed

| Deliverable | PM | Designer | Architect | Context Eng | Engineer | QA | Scrum Master |
|------------|----|---------|-----------|-----------|---------|----|-------------|
| Feature scope | R | C | C | I | I | C | A |
| Design language | C | R | I | I | I | I | A |
| Architecture | I | I | R | C | C | I | A |
| Context docs | I | I | C | R | I | I | A |
| Source code | I | C | C | I | R | I | A |
| Testing | I | I | I | I | C | R | A |

**Enforcement rules:**
- QA finds untested feature → Scrum Master forces Engineer to write tests
- QA finds missing feature → Scrum Master forces PM to verify FEATURES.md → Architect if architecture gap → Engineer to implement
- Engineer blocked → Scrum Master forces Architect to clarify ARCHITECTURE.md
- Context insufficient → Scrum Master forces Context Engineer to update CONTEXT.md

- [ ] **Step 2: Commit**

```bash
git add PLAN.md
git commit -m "docs: add PLAN.md with sprint plan and RACI matrix"
```

---

## Chunk 2: Core Backend — Messaging, Data Layer & Search Engine

### Task 7: Create Typed Messaging Layer

**Files:**
- Create: `src/lib/messaging.ts`
- Create: `src/__tests__/lib/messaging.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/messaging.test.ts
import { describe, it, expect } from 'vitest';
import {
  type SearchRequest,
  type SearchResponse,
  type SmartSuggestionsRequest,
  type ExecuteActionRequest,
  type ExecuteActionResponse,
  type ToggleOverlayCommand,
  type GetSettingsRequest,
  type Message,
  isSearchRequest,
  isExecuteActionRequest,
  isToggleOverlayCommand,
  isSmartSuggestionsRequest,
  isGetSettingsRequest,
} from '../../lib/messaging';

describe('messaging', () => {
  describe('type guards', () => {
    it('identifies SearchRequest', () => {
      const msg: SearchRequest = {
        type: 'SEARCH',
        payload: { query: 'github', sources: ['tabs', 'bookmarks'] },
      };
      expect(isSearchRequest(msg)).toBe(true);
      expect(isExecuteActionRequest(msg)).toBe(false);
    });

    it('identifies ExecuteActionRequest', () => {
      const msg: ExecuteActionRequest = {
        type: 'EXECUTE_ACTION',
        payload: { actionId: 'close-tab', targetTabId: 42 },
      };
      expect(isExecuteActionRequest(msg)).toBe(true);
      expect(isSearchRequest(msg)).toBe(false);
    });

    it('identifies ToggleOverlayCommand', () => {
      const msg: ToggleOverlayCommand = { type: 'TOGGLE_OVERLAY' };
      expect(isToggleOverlayCommand(msg)).toBe(true);
    });

    it('identifies SmartSuggestionsRequest', () => {
      const msg: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };
      expect(isSmartSuggestionsRequest(msg)).toBe(true);
    });

    it('identifies GetSettingsRequest', () => {
      const msg: GetSettingsRequest = { type: 'GET_SETTINGS' };
      expect(isGetSettingsRequest(msg)).toBe(true);
    });

    it('rejects unknown messages', () => {
      const msg = { type: 'UNKNOWN' };
      expect(isSearchRequest(msg)).toBe(false);
      expect(isExecuteActionRequest(msg)).toBe(false);
      expect(isToggleOverlayCommand(msg)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/lib/messaging.test.ts
```

Expected: FAIL — module `../../lib/messaging` not found.

- [ ] **Step 3: Write messaging.ts**

```typescript
// src/lib/messaging.ts
export type Source = 'tabs' | 'bookmarks' | 'history' | 'actions';

export interface SearchResultItem {
  id: string;
  title: string;
  url?: string;
  icon?: string;
  score: number;
}

export interface ResultGroup {
  category: Source;
  items: SearchResultItem[];
}

// Content → Background
export interface SearchRequest {
  type: 'SEARCH';
  payload: { query: string; sources: Source[] };
}

export interface SearchResponse {
  groups: ResultGroup[];
}

export interface SmartSuggestionsRequest {
  type: 'SMART_SUGGESTIONS';
}

export interface ExecuteActionRequest {
  type: 'EXECUTE_ACTION';
  payload: { actionId: string; targetTabId?: number };
}

export interface ExecuteActionResponse {
  success: boolean;
  error?: string;
}

export interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}

export interface GetSettingsResponse {
  settings: UserSettings;
}

// Background → Content
export interface ToggleOverlayCommand {
  type: 'TOGGLE_OVERLAY';
}

// Settings shape
export interface UserSettings {
  shortcut: string;
  position: 'center' | 'top' | 'bottom';
  theme: 'system' | 'light' | 'dark';
  maxResultsPerGroup: number;
  showFavicons: boolean;
  searchSources: { tabs: boolean; bookmarks: boolean; history: boolean };
}

export const DEFAULT_SETTINGS: UserSettings = {
  shortcut: 'Alt+Space',
  position: 'center',
  theme: 'system',
  maxResultsPerGroup: 5,
  showFavicons: true,
  searchSources: { tabs: true, bookmarks: true, history: true },
};

export type Message =
  | SearchRequest
  | SmartSuggestionsRequest
  | ExecuteActionRequest
  | GetSettingsRequest
  | ToggleOverlayCommand;

// Type guards
export function isSearchRequest(msg: unknown): msg is SearchRequest {
  return typeof msg === 'object' && msg !== null && (msg as Message).type === 'SEARCH';
}

export function isExecuteActionRequest(msg: unknown): msg is ExecuteActionRequest {
  return typeof msg === 'object' && msg !== null && (msg as Message).type === 'EXECUTE_ACTION';
}

export function isToggleOverlayCommand(msg: unknown): msg is ToggleOverlayCommand {
  return typeof msg === 'object' && msg !== null && (msg as Message).type === 'TOGGLE_OVERLAY';
}

export function isSmartSuggestionsRequest(msg: unknown): msg is SmartSuggestionsRequest {
  return typeof msg === 'object' && msg !== null && (msg as Message).type === 'SMART_SUGGESTIONS';
}

export function isGetSettingsRequest(msg: unknown): msg is GetSettingsRequest {
  return typeof msg === 'object' && msg !== null && (msg as Message).type === 'GET_SETTINGS';
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/lib/messaging.test.ts
```

Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messaging.ts src/__tests__/lib/messaging.test.ts
git commit -m "feat: add typed messaging protocol with type guards"
```

### Task 8: Create Storage Layer

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/__tests__/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/storage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings, saveSettings, getOnboardingState, saveOnboardingState } from '../../lib/storage';
import { DEFAULT_SETTINGS, type UserSettings } from '../../lib/messaging';

// Mock chrome.storage
const mockSyncGet = vi.fn();
const mockSyncSet = vi.fn();
const mockLocalGet = vi.fn();
const mockLocalSet = vi.fn();

vi.stubGlobal('chrome', {
  storage: {
    sync: { get: mockSyncGet, set: mockSyncSet },
    local: { get: mockLocalGet, set: mockLocalSet },
  },
});

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('returns default settings when storage is empty', async () => {
      mockSyncGet.mockResolvedValue({});
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('merges stored settings with defaults', async () => {
      mockSyncGet.mockResolvedValue({ settings: { position: 'top' } });
      const settings = await getSettings();
      expect(settings.position).toBe('top');
      expect(settings.theme).toBe('system'); // default preserved
    });
  });

  describe('saveSettings', () => {
    it('persists settings to sync storage', async () => {
      mockSyncSet.mockResolvedValue(undefined);
      const updated: UserSettings = { ...DEFAULT_SETTINGS, position: 'bottom' };
      await saveSettings(updated);
      expect(mockSyncSet).toHaveBeenCalledWith({ settings: updated });
    });
  });

  describe('getOnboardingState', () => {
    it('returns initial state when storage is empty', async () => {
      mockLocalGet.mockResolvedValue({});
      const state = await getOnboardingState();
      expect(state).toEqual({ completedStep: 0, completed: false });
    });

    it('returns stored state', async () => {
      mockLocalGet.mockResolvedValue({ onboarding: { completedStep: 2, completed: false } });
      const state = await getOnboardingState();
      expect(state.completedStep).toBe(2);
    });
  });

  describe('saveOnboardingState', () => {
    it('persists onboarding state to local storage', async () => {
      mockLocalSet.mockResolvedValue(undefined);
      await saveOnboardingState({ completedStep: 3, completed: false });
      expect(mockLocalSet).toHaveBeenCalledWith({
        onboarding: { completedStep: 3, completed: false },
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/lib/storage.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write storage.ts**

```typescript
// src/lib/storage.ts
import { DEFAULT_SETTINGS, type UserSettings } from './messaging';

export interface OnboardingState {
  completedStep: number;
  completed: boolean;
}

const DEFAULT_ONBOARDING: OnboardingState = { completedStep: 0, completed: false };

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get('settings');
  if (!result.settings) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const result = await chrome.storage.local.get('onboarding');
  if (!result.onboarding) return { ...DEFAULT_ONBOARDING };
  return { ...DEFAULT_ONBOARDING, ...result.onboarding };
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  await chrome.storage.local.set({ onboarding: state });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/lib/storage.test.ts
```

Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/__tests__/lib/storage.test.ts
git commit -m "feat: add storage layer for settings and onboarding state"
```

### Task 9: Create Recency Scoring Module

**Files:**
- Create: `src/lib/search.ts`
- Create: `src/__tests__/lib/search.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/search.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeRecencyScore, computeFinalScore, createSearchEngine, type SearchableItem } from '../../lib/search';

describe('recency scoring', () => {
  it('returns 1.0 for an item accessed right now', () => {
    const now = Date.now();
    expect(computeRecencyScore(now, 2)).toBeCloseTo(1.0, 2);
  });

  it('returns ~0.5 for an item accessed one half-life ago', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(computeRecencyScore(twoHoursAgo, 2)).toBeCloseTo(0.5, 1);
  });

  it('returns ~0.25 for an item accessed two half-lives ago', () => {
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    expect(computeRecencyScore(fourHoursAgo, 2)).toBeCloseTo(0.25, 1);
  });

  it('returns 0 for items with no timestamp', () => {
    expect(computeRecencyScore(undefined, 2)).toBe(0);
  });
});

describe('final scoring', () => {
  it('combines fuse score and recency score with 60/40 weighting', () => {
    // Fuse returns 0 for perfect match, 1 for no match — we invert it
    const fuseScore = 0.0; // perfect match → invertedFuse = 1.0
    const recencyScore = 1.0; // just accessed
    const final = computeFinalScore(fuseScore, recencyScore);
    // (1.0 * 0.6) + (1.0 * 0.4) = 1.0
    expect(final).toBeCloseTo(1.0, 2);
  });

  it('weights poor match lower even with high recency', () => {
    const fuseScore = 0.8; // poor match → invertedFuse = 0.2
    const recencyScore = 1.0;
    const final = computeFinalScore(fuseScore, recencyScore);
    // (0.2 * 0.6) + (1.0 * 0.4) = 0.52
    expect(final).toBeCloseTo(0.52, 2);
  });
});

describe('search engine', () => {
  const items: SearchableItem[] = [
    { id: '1', title: 'GitHub Pull Requests', url: 'https://github.com/pulls', category: 'tabs', timestamp: Date.now() },
    { id: '2', title: 'GitLab Issues', url: 'https://gitlab.com/issues', category: 'tabs', timestamp: Date.now() - 3 * 60 * 60 * 1000 },
    { id: '3', title: 'Google Docs', url: 'https://docs.google.com', category: 'bookmarks', timestamp: Date.now() - 24 * 60 * 60 * 1000 },
  ];

  it('returns results grouped by category', () => {
    const engine = createSearchEngine(items);
    const results = engine.search('git');
    const categories = results.map(g => g.category);
    expect(categories).toContain('tabs');
  });

  it('ranks more recent items higher within a group', () => {
    const engine = createSearchEngine(items);
    const results = engine.search('git');
    const tabGroup = results.find(g => g.category === 'tabs');
    expect(tabGroup).toBeDefined();
    expect(tabGroup!.items[0].title).toBe('GitHub Pull Requests');
  });

  it('returns empty groups array for no matches', () => {
    const engine = createSearchEngine(items);
    const results = engine.search('xyznonexistent');
    const totalItems = results.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalItems).toBe(0);
  });

  it('respects maxResultsPerGroup', () => {
    const manyItems: SearchableItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      title: `Tab ${i}`,
      url: `https://example.com/${i}`,
      category: 'tabs' as const,
      timestamp: Date.now() - i * 1000,
    }));
    const engine = createSearchEngine(manyItems, { maxResultsPerGroup: 3 });
    const results = engine.search('Tab');
    const tabGroup = results.find(g => g.category === 'tabs');
    expect(tabGroup!.items.length).toBeLessThanOrEqual(3);
  });

  it('handles action prefix mode', () => {
    const withActions: SearchableItem[] = [
      ...items,
      { id: 'a1', title: 'Close Tab', category: 'actions' },
      { id: 'a2', title: 'Close Other Tabs', category: 'actions' },
    ];
    const engine = createSearchEngine(withActions);
    const results = engine.search('> close');
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('actions');
    expect(results[0].items.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/lib/search.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write search.ts**

```typescript
// src/lib/search.ts
import Fuse from 'fuse.js';
import type { Source, ResultGroup, SearchResultItem } from './messaging';

export interface SearchableItem {
  id: string;
  title: string;
  url?: string;
  category: Source;
  timestamp?: number;
  icon?: string;
}

interface SearchEngineOptions {
  maxResultsPerGroup: number;
}

const HALF_LIVES: Record<Source, number> = {
  tabs: 2,
  bookmarks: 168,
  history: 24,
  actions: 0, // not used
};

const CATEGORY_ORDER: Source[] = ['tabs', 'bookmarks', 'history', 'actions'];

export function computeRecencyScore(
  timestamp: number | undefined,
  halfLifeHours: number,
): number {
  if (timestamp === undefined || halfLifeHours === 0) return 0;
  const ageInHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  return Math.exp(-ageInHours / halfLifeHours);
}

export function computeFinalScore(fuseScore: number, recencyScore: number): number {
  const invertedFuse = 1 - fuseScore;
  return invertedFuse * 0.6 + recencyScore * 0.4;
}

export function createSearchEngine(
  items: SearchableItem[],
  options: SearchEngineOptions = { maxResultsPerGroup: 5 },
) {
  const fuse = new Fuse(items, {
    keys: ['title', 'url'],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    includeMatches: true,
  });

  return {
    search(query: string): ResultGroup[] {
      const isActionMode = query.startsWith('>');
      const cleanQuery = isActionMode ? query.slice(1).trim() : query;

      const sourcesToSearch = isActionMode
        ? ['actions' as Source]
        : CATEGORY_ORDER;

      let fuseResults: Fuse.FuseResult<SearchableItem>[];

      if (cleanQuery.length === 0) {
        // No query — return all items sorted by recency within each category
        fuseResults = items
          .filter(item => sourcesToSearch.includes(item.category))
          .map(item => ({
            item,
            refIndex: 0,
            score: 0, // perfect match (will be inverted to 1.0)
          }));
      } else {
        fuseResults = fuse.search(cleanQuery);
      }

      const grouped = new Map<Source, Array<SearchResultItem & { sortScore: number }>>();

      for (const result of fuseResults) {
        const { item } = result;
        if (!sourcesToSearch.includes(item.category)) continue;

        const fuseScore = result.score ?? 0;
        const halfLife = HALF_LIVES[item.category];
        const recencyScore = computeRecencyScore(item.timestamp, halfLife);
        const finalScore = computeFinalScore(fuseScore, recencyScore);

        if (!grouped.has(item.category)) {
          grouped.set(item.category, []);
        }

        grouped.get(item.category)!.push({
          id: item.id,
          title: item.title,
          url: item.url,
          icon: item.icon,
          score: finalScore,
          sortScore: finalScore,
        });
      }

      const results: ResultGroup[] = [];

      for (const category of sourcesToSearch) {
        const groupItems = grouped.get(category);
        if (!groupItems || groupItems.length === 0) continue;

        groupItems.sort((a, b) => b.sortScore - a.sortScore);
        const limited = groupItems.slice(0, options.maxResultsPerGroup);

        results.push({
          category,
          items: limited.map(({ sortScore, ...item }) => item),
        });
      }

      return results;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/lib/search.test.ts
```

Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/__tests__/lib/search.test.ts
git commit -m "feat: add search engine with Fuse.js and recency-weighted scoring"
```

### Task 10: Create Tab Data Cache

**Files:**
- Create: `src/entrypoints/background/tabs.ts`
- Create: `src/__tests__/background/tabs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/background/tabs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabCache } from '../../entrypoints/background/tabs';
import type { SearchableItem } from '../../lib/search';

// Mock chrome.tabs API
const mockQuery = vi.fn();
vi.stubGlobal('chrome', {
  tabs: {
    query: mockQuery,
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
  },
});

describe('TabCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads all tabs on refresh', async () => {
    mockQuery.mockResolvedValue([
      { id: 1, title: 'GitHub', url: 'https://github.com', favIconUrl: 'icon.png', lastAccessed: Date.now() },
      { id: 2, title: 'Google', url: 'https://google.com', favIconUrl: '', lastAccessed: Date.now() - 1000 },
    ]);

    const cache = new TabCache();
    await cache.refresh();
    const items = cache.getItems();

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('GitHub');
    expect(items[0].category).toBe('tabs');
  });

  it('converts chrome tabs to SearchableItems', async () => {
    const now = Date.now();
    mockQuery.mockResolvedValue([
      { id: 42, title: 'Test Tab', url: 'https://test.com', favIconUrl: 'fav.ico', lastAccessed: now },
    ]);

    const cache = new TabCache();
    await cache.refresh();
    const items = cache.getItems();

    expect(items[0]).toEqual({
      id: 'tab-42',
      title: 'Test Tab',
      url: 'https://test.com',
      icon: 'fav.ico',
      category: 'tabs',
      timestamp: now,
    });
  });

  it('returns empty array before refresh', () => {
    const cache = new TabCache();
    expect(cache.getItems()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/background/tabs.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write tabs.ts**

```typescript
// src/entrypoints/background/tabs.ts
import type { SearchableItem } from '../../lib/search';

export class TabCache {
  private items: SearchableItem[] = [];

  async refresh(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    this.items = tabs
      .filter(tab => tab.id !== undefined && tab.title)
      .map(tab => ({
        id: `tab-${tab.id}`,
        title: tab.title!,
        url: tab.url,
        icon: tab.favIconUrl || undefined,
        category: 'tabs' as const,
        timestamp: tab.lastAccessed,
      }));
  }

  getItems(): SearchableItem[] {
    return this.items;
  }

  setupListeners(onUpdate: () => void): void {
    chrome.tabs.onCreated.addListener(() => { this.refresh().then(onUpdate); });
    chrome.tabs.onRemoved.addListener(() => { this.refresh().then(onUpdate); });
    chrome.tabs.onUpdated.addListener(() => { this.refresh().then(onUpdate); });
    chrome.tabs.onActivated.addListener(() => { this.refresh().then(onUpdate); });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/background/tabs.test.ts
```

Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/background/tabs.ts src/__tests__/background/tabs.test.ts
git commit -m "feat: add TabCache for tracking open tabs"
```

### Task 11: Create Bookmark Data Cache

**Files:**
- Create: `src/entrypoints/background/bookmarks.ts`
- Create: `src/__tests__/background/bookmarks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/background/bookmarks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookmarkCache } from '../../entrypoints/background/bookmarks';

const mockGetTree = vi.fn();
vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: mockGetTree,
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
  },
});

describe('BookmarkCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flattens nested bookmark tree', async () => {
    mockGetTree.mockResolvedValue([{
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Toolbar',
          children: [
            { id: '2', title: 'GitHub', url: 'https://github.com', dateAdded: 1000 },
            {
              id: '3',
              title: 'Folder',
              children: [
                { id: '4', title: 'Nested', url: 'https://nested.com', dateAdded: 2000 },
              ],
            },
          ],
        },
      ],
    }]);

    const cache = new BookmarkCache();
    await cache.refresh();
    const items = cache.getItems();

    expect(items).toHaveLength(2);
    expect(items.map(i => i.title)).toContain('GitHub');
    expect(items.map(i => i.title)).toContain('Nested');
  });

  it('skips folders (nodes without url)', async () => {
    mockGetTree.mockResolvedValue([{
      id: '0',
      title: '',
      children: [
        { id: '1', title: 'Folder Only', children: [] },
      ],
    }]);

    const cache = new BookmarkCache();
    await cache.refresh();
    expect(cache.getItems()).toHaveLength(0);
  });

  it('sets category to bookmarks', async () => {
    mockGetTree.mockResolvedValue([{
      id: '0',
      title: '',
      children: [
        { id: '1', title: 'Site', url: 'https://site.com', dateAdded: 1000 },
      ],
    }]);

    const cache = new BookmarkCache();
    await cache.refresh();
    expect(cache.getItems()[0].category).toBe('bookmarks');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/background/bookmarks.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write bookmarks.ts**

```typescript
// src/entrypoints/background/bookmarks.ts
import type { SearchableItem } from '../../lib/search';

export class BookmarkCache {
  private items: SearchableItem[] = [];

  async refresh(): Promise<void> {
    const tree = await chrome.bookmarks.getTree();
    this.items = [];
    this.flattenTree(tree);
  }

  private flattenTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): void {
    for (const node of nodes) {
      if (node.url) {
        this.items.push({
          id: `bookmark-${node.id}`,
          title: node.title,
          url: node.url,
          category: 'bookmarks',
          timestamp: node.dateAdded,
        });
      }
      if (node.children) {
        this.flattenTree(node.children);
      }
    }
  }

  getItems(): SearchableItem[] {
    return this.items;
  }

  setupListeners(onUpdate: () => void): void {
    chrome.bookmarks.onCreated.addListener(() => { this.refresh().then(onUpdate); });
    chrome.bookmarks.onRemoved.addListener(() => { this.refresh().then(onUpdate); });
    chrome.bookmarks.onChanged.addListener(() => { this.refresh().then(onUpdate); });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/background/bookmarks.test.ts
```

Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/background/bookmarks.ts src/__tests__/background/bookmarks.test.ts
git commit -m "feat: add BookmarkCache with tree flattening"
```

### Task 12: Create History Data Cache

**Files:**
- Create: `src/entrypoints/background/history.ts`
- Create: `src/__tests__/background/history.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/background/history.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryCache } from '../../entrypoints/background/history';

const mockSearch = vi.fn();
vi.stubGlobal('chrome', {
  history: { search: mockSearch },
});

describe('HistoryCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads history items on refresh', async () => {
    mockSearch.mockResolvedValue([
      { id: '1', title: 'Page One', url: 'https://one.com', lastVisitTime: Date.now() },
      { id: '2', title: 'Page Two', url: 'https://two.com', lastVisitTime: Date.now() - 5000 },
    ]);

    const cache = new HistoryCache();
    await cache.refresh();
    expect(cache.getItems()).toHaveLength(2);
  });

  it('converts to SearchableItem with history category', async () => {
    const now = Date.now();
    mockSearch.mockResolvedValue([
      { id: '1', title: 'Test', url: 'https://test.com', lastVisitTime: now },
    ]);

    const cache = new HistoryCache();
    await cache.refresh();
    const item = cache.getItems()[0];
    expect(item.category).toBe('history');
    expect(item.timestamp).toBe(now);
    expect(item.id).toBe('history-1');
  });

  it('skips items without title', async () => {
    mockSearch.mockResolvedValue([
      { id: '1', title: '', url: 'https://notitle.com', lastVisitTime: Date.now() },
      { id: '2', title: 'Has Title', url: 'https://has.com', lastVisitTime: Date.now() },
    ]);

    const cache = new HistoryCache();
    await cache.refresh();
    expect(cache.getItems()).toHaveLength(1);
    expect(cache.getItems()[0].title).toBe('Has Title');
  });

  it('queries last 1000 items with text empty string', async () => {
    mockSearch.mockResolvedValue([]);
    const cache = new HistoryCache();
    await cache.refresh();
    expect(mockSearch).toHaveBeenCalledWith({ text: '', maxResults: 1000 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/background/history.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write history.ts**

```typescript
// src/entrypoints/background/history.ts
import type { SearchableItem } from '../../lib/search';

export class HistoryCache {
  private items: SearchableItem[] = [];
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  async refresh(): Promise<void> {
    const historyItems = await chrome.history.search({ text: '', maxResults: 1000 });
    this.items = historyItems
      .filter(item => item.title && item.url)
      .map(item => ({
        id: `history-${item.id}`,
        title: item.title!,
        url: item.url!,
        category: 'history' as const,
        timestamp: item.lastVisitTime,
      }));
  }

  getItems(): SearchableItem[] {
    return this.items;
  }

  startPeriodicRefresh(intervalMs: number = 5 * 60 * 1000): void {
    this.stopPeriodicRefresh();
    this.refreshInterval = setInterval(() => { this.refresh(); }, intervalMs);
  }

  stopPeriodicRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/background/history.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/background/history.ts src/__tests__/background/history.test.ts
git commit -m "feat: add HistoryCache with periodic refresh"
```

### Task 13: Create Actions Registry

**Files:**
- Create: `src/entrypoints/background/actions.ts`
- Create: `src/__tests__/background/actions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/background/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionRegistry, type ActionDefinition } from '../../entrypoints/background/actions';

const mockTabsUpdate = vi.fn();
const mockTabsRemove = vi.fn();
const mockTabsCreate = vi.fn();
const mockTabsDuplicate = vi.fn();
const mockTabsReload = vi.fn();
const mockTabsQuery = vi.fn();
const mockTabsMove = vi.fn();
const mockWindowsCreate = vi.fn();
const mockSessionsRestore = vi.fn();
const mockSessionsGetRecentlyClosed = vi.fn();

vi.stubGlobal('chrome', {
  tabs: {
    update: mockTabsUpdate,
    remove: mockTabsRemove,
    create: mockTabsCreate,
    duplicate: mockTabsDuplicate,
    reload: mockTabsReload,
    query: mockTabsQuery,
    move: mockTabsMove,
  },
  windows: { create: mockWindowsCreate },
  sessions: {
    restore: mockSessionsRestore,
    getRecentlyClosed: mockSessionsGetRecentlyClosed,
  },
  runtime: { openOptionsPage: vi.fn() },
});

describe('ActionRegistry', () => {
  let registry: ActionRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ActionRegistry();
  });

  it('returns all actions as SearchableItems', () => {
    const items = registry.getItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(item => item.category === 'actions')).toBe(true);
  });

  it('includes Close Tab action', () => {
    const items = registry.getItems();
    const closeTab = items.find(item => item.id === 'action-close-tab');
    expect(closeTab).toBeDefined();
    expect(closeTab!.title).toBe('Close Tab');
  });

  it('includes all expected actions', () => {
    const items = registry.getItems();
    const ids = items.map(i => i.id);
    expect(ids).toContain('action-close-tab');
    expect(ids).toContain('action-close-other-tabs');
    expect(ids).toContain('action-pin-tab');
    expect(ids).toContain('action-mute-tab');
    expect(ids).toContain('action-duplicate-tab');
    expect(ids).toContain('action-move-to-window');
    expect(ids).toContain('action-reload-tab');
    expect(ids).toContain('action-new-tab');
    expect(ids).toContain('action-recently-closed');
    expect(ids).toContain('action-close-duplicates');
    expect(ids).toContain('action-sort-by-domain');
    expect(ids).toContain('action-settings');
  });

  it('executes close-tab action', async () => {
    mockTabsRemove.mockResolvedValue(undefined);
    const result = await registry.execute('close-tab', 42);
    expect(mockTabsRemove).toHaveBeenCalledWith(42);
    expect(result.success).toBe(true);
  });

  it('executes duplicate-tab action', async () => {
    mockTabsDuplicate.mockResolvedValue({ id: 99 });
    const result = await registry.execute('duplicate-tab', 42);
    expect(mockTabsDuplicate).toHaveBeenCalledWith(42);
    expect(result.success).toBe(true);
  });

  it('returns error for unknown action', async () => {
    const result = await registry.execute('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/background/actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write actions.ts**

```typescript
// src/entrypoints/background/actions.ts
import type { SearchableItem } from '../../lib/search';
import type { ExecuteActionResponse } from '../../lib/messaging';

export interface ActionDefinition {
  id: string;
  title: string;
  execute: (targetTabId?: number) => Promise<ExecuteActionResponse>;
}

export class ActionRegistry {
  private actions: ActionDefinition[];

  constructor() {
    this.actions = [
      {
        id: 'close-tab',
        title: 'Close Tab',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          await chrome.tabs.remove(tabId);
          return { success: true };
        },
      },
      {
        id: 'close-other-tabs',
        title: 'Close Other Tabs',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const toClose = tabs.filter(t => t.id !== tabId && !t.pinned).map(t => t.id!);
          await chrome.tabs.remove(toClose);
          return { success: true };
        },
      },
      {
        id: 'pin-tab',
        title: 'Pin / Unpin Tab',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          const tab = await chrome.tabs.get(tabId);
          await chrome.tabs.update(tabId, { pinned: !tab.pinned });
          return { success: true };
        },
      },
      {
        id: 'mute-tab',
        title: 'Mute / Unmute Tab',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          const tab = await chrome.tabs.get(tabId);
          await chrome.tabs.update(tabId, { muted: !tab.mutedInfo?.muted });
          return { success: true };
        },
      },
      {
        id: 'duplicate-tab',
        title: 'Duplicate Tab',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          await chrome.tabs.duplicate(tabId);
          return { success: true };
        },
      },
      {
        id: 'move-to-window',
        title: 'Move to New Window',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          await chrome.windows.create({ tabId });
          return { success: true };
        },
      },
      {
        id: 'reload-tab',
        title: 'Reload Tab',
        execute: async (tabId) => {
          if (!tabId) return { success: false, error: 'No tab specified' };
          await chrome.tabs.reload(tabId);
          return { success: true };
        },
      },
      {
        id: 'new-tab',
        title: 'New Tab',
        execute: async () => {
          await chrome.tabs.create({});
          return { success: true };
        },
      },
      {
        id: 'recently-closed',
        title: 'Recently Closed',
        execute: async () => {
          // This action triggers sub-list mode in the UI
          return { success: true };
        },
      },
      {
        id: 'close-duplicates',
        title: 'Close All Duplicates',
        execute: async () => {
          const tabs = await chrome.tabs.query({});
          const seen = new Map<string, number>();
          const toClose: number[] = [];
          for (const tab of tabs) {
            if (tab.url && tab.id) {
              if (seen.has(tab.url)) {
                toClose.push(tab.id);
              } else {
                seen.set(tab.url, tab.id);
              }
            }
          }
          if (toClose.length > 0) await chrome.tabs.remove(toClose);
          return { success: true };
        },
      },
      {
        id: 'sort-by-domain',
        title: 'Sort Tabs by Domain',
        execute: async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const sorted = [...tabs].sort((a, b) => {
            const domainA = a.url ? new URL(a.url).hostname : '';
            const domainB = b.url ? new URL(b.url).hostname : '';
            return domainA.localeCompare(domainB);
          });
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].id) {
              await chrome.tabs.move(sorted[i].id!, { index: i });
            }
          }
          return { success: true };
        },
      },
      {
        id: 'settings',
        title: 'Settings',
        execute: async () => {
          chrome.runtime.openOptionsPage();
          return { success: true };
        },
      },
    ];
  }

  getItems(): SearchableItem[] {
    return this.actions.map(action => ({
      id: `action-${action.id}`,
      title: action.title,
      category: 'actions' as const,
    }));
  }

  async execute(actionId: string, targetTabId?: number): Promise<ExecuteActionResponse> {
    const action = this.actions.find(a => a.id === actionId);
    if (!action) return { success: false, error: `Unknown action: ${actionId}` };
    try {
      return await action.execute(targetTabId);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/background/actions.test.ts
```

Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/background/actions.ts src/__tests__/background/actions.test.ts
git commit -m "feat: add ActionRegistry with all v1 tab/navigation/utility actions"
```

### Task 14: Create Background Service Worker Message Router

**Files:**
- Create: `src/entrypoints/background/index.ts`
- Create: `src/__tests__/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/background/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMessageRouter } from '../../entrypoints/background/index';
import type { SearchRequest, ExecuteActionRequest, SmartSuggestionsRequest } from '../../lib/messaging';

// Mock all chrome APIs
vi.stubGlobal('chrome', {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  },
  bookmarks: {
    getTree: vi.fn().mockResolvedValue([{ id: '0', title: '', children: [] }]),
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
  },
  history: {
    search: vi.fn().mockResolvedValue([]),
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
  runtime: {
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
  },
  storage: {
    sync: { get: vi.fn().mockResolvedValue({}), set: vi.fn() },
    local: { get: vi.fn().mockResolvedValue({}), set: vi.fn() },
  },
});

describe('createMessageRouter', () => {
  it('handles SEARCH messages', async () => {
    const router = await createMessageRouter();
    const msg: SearchRequest = {
      type: 'SEARCH',
      payload: { query: 'test', sources: ['tabs'] },
    };
    const response = await router(msg);
    expect(response).toHaveProperty('groups');
    expect(Array.isArray(response.groups)).toBe(true);
  });

  it('handles EXECUTE_ACTION messages', async () => {
    const router = await createMessageRouter();
    const msg: ExecuteActionRequest = {
      type: 'EXECUTE_ACTION',
      payload: { actionId: 'new-tab' },
    };
    vi.mocked(chrome.tabs.create).mockResolvedValue({} as chrome.tabs.Tab);
    // Add chrome.tabs.create mock
    (chrome.tabs as any).create = vi.fn().mockResolvedValue({});
    const response = await router(msg);
    expect(response).toHaveProperty('success');
  });

  it('handles SMART_SUGGESTIONS messages', async () => {
    const router = await createMessageRouter();
    const msg: SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };
    const response = await router(msg);
    expect(response).toHaveProperty('groups');
  });

  it('returns error for unknown message type', async () => {
    const router = await createMessageRouter();
    const response = await router({ type: 'UNKNOWN' } as any);
    expect(response).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/background/index.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write background/index.ts**

```typescript
// src/entrypoints/background/index.ts
import { TabCache } from './tabs';
import { BookmarkCache } from './bookmarks';
import { HistoryCache } from './history';
import { ActionRegistry } from './actions';
import { createSearchEngine } from '../../lib/search';
import { getSettings } from '../../lib/storage';
import {
  isSearchRequest,
  isExecuteActionRequest,
  isSmartSuggestionsRequest,
  isGetSettingsRequest,
  type SearchResponse,
  type ExecuteActionResponse,
} from '../../lib/messaging';

export async function createMessageRouter() {
  const tabCache = new TabCache();
  const bookmarkCache = new BookmarkCache();
  const historyCache = new HistoryCache();
  const actionRegistry = new ActionRegistry();

  // Initial data load
  await Promise.all([
    tabCache.refresh(),
    bookmarkCache.refresh(),
    historyCache.refresh(),
  ]);

  // Set up event-driven refresh for tabs and bookmarks
  tabCache.setupListeners(() => {});
  bookmarkCache.setupListeners(() => {});
  historyCache.startPeriodicRefresh();

  return async function handleMessage(message: unknown): Promise<unknown> {
    if (isSearchRequest(message)) {
      const settings = await getSettings();
      const allItems = [
        ...(message.payload.sources.includes('tabs') ? tabCache.getItems() : []),
        ...(message.payload.sources.includes('bookmarks') ? bookmarkCache.getItems() : []),
        ...(message.payload.sources.includes('history') ? historyCache.getItems() : []),
        ...actionRegistry.getItems(),
      ];
      const engine = createSearchEngine(allItems, {
        maxResultsPerGroup: settings.maxResultsPerGroup,
      });
      const groups = engine.search(message.payload.query);
      return { groups } satisfies SearchResponse;
    }

    if (isSmartSuggestionsRequest(message)) {
      const settings = await getSettings();
      const allItems = [
        ...tabCache.getItems(),
        ...bookmarkCache.getItems(),
        ...actionRegistry.getItems(),
      ];
      const engine = createSearchEngine(allItems, {
        maxResultsPerGroup: settings.maxResultsPerGroup,
      });
      const groups = engine.search('');
      return { groups } satisfies SearchResponse;
    }

    if (isExecuteActionRequest(message)) {
      const actionId = message.payload.actionId.replace('action-', '');
      return await actionRegistry.execute(actionId, message.payload.targetTabId);
    }

    if (isGetSettingsRequest(message)) {
      const settings = await getSettings();
      return { settings };
    }

    return { error: 'Unknown message type' };
  };
}

// WXT entrypoint — only runs in actual extension context
export default defineBackground(() => {
  createMessageRouter().then(router => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      router(message).then(sendResponse);
      return true; // keep message channel open for async response
    });

    chrome.commands.onCommand.addListener((command) => {
      if (command === 'toggle-command-bar') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_OVERLAY' });
          }
        });
      }
    });

    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding/index.html') });
      }
    });
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/background/index.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/background/index.ts src/__tests__/background/index.test.ts
git commit -m "feat: add background service worker with message router"
```

---

## Chunk 3: Content Script, Shadow DOM & Command Bar UI

### Task 15: Content Script with Shadow DOM Mount

**Files:**
- Create: `src/entrypoints/content/index.tsx`
- Create: `src/styles/command-bar.css`

- [ ] **Step 1: Write content/index.tsx**

Uses WXT's `defineContentScript`. Creates host `<div id="slashmebaby-root">`, attaches open Shadow DOM, injects CSS via `<style>` tag. Listens for `TOGGLE_OVERLAY` messages from background. On toggle: mounts/unmounts React `<App />` into shadow root mount div. Full unmount destroys React tree (clean state on each open).

Key implementation:
```typescript
import { createRoot } from 'react-dom/client';
import { App } from './App';
import styles from '../../styles/command-bar.css?inline';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const host = document.createElement('div');
    host.id = 'slashmebaby-root';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    let root: ReturnType<typeof createRoot> | null = null;

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TOGGLE_OVERLAY') {
        if (root) {
          root.unmount();
          root = null;
        } else {
          root = createRoot(mountPoint);
          root.render(<App />);
        }
      }
    });
  },
});
```

- [ ] **Step 2: Write command-bar.css**

Implement all design tokens from DESIGN.md. CSS custom properties for theming. Include:
- `:host` reset (`all: initial`)
- `.smb-backdrop` (fixed overlay, z-index 2147483647)
- `.smb-container` (positioned per setting: center/top/bottom)
- `.smb-input` (search field styles)
- `.smb-group-header` (uppercase, muted text)
- `.smb-result-item` (flex row with icon, title, url, keyboard hint)
- `.smb-result-item--selected` (accent highlight)
- `@media (prefers-color-scheme: dark/light)` for system theme
- Animations: `@keyframes smb-open` (scale 0.95 to 1 + opacity 0 to 1, 150ms ease-out)

- [ ] **Step 3: Verify extension loads**

```bash
npm run build
```

Load the extension in Chrome via `chrome://extensions` Load unpacked select `dist/` folder. Verify no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/content/index.tsx src/styles/command-bar.css
git commit -m "feat: add content script with Shadow DOM mount and base styles"
```

### Task 16: SearchInput Component

**Files:**
- Create: `src/components/CommandBar/SearchInput.tsx`
- Create: `src/__tests__/components/SearchInput.test.tsx`

- [ ] **Step 1: Write failing test** — renders input, calls onQueryChange, renders search icon, has placeholder, autofocuses
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement SearchInput.tsx** — Props: `query`, `onQueryChange`. Renders: wrapper div + search icon SVG + `<input autoFocus>`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add SearchInput component"`

### Task 17: GroupHeader Component

**Files:**
- Create: `src/components/CommandBar/GroupHeader.tsx`
- Create: `src/__tests__/components/GroupHeader.test.tsx`

- [ ] **Step 1: Write failing test** — renders category as uppercase label
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Props: `category: Source`. Maps to display labels (tabs->"Open Tabs", etc.)
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add GroupHeader component"`

### Task 18: ResultItem Component

**Files:**
- Create: `src/components/CommandBar/ResultItem.tsx`
- Create: `src/__tests__/components/ResultItem.test.tsx`

- [ ] **Step 1: Write failing test** — renders title, URL domain, favicon, selected class, keyboard hint, click handler
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Props: `item`, `isSelected`, `showFavicons`, `onSelect`. Flex row layout.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add ResultItem component"`

### Task 19: ResultList Component

**Files:**
- Create: `src/components/CommandBar/ResultList.tsx`
- Create: `src/__tests__/components/ResultList.test.tsx`

- [ ] **Step 1: Write failing test** — renders group headers + items, highlights selected, handles empty
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Props: `groups`, `selectedIndex`, `showFavicons`, `onSelectItem`. Flattens into linear list.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add ResultList component"`

### Task 20: useKeyboard Hook

**Files:**
- Create: `src/hooks/useKeyboard.ts`
- Create: `src/__tests__/hooks/useKeyboard.test.ts`

- [ ] **Step 1: Write failing test** — arrow keys move selection, wraps, Escape dismisses, Backspace on empty dismisses, Enter executes, Tab jumps group
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Attaches keydown listener. Handles ArrowUp/Down/Tab/Enter/Escape/Backspace.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add useKeyboard hook"`

### Task 21: useSearch Hook

**Files:**
- Create: `src/hooks/useSearch.ts`
- Create: `src/__tests__/hooks/useSearch.test.ts`

- [ ] **Step 1: Write failing test** — sends SMART_SUGGESTIONS on mount, SEARCH on query change, returns groups
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — `useSearch(query)` sends messages to background via `chrome.runtime.sendMessage`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add useSearch hook"`

### Task 22: useTheme Hook

**Files:**
- Create: `src/hooks/useTheme.ts`
- Create: `src/__tests__/hooks/useTheme.test.ts`

- [ ] **Step 1: Write failing test** — returns dark/light based on OS, respects explicit override
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Uses `matchMedia('(prefers-color-scheme: dark)')`, returns resolved theme
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add useTheme hook"`

### Task 23: CommandBar Container

**Files:**
- Create: `src/components/CommandBar/CommandBar.tsx`
- Create: `src/__tests__/components/CommandBar.test.tsx`

- [ ] **Step 1: Write failing test** — renders backdrop + input + results, integrates search/keyboard/theme hooks, executes actions, dismisses
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Integrates all hooks and sub-components. Handles position and theme classes.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add CommandBar container"`

### Task 24: App Root Component

**Files:**
- Create: `src/entrypoints/content/App.tsx`
- Create: `src/__tests__/content/App.test.tsx`

- [ ] **Step 1: Write failing test** — renders CommandBar, handles dismiss
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — Wrapper rendering `<CommandBar onDismiss={...} />`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add App root component"`

---

## Chunk 4: Settings, Onboarding & Popup Fallback

### Task 25: useSettings Hook

**Files:**
- Create: `src/hooks/useSettings.ts`
- Create: `src/__tests__/hooks/useSettings.test.ts`

- [ ] **Step 1: Write failing test** — loads settings on mount, returns defaults when empty, updateSetting persists
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — `useSettings()` returns `{ settings, updateSetting, isLoading }`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add useSettings hook"`

### Task 26: Settings Page Components

**Files:**
- Create: `src/components/Settings/SettingsPage.tsx`
- Create: `src/components/Settings/ShortcutSetting.tsx`
- Create: `src/components/Settings/PositionSetting.tsx`
- Create: `src/components/Settings/ThemeSetting.tsx`
- Create: `src/components/Settings/SearchSources.tsx`
- Create: `src/__tests__/components/Settings.test.tsx`
- Create: `src/entrypoints/settings/index.html`
- Create: `src/entrypoints/settings/main.tsx`

- [ ] **Step 1: Write failing tests** — each component renders options, calls updateSetting
- [ ] **Step 2: Run tests — expect FAIL**
- [ ] **Step 3: Implement all components** — controlled form components using useSettings
- [ ] **Step 4: Create entrypoint** — HTML + main.tsx rendering SettingsPage
- [ ] **Step 5: Run tests — expect PASS**
- [ ] **Step 6: Commit** — `git commit -m "feat: add settings page"`

### Task 27: Onboarding Components

**Files:**
- Create: `src/components/Onboarding/OnboardingWizard.tsx`
- Create: `src/components/Onboarding/ShortcutPicker.tsx`
- Create: `src/components/Onboarding/TryItStep.tsx`
- Create: `src/components/Onboarding/NavigationGuide.tsx`
- Create: `src/components/Onboarding/CompletionStep.tsx`
- Create: `src/__tests__/components/Onboarding.test.tsx`
- Create: `src/entrypoints/onboarding/index.html`
- Create: `src/entrypoints/onboarding/main.tsx`

- [ ] **Step 1: Write failing tests** — wizard advances steps, saves progress, shortcut picker works
- [ ] **Step 2: Run tests — expect FAIL**
- [ ] **Step 3: Implement all components** — wizard with 4 steps, saves to chrome.storage.local
- [ ] **Step 4: Create entrypoint** — HTML + main.tsx rendering OnboardingWizard
- [ ] **Step 5: Run tests — expect PASS**
- [ ] **Step 6: Commit** — `git commit -m "feat: add onboarding wizard"`

### Task 28: Popup Fallback

**Files:**
- Create: `src/entrypoints/popup/index.html`
- Create: `src/entrypoints/popup/main.tsx`
- Create: `src/entrypoints/popup/Popup.tsx`

- [ ] **Step 1: Write failing test** — popup renders mini CommandBar
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — reuses CommandBar components, 400x500px, no backdrop
- [ ] **Step 4: Update wxt.config.ts** — add `action.default_popup`
- [ ] **Step 5: Run test — expect PASS**
- [ ] **Step 6: Commit** — `git commit -m "feat: add popup fallback"`

---

## Chunk 5: QA, E2E Testing & Production Polish

### Task 29: Vitest Configuration & Coverage

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Configure Vitest** with jsdom environment, coverage thresholds (100% lib/background, 90% components/hooks)
- [ ] **Step 2: Run full suite** — `npx vitest run --coverage`
- [ ] **Step 3: Commit** — `git commit -m "chore: add vitest config with coverage thresholds"`

### Task 30: Playwright E2E Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/setup.ts`
- Create: `e2e/extension.spec.ts`

- [ ] **Step 1: Configure Playwright** for extension testing (headed mode, load unpacked)
- [ ] **Step 2: Write E2E setup** — helper to get extension ID, wait for injection
- [ ] **Step 3: Write core E2E tests** — extension loads, shortcut opens bar, typing filters, arrow keys navigate, Enter switches tab, Escape dismisses, `>` prefix works, settings renders, onboarding opens
- [ ] **Step 4: Run** — `npm run build && npx playwright test`
- [ ] **Step 5: Commit** — `git commit -m "test: add Playwright E2E tests"`

### Task 31: Firefox Build & Test

- [ ] **Step 1: Build for Firefox** — `npx wxt build --browser firefox`
- [ ] **Step 2: Write Firefox E2E tests** — same core flows
- [ ] **Step 3: Run** — `npx playwright test --project=firefox`
- [ ] **Step 4: Commit** — `git commit -m "test: add Firefox E2E tests"`

### Task 32: Documentation

**Files:**
- Create: `docs/developer-guide.md`
- Create: `docs/user-guide.md`
- Create: `docs/api-reference.md`

- [ ] **Step 1: Write developer guide** — setup, structure, adding actions/sources, testing, building
- [ ] **Step 2: Write user guide** — installation, shortcuts, features, settings, FAQ
- [ ] **Step 3: Write API reference** — messaging types, storage schemas, action IDs
- [ ] **Step 4: Commit** — `git commit -m "docs: add developer, user, and API reference docs"`

### Task 33: Final QA Checklist

- [ ] **Step 1: Run full unit tests with coverage** — verify thresholds met
- [ ] **Step 2: Run full E2E suite** — all pass
- [ ] **Step 3: Feature completeness check** — cross-ref FEATURES.md, all P0/P1 "Complete"
- [ ] **Step 4: Performance check** — overlay <50ms, search <16ms, no memory leaks
- [ ] **Step 5: Security review** — no dynamic code execution, no remote loading, minimal permissions, CSP-compliant
- [ ] **Step 6: Update FEATURES.md** — mark all implemented features "Complete"
- [ ] **Step 7: Final commit** — `git commit -m "chore: final QA — all features complete, all tests passing"`
