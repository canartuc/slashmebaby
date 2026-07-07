# SlashMeBaby — Design Specification

## 1. Product Vision

**SlashMeBaby** is a cross-browser command palette extension that gives Chrome, Brave, Edge, and Firefox users the tab management elegance of Arc and Zen browsers — activated with a single keystroke.

**Target audience:** Mainstream browser users frustrated with tab overload. Must be dead simple, discoverable, and polished enough for Chrome Web Store / Firefox Add-ons featuring.

**Core loop:**
1. User presses their chosen shortcut (default: Alt+Space)
2. A center-stage overlay appears with smart suggestions
3. User types to fuzzy-search across open tabs, bookmarks, history, and actions
4. Results appear grouped by category, ranked by recency
5. Arrow keys to navigate, Enter to act, Escape to dismiss

**Performance targets:**
- Overlay appearance: under 50ms
- Search results: under 16ms (one frame)

**Key principles:**
- Instant — no perceptible latency
- Invisible until needed — zero visual footprint when inactive
- Safe — Shadow DOM isolation prevents host page interference
- Mainstream-friendly — beautiful by default, no configuration required

## 2. Command Bar UI

### Position Options

Users choose their preferred position in settings. Three options:

| Position | Description | Default? |
|---|---|---|
| **Center Stage** | Centered with dimmed backdrop, Spotlight-style | Yes |
| Top Anchored | Drops from browser top, Arc-style | No |
| Bottom Anchored | Rises from bottom, closer to keyboard | No |

### Visual Design

- Dark theme by default (follows system light/dark preference)
- Rounded container (12px border-radius)
- Subtle backdrop dim (50% opacity black)
- Smooth open/close animations (scale + fade, ~150ms)
- Search input with icon at top, results below
- Selected item highlighted with accent color background (indigo/purple family)
- Group headers as small uppercase labels between result sections
- Favicon/status indicators on each result row
- Keyboard hint badges (Enter, Tab) on focused items

### Theme Strategy

- v1: System-aware light/dark only
- Future: Community themes

## 3. Search & Results

### Data Sources

| Source | API | Caching | Refresh Trigger |
|---|---|---|---|
| Open Tabs | `chrome.tabs.query({})` | In-memory, all windows | `tabs.onCreated/Removed/Updated` |
| Bookmarks | `chrome.bookmarks.getTree()` | In-memory, flattened | `bookmarks.onChanged/Created/Removed` |
| History | `chrome.history.search()` | Last 1000 items | Eager on first load, then periodic (every 5 min) |
| Actions | Static registry | Constant | Never |

### Search Pipeline

1. User types → instant (0ms debounce) → SEARCH message sent to background service worker → Fuse.js fuzzy match runs in the background context (not the content script UI thread)
2. Custom scoring: `finalScore = fuseScore * 0.6 + recencyScore * 0.4`
3. Results grouped: Tabs → Bookmarks → History → Actions
4. Max 5 results per group, 15 total visible

### Recency Scoring

Each data source derives a `recencyScore` (0.0–1.0) using exponential decay:

```
recencyScore = Math.exp(-ln(2) * ageInHours / halfLifeHours)
```

| Source | Timestamp Field | Half-life |
|---|---|---|
| Tabs | `lastAccessed` (from `chrome.tabs.Tab`) | 2 hours |
| Bookmarks | `dateAdded` (from `chrome.bookmarks.BookmarkTreeNode`) | 168 hours (1 week) |
| History | `lastVisitTime` (from `chrome.history.HistoryItem`) | 24 hours |
| Actions | N/A (no recency — scored by string match only) | N/A |

This means a tab accessed 2 hours ago scores 0.5, while a bookmark added a week ago scores 0.5. Actions rely solely on fuzzy match score (their `recencyScore` is always 0).

### Action Prefix Behavior

When the user types `>` as the first character:
- The `>` is stripped from the query before passing to Fuse.js
- Only Action results are shown (Tabs, Bookmarks, History groups are hidden)
- Typing `> close` matches against action names like "Close Tab", "Close Other Tabs"
- Deleting back to empty (removing the `>`) returns to normal multi-source mode

### Fuse.js Configuration

- Keys: `title`, `url` (for tabs/bookmarks/history), `name` (for actions)
- Threshold: 0.4 (moderately fuzzy)
- Distance: 100
- Include score and matches for highlighting

### Empty State (Before Typing)

Smart suggestions: 3 recent tabs + 2 frequent bookmarks + 2 contextual actions (e.g., "Mute Tab" only if current tab is audible).

### Keyboard Navigation

| Key | Action |
|---|---|
| `↑ / ↓` | Move between items (crosses group boundaries) |
| `Tab` | Jump to next group header |
| `Enter` | Execute selected item |
| `Escape` | Dismiss overlay |
| `Backspace` on empty | No action (does not dismiss) |
| `>` prefix | Filter to actions only |

## 4. Actions Registry (v1)

### Tab Actions (contextual)

| Action | Condition |
|---|---|
| Close Tab | Always |
| Close Other Tabs | Always |
| Pin / Unpin Tab | Always (label toggles) |
| Mute / Unmute Tab | Only if tab is audible |
| Duplicate Tab | Always |
| Move to New Window | Always |
| Reload Tab | Always |

### Navigation Actions

| Action | Description |
|---|---|
| New Tab | Open blank tab |
| Recently Closed | Opens a sub-list within the command bar showing the 10 most recently closed tabs (via `chrome.sessions.getRecentlyClosed()`). Selecting one restores it via `chrome.sessions.restore()`. |
| Go to URL | Navigate typed URL in current tab |

### Utility Actions

| Action | Description |
|---|---|
| Close All Duplicates | Find and close tabs with identical URLs |
| Sort Tabs by Domain | Reorder tabs grouping by domain |
| Settings | Open SlashMeBaby settings page |

### Out of Scope for v1

Tab groups, tab suspension/hibernation, bookmark CRUD, tab sharing.

## 5. Onboarding

4-step interactive tutorial on first install:

1. **Choose Your Shortcut** — Pick from Alt+Space, Ctrl+Shift+L, Ctrl+., Ctrl+/. Can change later.
2. **Try It Now** — Prompts user to press their chosen shortcut. Command bar appears live.
3. **Navigate Results** — Teaches arrow keys, Tab, Enter, Escape via visual cheat sheet.
4. **You're Ready** — Pro tips: `>` prefix for actions, recency learning, settings link.

The tutorial opens automatically on first install via `runtime.onInstalled`. Progress is saved to `chrome.storage.local` (not synced — onboarding is per-device) as `{ onboarding: { completedStep: number, completed: boolean } }` so users can resume if they close the tab.

## 6. Settings

Accessible via the Actions menu ("Settings") or the extension icon right-click menu.

| Setting | Options | Default |
|---|---|---|
| Activation Shortcut | Alt+Space, Ctrl+Shift+L, Ctrl+., Ctrl+/ (these are suggested defaults; users can also set custom shortcuts via `chrome://extensions/shortcuts`) | Alt+Space |
| Bar Position | Center, Top, Bottom | Center |
| Theme | System (auto), Light, Dark | System |
| Max Results Per Group | 3, 5, 8 | 5 |
| Show Favicons | On / Off | On |
| Search Sources | Tabs, Bookmarks, History (toggleable) | All on |

Settings persisted via `chrome.storage.sync` (syncs across devices).

## 7. Technical Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | WXT (Vite-based, cross-browser) |
| UI | React 18+ with Shadow DOM isolation |
| Search | Fuse.js with custom recency-weighted scoring |
| Styling | CSS Modules scoped inside Shadow DOM |
| Language | TypeScript (strict mode) |
| Testing | Vitest (unit), Playwright (E2E) |
| Targets | Chrome MV3, Firefox MV2/MV3 (Edge and Brave are Chromium forks — covered by Chrome build, no separate handling needed) |

### Extension Structure

```
src/
├── entrypoints/
│   ├── background/          # Service worker
│   │   ├── index.ts         # Message router
│   │   ├── tabs.ts          # Tab tracking & recency scoring
│   │   ├── bookmarks.ts     # Bookmark cache
│   │   ├── history.ts       # History cache
│   │   └── actions.ts       # Action registry
│   ├── content/             # Content script
│   │   ├── index.tsx        # Shadow DOM mount point
│   │   └── App.tsx          # Root React component
│   ├── onboarding/          # Extension page
│   │   └── index.html
│   └── settings/            # Extension page
│       └── index.html
├── components/
│   ├── CommandBar/
│   │   ├── CommandBar.tsx
│   │   ├── SearchInput.tsx
│   │   ├── ResultList.tsx
│   │   ├── ResultItem.tsx
│   │   └── GroupHeader.tsx
│   ├── Onboarding/
│   │   ├── OnboardingWizard.tsx  # Step container with progress indicator
│   │   ├── ShortcutPicker.tsx    # Step 1: shortcut selection grid
│   │   ├── TryItStep.tsx         # Step 2: live shortcut test prompt
│   │   ├── NavigationGuide.tsx   # Step 3: keyboard navigation cheat sheet
│   │   └── CompletionStep.tsx    # Step 4: pro tips and finish
│   └── Settings/
│       ├── SettingsPage.tsx      # Settings layout container
│       ├── ShortcutSetting.tsx   # Shortcut picker (reuses ShortcutPicker)
│       ├── PositionSetting.tsx   # Bar position radio group
│       ├── ThemeSetting.tsx      # Theme selector
│       └── SearchSources.tsx     # Toggle switches for data sources
├── hooks/
│   ├── useSearch.ts
│   ├── useKeyboard.ts
│   ├── useTheme.ts
│   └── useSettings.ts
├── lib/
│   ├── search.ts
│   ├── messaging.ts
│   └── storage.ts
├── styles/
│   └── command-bar.css
└── assets/
    └── icons/
```

### Messaging Protocol

All communication between the background service worker and content scripts uses typed messages via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`. The protocol:

```typescript
// Content → Background requests
type SearchRequest = {
  type: 'SEARCH';
  payload: { query: string; sources: ('tabs' | 'bookmarks' | 'history' | 'actions')[] };
};
type SearchResponse = {
  groups: Array<{
    category: 'tabs' | 'bookmarks' | 'history' | 'actions';
    items: Array<{ id: string; title: string; url?: string; icon?: string; score: number }>;
  }>;
};

type SmartSuggestionsRequest = { type: 'SMART_SUGGESTIONS' };
type SmartSuggestionsResponse = SearchResponse; // Same shape

type ExecuteActionRequest = {
  type: 'EXECUTE_ACTION';
  payload: { actionId: string; targetTabId?: number };
};
type ExecuteActionResponse = { success: boolean; error?: string };

type GetSettingsRequest = { type: 'GET_SETTINGS' };
type GetSettingsResponse = { settings: UserSettings };

// Background → Content commands
type ToggleOverlayCommand = { type: 'TOGGLE_OVERLAY' };
```

### Shadow DOM Mount Strategy

The content script creates an **open** Shadow DOM root attached to a `<div id="slashmebaby-root">` injected at the end of `document.body`:

1. On content script load: create host `<div>`, attach `shadowRoot` with `mode: 'open'`
2. Inject CSS into the shadow root via `<style>` tag (bundled at build time by WXT/Vite)
3. React renders into a mount `<div>` inside the shadow root
4. Open mode chosen over closed so devtools can inspect during development; no security-sensitive content is rendered

The overlay starts unmounted. On `TOGGLE_OVERLAY` message, React mounts/unmounts into the shadow root. Full unmount (destroying React tree and state) on close — search input is always empty on open. This keeps behavior predictable and avoids stale state.

### Data Flow

```
User keystroke
  → chrome.commands listener (background service worker)
  → sends TOGGLE_OVERLAY message to content script
  → content script mounts/unmounts React app in Shadow DOM
  → React app sends SMART_SUGGESTIONS or SEARCH request to background
  → background queries chrome.tabs/bookmarks/history APIs
  → applies recency scoring, returns SearchResponse
  → user navigates and selects
  → EXECUTE_ACTION message sent to background
  → background executes action (switch tab, close, pin, etc.)
  → content script unmounts overlay
```

### Content Script Injection Scope

Content scripts run on all `http://` and `https://` pages. They **cannot** run on restricted pages (`chrome://`, `chrome-extension://`, `about:`, browser internal pages). On restricted pages, the command palette is unavailable — the extension icon in the toolbar opens a minimal popup fallback with the same search functionality.

### Cross-Browser Strategy

- WXT generates platform-specific manifests from `wxt.config.ts`
- All browser APIs accessed through WXT's `browser` namespace (auto-polyfilled)
- Chrome-only features (e.g., tabGroups) gracefully hidden when unavailable
- CI pipeline builds and tests both Chrome and Firefox targets
- webextension-polyfill handles remaining API differences

### Permissions Required

| Permission | Reason |
|---|---|
| `tabs` | Access tab titles, URLs, favicons |
| `bookmarks` | Search bookmarks |
| `history` | Search browsing history |
| `storage` | Persist user settings |
| `commands` | Register keyboard shortcuts |
| `activeTab` | Execute actions on current tab |
| `sessions` | Access recently closed tabs via `chrome.sessions.getRecentlyClosed()` |

## 8. Success Criteria

- Works on Chrome, Brave, Edge (Chromium) and Firefox
- Overlay appears in under 50ms
- Search results in under 16ms
- Test coverage target: 100% for core logic (search, scoring, actions, messaging), 90%+ for UI components, best-effort for browser API integration layers
- Passes Chrome Web Store and Firefox Add-ons review
- Onboarding completes in under 60 seconds
- Zero impact on host page performance when inactive
