# SlashMeBaby API Reference

This document describes the internal messaging protocol, storage schemas, and core data structures used by SlashMeBaby. All types are defined in TypeScript.

## Messaging Protocol

All communication between the content script (or popup/settings pages) and the background service worker uses `chrome.runtime.sendMessage`. Messages are typed and validated with type guards.

### Message Types

```typescript
type Message =
  | SearchRequest
  | SmartSuggestionsRequest
  | ExecuteActionRequest
  | GetSettingsRequest
  | ToggleOverlayCommand;
```

### Content -> Background Messages

#### SearchRequest

Sent when the user types a query in the command bar.

```typescript
interface SearchRequest {
  type: 'SEARCH';
  payload: {
    query: string;
    sources: Source[];  // ['tabs', 'bookmarks', 'history', 'actions']
  };
}
```

**Response:**

```typescript
interface SearchResponse {
  groups: ResultGroup[];
}
```

#### SmartSuggestionsRequest

Sent on mount when the search input is empty to populate the default view.

```typescript
interface SmartSuggestionsRequest {
  type: 'SMART_SUGGESTIONS';
}
```

**Response:** Same `SearchResponse` shape. Returns 3 recent tabs, 2 bookmarks, and 2 actions.

#### ExecuteActionRequest

Sent when the user selects a result item or action.

```typescript
interface ExecuteActionRequest {
  type: 'EXECUTE_ACTION';
  payload: {
    actionId: string;
    targetTabId?: number;
  };
}
```

**Response:**

```typescript
interface ExecuteActionResponse {
  success: boolean;
  error?: string;
}
```

#### GetSettingsRequest

Sent on mount to retrieve the current user settings.

```typescript
interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}
```

**Response:**

```typescript
interface GetSettingsResponse {
  settings: UserSettings;
}
```

### Background -> Content Messages

#### ToggleOverlayCommand

Sent by the background service worker to the active tab's content script when the keyboard shortcut is pressed.

```typescript
interface ToggleOverlayCommand {
  type: 'TOGGLE_OVERLAY';
}
```

No response expected.

### Type Guards

The following type guard functions are exported from `src/lib/messaging.ts`:

| Function | Matches |
|----------|---------|
| `isSearchRequest(value)` | `SearchRequest` |
| `isExecuteActionRequest(value)` | `ExecuteActionRequest` |
| `isToggleOverlayCommand(value)` | `ToggleOverlayCommand` |
| `isSmartSuggestionsRequest(value)` | `SmartSuggestionsRequest` |
| `isGetSettingsRequest(value)` | `GetSettingsRequest` |

Each guard checks that the value is a non-null object with the expected `type` field.

## Storage Schemas

### UserSettings

Stored in `chrome.storage.sync` under the key `"settings"`.

```typescript
interface UserSettings {
  shortcut: string;                    // e.g. 'Ctrl+Shift+Space'
  position: 'center' | 'top' | 'bottom';
  theme: 'system' | 'light' | 'dark';
  maxResultsPerGroup: number;          // default: 5
  showFavicons: boolean;               // default: true
  searchSources: {
    tabs: boolean;                     // default: true
    bookmarks: boolean;                // default: true
    history: boolean;                  // default: true
  };
}
```

**Default values:**

```typescript
const DEFAULT_SETTINGS: UserSettings = {
  shortcut: isMac ? 'Command+Shift+Space' : 'Ctrl+Shift+Space',
  position: 'center',
  theme: 'system',
  maxResultsPerGroup: 5,
  showFavicons: true,
  searchSources: { tabs: true, bookmarks: true, history: true },
};
```

### OnboardingState

Stored in `chrome.storage.local` under the key `"onboarding"`.

```typescript
interface OnboardingState {
  completedStep: number;   // 0-4, which step the user has completed
  completed: boolean;      // true when all steps are done
}
```

## Core Data Structures

### Source

```typescript
type Source = 'tabs' | 'bookmarks' | 'history' | 'actions';
```

Category identifier used throughout the application for grouping and filtering.

### SearchableItem

The unified type for items fed into the search engine. All data sources (tabs, bookmarks, history, actions) convert their raw data into this shape before indexing.

```typescript
interface SearchableItem {
  id: string;              // Prefixed: 'tab-123', 'bookmark-456', 'action-close-tab'
  title: string;           // Display title
  url?: string;            // URL (absent for actions)
  category: Source;        // Which group this item belongs to
  timestamp?: number;      // Unix ms timestamp for recency scoring
  icon?: string;           // Favicon URL (tabs only)
}
```

### SearchResultItem

The output type returned to the UI after scoring and ranking.

```typescript
interface SearchResultItem {
  id: string;
  title: string;
  url?: string;
  icon?: string;
  score: number;           // 0-1, higher is better
}
```

### ResultGroup

A group of results for a single category, as returned by the search engine.

```typescript
interface ResultGroup {
  category: Source;
  items: SearchResultItem[];
}
```

## Action IDs

Actions are registered in `src/entrypoints/background/actions.ts`. Each action has a unique ID used in `ExecuteActionRequest.payload.actionId`.

| Action ID | Title | Description |
|-----------|-------|-------------|
| `close-tab` | Close Tab | Close the current tab |
| `close-other-tabs` | Close Other Tabs | Close all tabs except current (preserves pinned) |
| `pin-tab` | Pin Tab | Toggle pin state |
| `mute-tab` | Mute Tab | Toggle mute state |
| `duplicate-tab` | Duplicate Tab | Duplicate the current tab |
| `move-to-window` | Move to New Window | Move tab to a new window |
| `reload-tab` | Reload Tab | Reload the current tab |
| `new-tab` | New Tab | Open a new blank tab |
| `go-to-url` | Go to URL | Navigate to a URL (handled by UI) |
| `recently-closed` | Recently Closed | Restore the most recently closed tab (or undo the last palette tab action) |
| `close-duplicates` | Close Duplicate Tabs | Close tabs with identical URLs |
| `sort-by-domain` | Sort Tabs by Domain | Sort tabs alphabetically by domain |
| `settings` | Open Settings | Open extension settings page |

When sent via `ExecuteActionRequest`, action IDs are prefixed with `action-` (e.g., `action-close-tab`). The background router strips this prefix before dispatching to the `ActionRegistry`.

## Scoring Algorithm

### Recency Score

Exponential decay based on age and category-specific half-lives:

```typescript
function computeRecencyScore(timestamp: number | undefined, halfLifeHours: number): number {
  if (timestamp === undefined || halfLifeHours === 0) return 0;
  const ageInHours = (Date.now() - timestamp) / (60 * 60 * 1000);
  return Math.exp((-Math.LN2 * ageInHours) / halfLifeHours);
}
```

| Category | Half-Life |
|----------|-----------|
| Tabs | 2 hours |
| Bookmarks | 168 hours (1 week) |
| History | 24 hours |
| Actions | 0 (no recency) |

### Final Score

Combines fuzzy match quality with recency using a 60/40 weighting:

```typescript
function computeFinalScore(fuseScore: number, recencyScore: number): number {
  return (1 - fuseScore) * 0.6 + recencyScore * 0.4;
}
```

Where `fuseScore` is the Fuse.js score (0 = perfect match, 1 = no match).

## Search Engine Configuration

Fuse.js is configured with these options:

| Option | Value | Description |
|--------|-------|-------------|
| `keys` | `['title', 'url']` | Fields to search |
| `threshold` | `0.4` | Match sensitivity (0 = exact, 1 = anything) |
| `distance` | `100` | Max distance for a match from the expected position |
| `includeScore` | `true` | Return match scores for blending |
| `includeMatches` | `true` | Return match positions |

Results are grouped in fixed order (Tabs, Bookmarks, History, Actions), capped at `maxResultsPerGroup` per group.
