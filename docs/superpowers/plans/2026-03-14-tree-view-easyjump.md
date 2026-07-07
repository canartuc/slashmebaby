# Tree View with EasyJump Labels — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the command bar's limited smart-suggestions with a full tree view of all tabs and bookmarks, with vim-easyjump-style keyboard labels for instant navigation, and a `/` toggle between Jump Mode and Search Mode.

**Architecture:** New TreeView replaces ResultList. Two new message types (GET_ALL_TABS, GET_BOOKMARK_TREE) provide full data. Label assignment computed from visible items. Jump/Search mode managed in CommandBar. All keyboard handling via native DOM events (React synthetic events don't work in Shadow DOM).

**Tech Stack:** WXT, React 18, TypeScript, Fuse.js, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-14-tree-view-easyjump-design.md`

---

## Chunk 1: New Message Types & Background Handlers

### Task 1: Add GET_ALL_TABS and GET_BOOKMARK_TREE message types

**Files:**
- Modify: `src/lib/messaging.ts`
- Create: `src/__tests__/lib/messaging-tree.test.ts`

- [ ] **Step 1: Add new types to messaging.ts**

Add after existing message types:

```typescript
// Tree view messages
export interface GetAllTabsRequest { type: 'GET_ALL_TABS'; }

export interface TabWithGroup {
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
  muted: boolean;
  lastAccessed?: number;
}

export interface TabGroupInfo {
  label: string;
  type: 'window' | 'tabGroup';
  tabs: TabWithGroup[];
}

export interface GetAllTabsResponse { groups: TabGroupInfo[]; }

export interface GetBookmarkTreeRequest { type: 'GET_BOOKMARK_TREE'; }

export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  dateAdded?: number;
}

export interface GetBookmarkTreeResponse { tree: BookmarkNode[]; }
```

Add type guards:
```typescript
export function isGetAllTabsRequest(v: unknown): v is GetAllTabsRequest {
  return isObject(v) && v['type'] === 'GET_ALL_TABS';
}
export function isGetBookmarkTreeRequest(v: unknown): v is GetBookmarkTreeRequest {
  return isObject(v) && v['type'] === 'GET_BOOKMARK_TREE';
}
```

Update Message union to include new types.

- [ ] **Step 2: Write tests for new type guards**
- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** — `feat: add GET_ALL_TABS and GET_BOOKMARK_TREE message types`

### Task 2: Add background handlers for new messages

**Files:**
- Modify: `src/entrypoints/background/index.ts`
- Create: `src/__tests__/background/tree-handlers.test.ts`

- [ ] **Step 1: Add GET_ALL_TABS handler**

In the message router, add handler that:
- Calls `chrome.tabs.query({})` for all tabs
- Calls `chrome.tabGroups.query({})` for tab groups (wrapped in try/catch for Firefox)
- Calls `chrome.windows.getAll()` for window info
- Builds smart grouping: if tab groups exist → group by window then tab group. If multiple windows → by window. Else flat.
- Returns `GetAllTabsResponse`

- [ ] **Step 2: Add GET_BOOKMARK_TREE handler**

Add handler that calls `chrome.bookmarks.getTree()` and returns the full tree as `GetBookmarkTreeResponse`. Filter out empty root folders (like Mobile Bookmarks when empty).

- [ ] **Step 3: Write tests with mocked chrome APIs**
- [ ] **Step 4: Run ALL tests — expect PASS**
- [ ] **Step 5: Commit** — `feat: add background handlers for tab and bookmark tree data`

---

## Chunk 2: Label Assignment Engine

### Task 3: Create label assignment module

**Files:**
- Create: `src/lib/labels.ts`
- Create: `src/__tests__/lib/labels.test.ts`

- [ ] **Step 1: Implement label assignment**

```typescript
// Reserved action keys — never used for dynamic labels
const ACTION_KEYS = new Set('c x p m d w r t u z q s ,'.split(' '));

// Dynamic label pool in assignment order
const LABEL_POOL = 'a b e f g h i j k l n o v y 1 2 3 4 5 6 7 8 9 0'.split(' ');

export interface LabelAssignment {
  index: number;  // index in visible items array
  label: string;  // e.g. "a", "b", "ae"
}

export function assignLabels(visibleCount: number): LabelAssignment[] {
  const assignments: LabelAssignment[] = [];

  if (visibleCount <= LABEL_POOL.length) {
    // Single-char labels
    for (let i = 0; i < visibleCount; i++) {
      assignments.push({ index: i, label: LABEL_POOL[i] });
    }
  } else {
    // First 24 get single-char, rest get two-char
    for (let i = 0; i < LABEL_POOL.length && i < visibleCount; i++) {
      assignments.push({ index: i, label: LABEL_POOL[i] });
    }
    let idx = LABEL_POOL.length;
    for (const first of LABEL_POOL) {
      for (const second of LABEL_POOL) {
        if (idx >= visibleCount) break;
        assignments.push({ index: idx, label: first + second });
        idx++;
      }
      if (idx >= visibleCount) break;
    }
  }

  return assignments;
}

export function isActionKey(key: string): boolean {
  return ACTION_KEYS.has(key);
}

export function isDynamicLabelKey(key: string): boolean {
  return LABEL_POOL.includes(key) && !ACTION_KEYS.has(key);
}

export { ACTION_KEYS, LABEL_POOL };
```

- [ ] **Step 2: Write comprehensive tests**

Test: 5 items → 5 single labels, 24 items → all single, 25 items → 24 single + 1 double, 50 items, 0 items. Test `isActionKey` for all action keys. Test `isDynamicLabelKey`.

- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** — `feat: add label assignment engine for EasyJump`

---

## Chunk 3: Tree Data Hook & Tree Flattening

### Task 4: Create useTreeData hook

**Files:**
- Create: `src/hooks/useTreeData.ts`
- Create: `src/__tests__/hooks/useTreeData.test.tsx`

- [ ] **Step 1: Implement useTreeData**

The hook:
- On mount, sends GET_ALL_TABS and GET_BOOKMARK_TREE to background
- Manages expand/collapse state per node (Map<string, boolean>)
- Computes a flat array of visible items from the tree + expand state
- Each visible item has: `{ id, title, url?, icon?, type: 'tab'|'bookmark'|'folder'|'group', depth, isExpanded?, childCount?, parentId? }`
- Provides `toggleExpand(id)` function that updates expand state and recomputes flat list
- Provides `getParentId(id)` for ArrowLeft navigation
- Returns: `{ visibleItems, toggleExpand, getParentId, isLoading, tabGroups, bookmarkTree }`

All sections (tab groups, bookmark folders) collapsed by default.

- [ ] **Step 2: Write tests** — mock chrome.runtime.sendMessage, test flat list computation, expand/collapse, parent navigation
- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** — `feat: add useTreeData hook for tree flattening and expand/collapse`

### Task 5: Create useLabelAssignment hook

**Files:**
- Create: `src/hooks/useLabelAssignment.ts`
- Create: `src/__tests__/hooks/useLabelAssignment.test.tsx`

- [ ] **Step 1: Implement**

```typescript
function useLabelAssignment(visibleItems: TreeItem[]): {
  assignments: Map<string, number>; // label → item index
  getLabel: (index: number) => string;
  handleKeyPress: (key: string) => number | null; // returns item index or null
  pendingPrefix: string | null; // for two-char mode
  clearPending: () => void;
}
```

- Calls `assignLabels(visibleItems.length)` from labels.ts
- Manages two-char state: when first char pressed, store as `pendingPrefix`, wait for second
- `handleKeyPress` returns the target index if a full label is matched, null if partial or no match

- [ ] **Step 2: Write tests**
- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** — `feat: add useLabelAssignment hook`

---

## Chunk 4: Tree View Components

### Task 6: Create TreeItem component

**Files:**
- Create: `src/components/CommandBar/TreeItem.tsx`
- Create: `src/__tests__/components/TreeItem.test.tsx`

- [ ] **Step 1: Implement TreeItem**

Props: `{ item: TreeItem, label: string, isSelected: boolean, showFavicons: boolean, onSelect: () => void, searchMode: boolean }`

Renders:
- Label badge (monospace, accent color, dimmed in search mode)
- Indent based on `item.depth` (depth * 16px padding-left)
- Folder indicator `▸`/`▾` for folders/groups
- Favicon (if showFavicons && item.icon)
- Title
- Child count badge for folders `(12)`
- Keyboard hint `⏎` when selected
- `scrollIntoView({ block: 'nearest' })` when selected

CSS classes: `smb-tree-item`, `smb-tree-item--selected`, `smb-tree-item--folder`, `smb-label-badge`

- [ ] **Step 2: Write tests**
- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** — `feat: add TreeItem component with label badge`

### Task 7: Create TreeView component

**Files:**
- Create: `src/components/CommandBar/TreeView.tsx`
- Create: `src/__tests__/components/TreeView.test.tsx`

- [ ] **Step 1: Implement TreeView**

Props: `{ visibleItems, labels, selectedIndex, showFavicons, onSelectItem, searchMode, searchQuery }`

Renders section headers ("Open Tabs", "Bookmarks", "Actions") as non-selectable dividers. Renders TreeItem for each visible item. Renders action items at the bottom with fixed keys.

When `searchQuery` is non-empty, highlights matching text in titles.

Actions section always visible, separated by a divider line.

- [ ] **Step 2: Write tests**
- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** — `feat: add TreeView component`

### Task 8: Create LabelBadge component

**Files:**
- Create: `src/components/CommandBar/LabelBadge.tsx`

Simple component: renders the label string in a styled badge.
CSS: monospace, `var(--text-xs)`, `var(--color-accent)`, `var(--color-kbd-bg)` background, `var(--radius-sm)` border radius. In search mode: `opacity: 0.3`.

- [ ] **Step 1: Implement and test**
- [ ] **Step 2: Commit** — `feat: add LabelBadge component`

---

## Chunk 5: Integrate into CommandBar

### Task 9: Add tree view CSS

**Files:**
- Modify: `src/styles/command-bar.css`

- [ ] **Step 1: Add tree-specific styles**

```css
.smb-tree-item { /* same base as smb-result-item but with indent support */ }
.smb-tree-item--folder { /* folder styling */ }
.smb-label-badge { /* monospace, fixed-width, accent color */ }
.smb-label-badge--dimmed { opacity: 0.3; }
.smb-tree-indent { /* padding-left per depth level */ }
.smb-folder-indicator { /* ▸/▾ styling */ }
.smb-child-count { /* muted text badge */ }
.smb-action-divider { /* separator line above actions */ }
.smb-mode-indicator { /* /search placeholder styling */ }
.smb-empty-folder { /* "Empty" placeholder */ }
```

- [ ] **Step 2: Commit** — `style: add tree view and label badge CSS`

### Task 10: Rewrite CommandBar to use TreeView with Jump/Search modes

**Files:**
- Modify: `src/components/CommandBar/CommandBar.tsx`
- Modify: `src/components/CommandBar/SearchInput.tsx`
- Modify: `src/entrypoints/content/index.tsx`
- Modify: `src/__tests__/components/CommandBar.test.tsx`

This is the integration task — the largest and most critical.

- [ ] **Step 1: Add mode state to CommandBar**

```typescript
const [mode, setMode] = useState<'jump' | 'search'>('jump');
```

- [ ] **Step 2: Replace useSearch with useTreeData**

On mount, load tree data instead of smart suggestions. Use useTreeData for the visible items list.

- [ ] **Step 3: Add useLabelAssignment**

Compute labels from visible items. Pass to TreeView.

- [ ] **Step 4: Update keyboard handling**

In content/index.tsx document-level keydown listener:
- `/` toggles mode (focus/blur search input)
- In Jump Mode: label keys dispatch to items, action keys execute, arrows navigate
- In Search Mode: all keys go to search input except `/` (toggle) and `Escape` (close)
- Action keys (c,x,p,m,d,w,r,t,u,z,q,s,comma) ALWAYS execute their action regardless of mode

- [ ] **Step 5: Update SearchInput for mode awareness**

Props: add `mode: 'jump' | 'search'`. In jump mode: show `/` icon, "Press / to search" placeholder, NOT focused. In search mode: magnifying glass, "Type to search...", focused.

- [ ] **Step 6: Render TreeView instead of ResultList**

Replace `<ResultList>` with `<TreeView>` in CommandBar's render.

- [ ] **Step 7: Handle search filtering**

When in search mode with query: filter visible items client-side. Folders with matching descendants auto-expand. Use Fuse.js on the flat item list for fuzzy matching.

- [ ] **Step 8: Update tests**

Rewrite CommandBar tests to cover:
- Jump mode is default (labels visible, input not focused)
- `/` toggles to search mode
- Label key press in jump mode selects correct item
- Arrow keys navigate
- Enter expands/collapses folders
- ArrowRight expands, ArrowLeft collapses/goes to parent
- Action keys work in both modes
- Search filtering hides non-matching items
- Escape closes in both modes

- [ ] **Step 9: Run ALL tests — verify existing + new pass**
- [ ] **Step 10: Build and manually verify in Chrome**

```bash
npm run build
```

Load extension, open command bar, verify tree view appears with labels.

- [ ] **Step 11: Commit** — `feat: integrate tree view with Jump/Search modes into CommandBar`

---

## Chunk 6: E2E Tests & Feature Updates

### Task 11: Update FEATURES.md

**Files:**
- Modify: `FEATURES.md`

- [ ] **Step 1: Add new features**

Add to P0:
- F25: Tree View — Full tree of all tabs and bookmarks with expand/collapse
- F26: EasyJump Labels — Dynamic keyboard labels for instant navigation
- F27: Jump/Search Mode Toggle — `/` key toggles between jump and search modes
- F28: Smart Tab Grouping — Tabs grouped by window/tab group with nested display
- F29: Nested Bookmark Folders — Full bookmark tree with unlimited folder nesting

- [ ] **Step 2: Commit** — `docs: add tree view features to FEATURES.md`

### Task 12: E2E tests for tree view

**Files:**
- Create: `e2e/tree-view.spec.ts`

- [ ] **Step 1: Write E2E tests**

Using the existing `launchBrowserWithExtension` pattern:

1. **Tree view shows on open** — open command bar, verify tree items exist in shadow DOM
2. **Labels visible** — verify `.smb-label-badge` elements exist
3. **Folder expand/collapse** — press a folder's label, verify children appear
4. **Search mode toggle** — press `/`, verify input gets focus
5. **Search filters tree** — in search mode, type query, verify items filter
6. **Back to jump mode** — press `/` again, verify labels return
7. **Escape closes** — in both modes, verify close
8. **Action keys work** — press `t` (new tab), verify action executes

- [ ] **Step 2: Build and run E2E**

```bash
npm run build && npx playwright test e2e/tree-view.spec.ts
```

- [ ] **Step 3: Commit** — `test: add E2E tests for tree view and EasyJump labels`

### Task 13: Final verification

- [ ] **Step 1: Run ALL unit tests** — `npx vitest run` — ALL pass
- [ ] **Step 2: Run ALL E2E tests** — `npx playwright test` — ALL pass
- [ ] **Step 3: Build Chrome** — `npm run build` — success
- [ ] **Step 4: Build Firefox** — `npm run build:firefox` — success
- [ ] **Step 5: Push** — `git push`
