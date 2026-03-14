# SlashMeBaby — Tree View with EasyJump Labels

## 1. Overview

Replace the current limited smart-suggestions view with a full tree view showing ALL open tabs and ALL bookmarks (including nested folders). Each visible item gets a dynamic keyboard label for instant jump access, inspired by vim-easyjump. The `/` key toggles between Jump Mode (default) and Search Mode.

## 2. Two Modes

### Jump Mode (default on open)

- Search input is NOT focused
- Every visible item has a letter label displayed as a badge
- Pressing a label key instantly acts on that item (open tab, expand folder, execute action)
- Arrow keys still work for up/down navigation
- ArrowRight expands a selected folder. If item is not a folder, no-op.
- ArrowLeft collapses a selected expanded folder. If folder is already collapsed, selection moves to its parent folder. If already at root level, no-op.
- Enter on a selected item opens it (tab/bookmark) or toggles expand/collapse (folder)
- `/` switches to Search Mode
- `Escape` closes the command bar

### Search Mode (press `/` to enter)

- Search input gets focus, cursor appears
- Labels fade out (not removed, just dimmed)
- Typing filters the tree in place
- Folders with no matching descendants are hidden
- Folders with matching descendants stay visible (even if folder name doesn't match)
- Matching text is highlighted in results
- `/` switches back to Jump Mode (input blurs, labels return)
- `Escape` closes the command bar (not "exit search mode" — always closes)

## 3. Tree Structure

### Tabs Section

Smart grouping logic (evaluated in order):
1. If Chrome tab groups exist → group tabs by tab group name. Tabs NOT in any group appear under "Ungrouped" within their window.
2. Else if multiple windows → group by window ("Window 1", "Window 2")
3. Else → flat list under "Open Tabs" header (no collapsible group needed)

When both tab groups and multiple windows coexist: group by window first, then by tab group within each window. Ungrouped tabs appear under "Ungrouped" sub-section.

All groups/sections are **collapsed by default**. User expands what they need.

Shows ALL open tabs across all windows (no max limit).

**Edge case — 0 tabs:** The "Open Tabs" header is hidden entirely (no empty section shown).

### Bookmarks Section

Full bookmark tree from `chrome.bookmarks.getTree()`:
- Root folders (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks) as collapsible sections
- Sub-folders shown with `▸` (collapsed) or `▾` (expanded) indicators
- All folders **collapsed by default**
- Expanding a folder reveals its children (bookmarks and sub-folders)
- Unlimited nesting depth supported
- Each folder shows item count badge: `Development (12)`
- **Empty folders:** Shown with count `(0)`, expandable but display "Empty" placeholder when expanded
- **Empty root folders:** Hidden entirely (e.g., Mobile Bookmarks when empty on desktop)

### Actions Section

Fixed at the bottom. Always visible. Uses mnemonic keys (see Section 5).

## 4. Dynamic Label Assignment

Labels are assigned only to **currently visible** items (not hidden inside collapsed folders).

### Label Pool

Two pools — action keys are reserved and never used for dynamic labels:

**Reserved action keys:** `c x p m d w r t u z q s ,`

**Dynamic label pool (in assignment order):**
`a b e f g h i j k l n o v y 1 2 3 4 5 6 7 8 9 0`

24 single-character labels available. If more than 24 items are visible, use two-character combos from the same pool: `aa`, `ab`, `ae`, ...

### Assignment Rules

- Labels assigned top-to-bottom in visual order
- First visible item gets `a`, second gets `b`, third gets `e`, etc.
- When a folder expands/collapses, ALL labels re-assign to match the new visible set
- Section headers (e.g., "Open Tabs", "Bookmarks") do NOT get labels — only actionable items (tabs, bookmarks, folders)
- Pressing a folder's label key **toggles expand/collapse** (same as Enter on that folder)

### Two-Character Labels

When visible items exceed 24:
- Items 1-24 get single-character labels
- Items 25+ get two-character labels
- First char press narrows candidates (items with other first chars dim)
- Second char press completes the jump
- If only one candidate remains after first char, jump immediately
- Press `Escape` during two-char input to cancel and return to normal Jump Mode
- If no items match the first character, the keypress is ignored (no error state)

## 5. Fixed Action Keys

Actions always displayed at the bottom with mnemonic keys that never change:

| Key | Action | Condition |
|---|---|---|
| `c` | Close Tab | Always |
| `x` | Close Other Tabs | Always |
| `p` | Pin / Unpin Tab | Always |
| `m` | Mute / Unmute Tab | Always (shown if tab is audible OR muted) |
| `d` | Duplicate Tab | Always |
| `w` | Move to New Window | Always |
| `r` | Reload Tab | Always |
| `t` | New Tab | Always |
| `u` | Go to URL | Always (activates search with URL mode) |
| `z` | Recently Closed | Always |
| `q` | Close All Duplicates | Always |
| `s` | Sort by Domain | Always |
| `,` | Settings | Always |

Actions are separated visually from the tree by a divider line.

## 6. Search Filtering Behavior

When user types in Search Mode:

- Tree filters in place — items that don't match disappear
- A folder stays visible if ANY descendant (at any depth) matches
- Matching folders auto-expand to show matching children
- Match highlighting: matched characters shown in accent color
- Clearing the search input restores the full collapsed tree
- Tab groups/windows also filter — hidden if no tabs inside match
- Actions also filter by name match (e.g., typing "close" shows "Close Tab", "Close Other Tabs", "Close All Duplicates")
- In Search Mode, action keys remain fixed (pressing `c` still closes tab, NOT types "c" — action keys are always intercepted in both modes)
- The `>` prefix is no longer needed (actions are always visible at the bottom) but still works for backwards compatibility

## 7. Visual Design

### Label Badge

- Displayed to the left of each item, before the favicon
- Monospace font, fixed width (ensures alignment)
- Background: `var(--color-kbd-bg)`, border: `var(--color-border)`, rounded: `var(--radius-sm)`
- Font size: `var(--text-xs)` (10px)
- Color: `var(--color-accent)` for easy visibility
- In Search Mode: opacity reduced to 0.3

### Folder Indicators

- Collapsed: `▸` character before folder name
- Expanded: `▾` character before folder name
- Indentation: `var(--space-4)` (16px) per nesting level

### Section Headers

- "Open Tabs", "Bookmarks", "Actions" as uppercase muted headers (existing `smb-group-header` style)
- Not selectable, no labels

### Mode Indicator

- The search input area shows a `/` icon and dimmed placeholder "Press / to search" in Jump Mode
- In Search Mode: magnifying glass icon, focused input with cursor, placeholder "Type to search..."

### Item Count on Folders

- Muted text after folder name: `Development (12)`
- Shows total count of all descendants (not just direct children)

## 8. Keyboard Summary

### Jump Mode (default)

| Key | Action |
|---|---|
| Label key (a,b,e,f,...) | Jump to / open / expand that item |
| `↑ / ↓` | Move selection up/down |
| `→` | Expand selected folder/group |
| `←` | Collapse selected folder if expanded; move to parent if collapsed; no-op at root |
| `Enter` | Open selected item / toggle selected folder |
| `/` | Enter Search Mode |
| `Escape` | Close command bar |
| Action keys (c,x,p,m,...) | Execute action on current tab |

### Search Mode

| Key | Action |
|---|---|
| Any character | Type in search input |
| `/` | Exit to Jump Mode |
| `Escape` | Close command bar |
| `↑ / ↓` | Navigate filtered results |
| `Enter` | Open selected filtered item |

## 9. Data Flow

### On Command Bar Open

1. Content script sends `SMART_SUGGESTIONS` to background (existing)
2. Background returns ALL tabs (grouped) + root bookmark folders + actions
3. New message type: `GET_ALL_TABS` → returns all tabs with window/group info
4. New message type: `GET_BOOKMARK_TREE` → returns full bookmark tree
5. Content script renders the collapsed tree with labels

### On Folder Expand

1. If bookmark folder: children already in the tree data (loaded once on open)
2. Re-compute visible items → re-assign labels

### On Search

1. Same as current `SEARCH` message to background
2. Additionally: client-side filtering of the bookmark tree (already loaded)
3. Merge search results with tree filtering

## 10. New Message Types

```typescript
interface GetAllTabsRequest {
  type: 'GET_ALL_TABS';
}

interface TabWithGroup {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  windowId: number;
  groupId?: number;
  groupName?: string;
  groupColor?: string;
  pinned: boolean;
  audible: boolean;
  lastAccessed?: number;
}

interface TabGroup {
  label: string; // window name or tab group name
  type: 'window' | 'tabGroup';
  tabs: TabWithGroup[];
}

interface GetAllTabsResponse {
  groups: TabGroup[];
}

interface GetBookmarkTreeRequest {
  type: 'GET_BOOKMARK_TREE';
}

interface BookmarkNode {
  id: string;
  title: string;
  url?: string; // undefined for folders
  children?: BookmarkNode[];
  dateAdded?: number;
}

interface GetBookmarkTreeResponse {
  tree: BookmarkNode[];
}
```

## 11. Component Changes

### New Components

- `TreeView.tsx` — renders the full tree (tabs + bookmarks + actions)
- `TreeItem.tsx` — single item with label badge, indent, expand/collapse
- `LabelBadge.tsx` — the key label badge component
- `ModeIndicator.tsx` — shows "JUMP" or "SEARCH" mode

### Modified Components

- `CommandBar.tsx` — manages Jump/Search mode state, handles label key dispatch
- `SearchInput.tsx` — conditionally focused/blurred based on mode
- `ResultList.tsx` — removed. TreeView handles both default and search-filtered views. In Search Mode, TreeView filters in place rather than switching to a separate component.

### New Hooks

- `useTreeData.ts` — loads tabs + bookmarks on mount, manages expand/collapse state
- `useLabelAssignment.ts` — computes label assignments from visible items, handles key dispatch
- `useJumpMode.ts` — manages Jump/Search mode toggle, `/` key handling

## 12. Performance

- Bookmark tree loaded once on command bar open, cached in background service worker across opens (invalidated on `bookmarks.onChanged/Created/Removed` events)
- Tab data refreshed on each open (tabs change frequently)
- Label re-assignment is O(n) where n = visible items — fast even with 1000+ items
- Tree rendered from a flat array derived from the tree structure (computed on expand/collapse, stored in component state). No recursive rendering.
- Expand/collapse only recomputes the flat array for the affected subtree

## 13. Backwards Compatibility

- Search Mode behaves identically to the old command bar (type to search, arrow to navigate, Enter to open)
- All existing keyboard shortcuts preserved
- Action prefix `>` still works in Search Mode
- Settings, onboarding, popup unchanged
