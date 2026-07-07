# ARCHITECTURE.md — SlashMeBaby Technical Architecture

Last updated: 2026-03-14

---

## 1. System Overview

SlashMeBaby is a browser extension built with WXT (Vite-based cross-browser framework). The extension has three execution contexts: a background service worker, content scripts injected into web pages, and extension pages (onboarding, settings). All inter-context communication is handled through typed messages over the browser runtime messaging API.

### ASCII Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  HOST PAGE (any http/https tab)                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CONTENT SCRIPT (src/entrypoints/content/index.tsx)         │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Shadow DOM Root (mode: open)                        │  │   │
│  │  │                                                      │  │   │
│  │  │  ┌────────────────────────────────────────────────┐  │  │   │
│  │  │  │  React App                                     │  │  │   │
│  │  │  │                                                │  │  │   │
│  │  │  │  ┌──────────────┐  ┌──────────────────────┐  │  │  │   │
│  │  │  │  │  CommandBar  │  │  Hooks               │  │  │  │   │
│  │  │  │  │  ├SearchInput│  │  ├ useSearch.ts       │  │  │  │   │
│  │  │  │  │  ├ResultList │  │  ├ useKeyboard.ts     │  │  │  │   │
│  │  │  │  │  ├ResultItem │  │  ├ useTheme.ts        │  │  │  │   │
│  │  │  │  │  └GroupHeader│  │  └ useSettings.ts     │  │  │  │   │
│  │  │  │  └──────────────┘  └──────────────────────┘  │  │  │   │
│  │  │  └────────────────────────────────────────────────┘  │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                          ▲  ▼  (chrome.runtime.sendMessage) │   │
│  └──────────────────────────┼──┼──────────────────────────────┘   │
│                             │  │                                   │
└─────────────────────────────┼──┼───────────────────────────────────┘
                              │  │
              ┌───────────────┘  └───────────────┐
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKGROUND SERVICE WORKER (src/entrypoints/background/index.ts)   │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │  MessageRouter │  │  SearchEngine  │  │  ActionRegistry      │ │
│  │  (index.ts)    │  │  (search.ts)   │  │  (actions.ts)        │ │
│  └───────┬────────┘  └───────┬────────┘  └──────────────────────┘ │
│          │                   │                                      │
│          ▼                   ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Data Caches                                               │    │
│  │  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐  │    │
│  │  │  TabCache    │ │ BookmarkCache │ │  HistoryCache    │  │    │
│  │  │  (tabs.ts)   │ │(bookmarks.ts) │ │  (history.ts)    │  │    │
│  │  └──────────────┘ └───────────────┘ └──────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               ▲                                     │
│              chrome.tabs / chrome.bookmarks / chrome.history        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  EXTENSION PAGES                                                    │
│  ┌────────────────────────────┐  ┌────────────────────────────┐   │
│  │  Onboarding                │  │  Settings                  │   │
│  │  src/entrypoints/onboarding│  │  src/entrypoints/settings  │   │
│  └────────────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 TabCache

**Responsibility:** Maintains an always-current in-memory snapshot of all open tabs across all windows. Listens to browser tab events to keep the cache fresh. Computes `lastAccessed` timestamps from `chrome.tabs.Tab` objects for recency scoring.

**File path:** `src/entrypoints/background/tabs.ts`

**Public methods:**

```typescript
class TabCache {
  // Initialize cache and register event listeners
  init(): Promise<void>;

  // Return current tab snapshot (all windows)
  getAll(): chrome.tabs.Tab[];

  // Get the tab that triggered the current command (for contextual actions)
  getActiveTab(): Promise<chrome.tabs.Tab>;
}
```

**Dependencies:** `browser.tabs` (via WXT namespace), event listeners: `tabs.onCreated`, `tabs.onRemoved`, `tabs.onUpdated`, `tabs.onActivated`, `tabs.onMoved`

---

### 2.2 BookmarkCache

**Responsibility:** Maintains a flattened in-memory list of all bookmark leaf nodes (no folders). Listens to bookmark events to invalidate and rebuild the cache.

**File path:** `src/entrypoints/background/bookmarks.ts`

**Public methods:**

```typescript
class BookmarkCache {
  // Initialize cache and register event listeners
  init(): Promise<void>;

  // Return flattened array of bookmark leaf nodes
  getAll(): chrome.bookmarks.BookmarkTreeNode[];
}
```

**Dependencies:** `browser.bookmarks` (via WXT namespace), event listeners: `bookmarks.onCreated`, `bookmarks.onRemoved`, `bookmarks.onChanged`, `bookmarks.onMoved`

---

### 2.3 HistoryCache

**Responsibility:** Stores the last 1,000 history items in memory. Fetched eagerly on service worker startup. Refreshed every 5 minutes via a periodic alarm. Not event-driven (history events are too granular to be useful for cache invalidation).

**File path:** `src/entrypoints/background/history.ts`

**Public methods:**

```typescript
class HistoryCache {
  // Initialize cache, fetch initial history, set up periodic refresh alarm
  init(): Promise<void>;

  // Return cached history items (up to 1000)
  getAll(): chrome.history.HistoryItem[];

  // Force immediate refresh (called by alarm handler)
  refresh(): Promise<void>;
}
```

**Dependencies:** `browser.history`, `browser.alarms` (for 5-minute periodic refresh)

---

### 2.4 ActionRegistry

**Responsibility:** Static in-memory registry of all available actions. Actions are categorized as Tab Actions (contextual), Navigation Actions, and Utility Actions. Provides filtering based on current tab state (e.g., Mute/Unmute only available when tab is audible).

**File path:** `src/entrypoints/background/actions.ts`

**Public methods:**

```typescript
interface Action {
  id: string;
  name: string;
  description?: string;
  category: 'tab' | 'navigation' | 'utility';
  condition?: (tab: chrome.tabs.Tab) => boolean;
  execute: (tab: chrome.tabs.Tab) => Promise<void>;
}

class ActionRegistry {
  // Return all actions applicable to the given tab context
  getApplicable(tab: chrome.tabs.Tab): Action[];

  // Execute an action by ID against a target tab
  execute(actionId: string, targetTabId: number): Promise<void>;
}
```

**Dependencies:** `browser.tabs`, `browser.sessions`, `browser.windows`

---

### 2.5 SearchEngine

**Responsibility:** Orchestrates Fuse.js fuzzy search across all data sources. Applies recency-weighted scoring. Groups and sorts results. Returns a `SearchResponse` suitable for the UI.

**File path:** `src/lib/search.ts`

**Public methods:**

```typescript
class SearchEngine {
  // Build (or rebuild) Fuse.js indexes from current cache state
  buildIndexes(
    tabs: chrome.tabs.Tab[],
    bookmarks: chrome.bookmarks.BookmarkTreeNode[],
    history: chrome.history.HistoryItem[],
    actions: Action[]
  ): void;

  // Run a search query and return grouped results
  search(query: string, sources: string[]): SearchResponse;

  // Return smart suggestions for the empty state
  getSmartSuggestions(activeTab: chrome.tabs.Tab): SearchResponse;
}
```

**Dependencies:** `fuse.js`

---

### 2.6 MessageRouter

**Responsibility:** Central message dispatcher in the background service worker. Routes incoming messages from content scripts to the appropriate handler (SearchEngine, ActionRegistry, etc.) and returns typed responses.

**File path:** `src/entrypoints/background/index.ts`

**Public methods:** Not exposed directly — registers `browser.runtime.onMessage` listener on service worker startup.

**Message handling:**
- `SEARCH` → `SearchEngine.search()`
- `SMART_SUGGESTIONS` → `SearchEngine.getSmartSuggestions()`
- `EXECUTE_ACTION` → `ActionRegistry.execute()`
- `GET_SETTINGS` → `browser.storage.sync.get()`
- `TOGGLE_OVERLAY` → sent *to* content scripts (background → content direction)

**Dependencies:** `TabCache`, `BookmarkCache`, `HistoryCache`, `ActionRegistry`, `SearchEngine`, `browser.runtime`, `browser.storage`

---

## 3. Messaging Protocol

Complete TypeScript types for all inter-context messages. Defined in `src/lib/messaging.ts`.

```typescript
// ─── Content → Background Requests ───────────────────────────────────────────

export type SearchRequest = {
  type: 'SEARCH';
  payload: {
    query: string;
    sources: ('tabs' | 'bookmarks' | 'history' | 'actions')[];
  };
};

export type SearchResponse = {
  groups: Array<{
    category: 'tabs' | 'bookmarks' | 'history' | 'actions';
    items: Array<{
      id: string;
      title: string;
      url?: string;
      icon?: string;
      score: number;
    }>;
  }>;
};

export type SmartSuggestionsRequest = {
  type: 'SMART_SUGGESTIONS';
};

export type SmartSuggestionsResponse = SearchResponse; // Same shape

export type ExecuteActionRequest = {
  type: 'EXECUTE_ACTION';
  payload: {
    actionId: string;
    targetTabId?: number;
  };
};

export type ExecuteActionResponse = {
  success: boolean;
  error?: string;
};

export type GetSettingsRequest = {
  type: 'GET_SETTINGS';
};

export type GetSettingsResponse = {
  settings: UserSettings;
};

// ─── Background → Content Commands ───────────────────────────────────────────

export type ToggleOverlayCommand = {
  type: 'TOGGLE_OVERLAY';
};

// ─── Union Types (for message handler type guards) ────────────────────────────

export type BackgroundRequest =
  | SearchRequest
  | SmartSuggestionsRequest
  | ExecuteActionRequest
  | GetSettingsRequest;

export type ContentCommand =
  | ToggleOverlayCommand;

// ─── Settings Schema ──────────────────────────────────────────────────────────

export type UserSettings = {
  shortcut: 'alt+space' | 'ctrl+shift+l' | 'ctrl+.' | 'ctrl+/';
  position: 'center' | 'top' | 'bottom';
  theme: 'system' | 'light' | 'dark';
  maxResultsPerGroup: 3 | 5 | 8;
  showFavicons: boolean;
  sources: {
    tabs: boolean;
    bookmarks: boolean;
    history: boolean;
  };
};

export const DEFAULT_SETTINGS: UserSettings = {
  shortcut: 'alt+space',
  position: 'center',
  theme: 'system',
  maxResultsPerGroup: 5,
  showFavicons: true,
  sources: { tabs: true, bookmarks: true, history: true },
};
```

### Message Usage Pattern

```typescript
// Content script sending a message:
const response = await browser.runtime.sendMessage<SearchRequest, SearchResponse>({
  type: 'SEARCH',
  payload: { query: 'react docs', sources: ['tabs', 'bookmarks', 'history', 'actions'] },
});

// Background message handler (with type guard):
browser.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse) => {
    if (message.type === 'SEARCH') {
      const result = searchEngine.search(message.payload.query, message.payload.sources);
      sendResponse(result);
    }
    return true; // Keep message channel open for async response
  }
);
```

---

## 4. Data Layer

| Source | Browser API | Cache Location | Refresh Trigger | Timestamp Field | Half-life |
|--------|------------|----------------|-----------------|-----------------|-----------|
| Tabs | `browser.tabs.query({})` | In-memory array in `TabCache` | `tabs.onCreated`, `tabs.onRemoved`, `tabs.onUpdated`, `tabs.onActivated` | `tab.lastAccessed` (ms since epoch) | 2 hours |
| Bookmarks | `browser.bookmarks.getTree()` | In-memory flat array in `BookmarkCache` | `bookmarks.onCreated`, `bookmarks.onRemoved`, `bookmarks.onChanged`, `bookmarks.onMoved` | `node.dateAdded` (ms since epoch) | 168 hours (1 week) |
| History | `browser.history.search({ text: '', maxResults: 1000 })` | In-memory array in `HistoryCache` | Service worker startup + `browser.alarms` every 5 minutes | `item.lastVisitTime` (ms since epoch) | 24 hours |
| Actions | Static registry in `ActionRegistry` | Constant (never cached) | Never (static) | N/A | N/A |

### Storage API Usage

| Data | Storage API | Sync? | Schema Key |
|------|------------|-------|-----------|
| User settings | `chrome.storage.sync` | Yes (across devices) | `settings` |
| Onboarding progress | `chrome.storage.local` | No (per device) | `onboarding` |

---

## 5. Search Architecture

### Fuse.js Configuration

One Fuse.js index per data source. Each index is rebuilt when the underlying cache changes.

```typescript
const fuseOptions: Fuse.IFuseOptions<SearchableItem> = {
  keys: ['title', 'url', 'name'],  // 'name' used for actions
  threshold: 0.4,                   // 0 = exact, 1 = match anything
  distance: 100,                    // How far a match can be from expected position
  includeScore: true,               // Required for recency blending
  includeMatches: true,             // Required for match highlighting
  minMatchCharLength: 1,
  shouldSort: true,
};
```

### Scoring Formula

Fuse.js returns a `score` between 0 (perfect match) and 1 (no match). We invert and blend with recency:

```typescript
function computeFinalScore(fuseScore: number, recencyScore: number): number {
  // Invert fuseScore: 0 (perfect) → 1.0, 1 (no match) → 0.0
  const fuzzyScore = 1 - fuseScore;
  return fuzzyScore * 0.6 + recencyScore * 0.4;
}
```

Recency score uses exponential decay with ln(2) correction so that a record at exactly one half-life scores exactly 0.5:

```typescript
const LN2 = Math.LN2; // 0.6931471805599453

function computeRecencyScore(timestampMs: number, halfLifeHours: number): number {
  const ageInHours = (Date.now() - timestampMs) / (1000 * 60 * 60);
  return Math.exp(-LN2 * ageInHours / halfLifeHours);
}
```

Actions always have `recencyScore = 0` (they do not have timestamps). Their final score is `fuzzyScore * 0.6 + 0 * 0.4 = fuzzyScore * 0.6`.

### Action Prefix Mode

When query starts with `>`:

```typescript
function preprocessQuery(rawQuery: string): { query: string; actionOnly: boolean } {
  if (rawQuery.startsWith('>')) {
    return { query: rawQuery.slice(1).trimStart(), actionOnly: true };
  }
  return { query: rawQuery, actionOnly: false };
}
```

If `actionOnly` is true, only the actions Fuse index is queried. Tab, Bookmark, and History indexes are skipped entirely.

### Result Grouping

Results are returned in a fixed order: Tabs → Bookmarks → History → Actions. Each group is capped at `settings.maxResultsPerGroup` (default 5). Total results capped at 15. Groups with zero results are omitted from the response.

```typescript
function groupResults(
  tabs: FuseResult[],
  bookmarks: FuseResult[],
  history: FuseResult[],
  actions: FuseResult[],
  maxPerGroup: number
): SearchResponse['groups'] {
  const groups = [
    { category: 'tabs', items: tabs.slice(0, maxPerGroup) },
    { category: 'bookmarks', items: bookmarks.slice(0, maxPerGroup) },
    { category: 'history', items: history.slice(0, maxPerGroup) },
    { category: 'actions', items: actions.slice(0, maxPerGroup) },
  ] as const;
  return groups
    .filter(g => g.items.length > 0)
    .map(g => ({ ...g, items: g.items.map(toResultItem) }));
}
```

---

## 6. Shadow DOM Strategy

### Mount Lifecycle

1. **Content script load:** Create `<div id="slashmebaby-root">`, append to `document.body`, call `attachShadow({ mode: 'open' })`.
2. **CSS injection:** Inject a `<style>` tag inside the shadow root with bundled CSS (WXT/Vite bundles the CSS at build time).
3. **React mount point:** Create `<div id="slashmebaby-app">` inside the shadow root as the React render target.
4. **Overlay activation:** On `TOGGLE_OVERLAY` message, call `ReactDOM.createRoot(mountDiv).render(<App />)` to mount the React tree.
5. **Overlay close:** After close animation completes (150ms), call `root.unmount()` to fully destroy the React tree and reset all state.

### Why Open Mode

`mode: 'open'` allows browser DevTools to inspect the Shadow DOM during development. There is no security-sensitive content inside the overlay (no tokens, no PII) — everything rendered is already available in the browser UI. Closed mode would provide no security benefit while making debugging significantly harder.

### Full Unmount on Close

The React tree is fully unmounted (not hidden) on every close. This means:
- Search input is always empty on open
- No stale search results from a previous session
- No risk of event listeners accumulating
- Predictable, deterministic behavior

The performance cost of re-creating the React tree is negligible (under 5ms) compared to the UX benefit of guaranteed clean state.

### Restricted Pages

Content scripts cannot inject into `chrome://`, `chrome-extension://`, `about:`, or browser-internal pages. On these pages:
- The keyboard shortcut has no effect (browser blocks it)
- The extension icon opens a popup (`src/entrypoints/popup/`) with equivalent search functionality
- The popup communicates with the background service worker using the same messaging protocol

---

## 7. Cross-Browser Compatibility

### WXT Browser Namespace

All browser API calls use WXT's `browser` namespace, which auto-applies `webextension-polyfill` for Chrome/Firefox API differences:

```typescript
// Always use this:
import { browser } from 'wxt/browser';
browser.tabs.query({});

// Never use:
chrome.tabs.query({});  // Chrome-specific, breaks Firefox
```

### Manifest Generation

WXT generates platform-specific manifests from `wxt.config.ts`:

```typescript
// wxt.config.ts
export default defineConfig({
  manifest: {
    permissions: ['tabs', 'bookmarks', 'history', 'storage', 'commands', 'activeTab', 'sessions'],
    commands: {
      'toggle-overlay': {
        suggested_key: { default: 'Alt+Space' },
        description: 'Open SlashMeBaby',
      },
    },
  },
});
```

Chrome builds produce MV3 manifests; Firefox builds produce MV2 or MV3 manifests as appropriate for the Firefox version targeted.

### Feature Detection

Chrome-only features are guarded at runtime:

```typescript
// Tab groups (Chrome-only)
function isTabGroupsSupported(): boolean {
  return typeof browser.tabGroups !== 'undefined';
}
```

Actions that require unavailable APIs are excluded from `ActionRegistry.getApplicable()` at runtime, so they never appear in the UI on unsupported browsers.

---

## 8. State Management

There is no global client-side state manager (no Redux, no Zustand). State is minimal and split by concern:

| State | Storage API | Synced | Schema Key | Access Pattern |
|-------|------------|--------|-----------|----------------|
| User settings | `chrome.storage.sync` | Yes | `settings` | Read on command bar open, written on settings page save |
| Onboarding progress | `chrome.storage.local` | No | `onboarding` | `{ completedStep: number, completed: boolean }` |
| Tab cache | In-memory (background) | N/A | N/A | Rebuilt from events, queried on each SEARCH |
| Bookmark cache | In-memory (background) | N/A | N/A | Rebuilt from events, queried on each SEARCH |
| History cache | In-memory (background) | N/A | N/A | Refreshed every 5 min, queried on each SEARCH |
| Overlay open/closed | React component state | N/A | N/A | Local to content script, lost on unmount |
| Search query | React component state | N/A | N/A | Local to CommandBar, cleared on each mount |
| Selected item index | React component state | N/A | N/A | Local to CommandBar, cleared on each mount |

Settings are read via `useSettings` hook in the content script React app. The hook fetches via `GET_SETTINGS` message on mount and subscribes to `chrome.storage.onChanged` for live updates.

---

## 9. Security

### Content Security Policy

WXT enforces strict CSP in MV3:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

- No `unsafe-eval` — Fuse.js does not require it
- No `unsafe-inline` — all styles are loaded from extension bundle, not inline strings (with the exception of dynamically injected CSS into Shadow DOM which is technically inline but within the extension's own controlled context)
- No external script sources

### Permissions

Minimal permissions, each justified:

| Permission | Justification | Could Be Reduced? |
|-----------|--------------|-------------------|
| `tabs` | Read tab titles, URLs, favicons; execute tab actions (close, pin, mute) | No — core feature |
| `bookmarks` | Search bookmark tree | No — core feature |
| `history` | Search browsing history | No — core feature |
| `storage` | Persist user settings and onboarding state | No — required for personalization |
| `commands` | Register keyboard shortcut | No — activation mechanism |
| `activeTab` | Execute actions on the currently active tab | No — required for tab actions |
| `sessions` | Access `chrome.sessions.getRecentlyClosed()` and `chrome.sessions.restore()` | No — required for Recently Closed feature |

No host permissions are requested beyond the content script match pattern (`<all_urls>` limited to `http://` and `https://`).

### Data Handling

- No data is transmitted to external servers
- No analytics, no telemetry
- History items are held in memory only; never written to disk by the extension
- Settings sync uses `chrome.storage.sync` which is a browser-provided encrypted sync mechanism

---

## 10. Build System

### Build Commands

| Command | Output | Target |
|---------|--------|--------|
| `npm run build` | `.output/chrome-mv3/` | Chrome, Edge, Brave (MV3) |
| `npm run build:firefox` | `.output/firefox-mv2/` | Firefox (MV2) |
| `npm run dev` | Hot-reload dev server | Chrome (default) |
| `npm run dev:firefox` | Hot-reload dev server | Firefox |
| `npx vitest run` | Unit test results | All |
| `npx vitest run --coverage` | Coverage report | All |
| `npx playwright test` | E2E test results | Chrome |

### WXT Configuration

`wxt.config.ts` is the single configuration entrypoint. It handles:
- Entrypoint discovery (`src/entrypoints/`)
- Manifest generation per target browser
- Vite plugin configuration (React, TypeScript)
- Content script match patterns and run-at timing

### CI Pipeline

Both browser targets are built and tested in CI on every pull request:

```
CI Pipeline:
  1. Install dependencies (npm ci)
  2. TypeScript type check (tsc --noEmit)
  3. Lint (eslint)
  4. Unit tests with coverage (vitest run --coverage)
  5. Build Chrome (npm run build)
  6. Build Firefox (npm run build:firefox)
  7. E2E tests on Chrome build (playwright test)
  8. Bundle size check (warn if > 500KB unzipped)
```

Coverage targets: 100% for `src/lib/` (search, messaging, storage), 90%+ for `src/components/`, best-effort for `src/entrypoints/` (browser API integration layers).
