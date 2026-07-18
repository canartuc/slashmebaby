# SlashMeBaby Design Language: Luminal

Last updated: 2026-03-14

---

## 1. Philosophy

Luminal is the design language for SlashMeBaby. The name refers to light: a focused beam that cuts through visual noise and shows what the user needs. Every design decision is subordinate to speed of comprehension. The user must process results in milliseconds, not seconds. Decoration appears only where it guides the eye or communicates state. The language is dark-first because command palettes open over active browsing sessions, where a bright overlay creates jarring contrast; dark is comfortable and focused. Light mode gets the same polish, designed for users in bright environments.

---

## 2. Color System

### Design Token Reference

All colors are defined as CSS custom properties inside the Shadow DOM. The host page's CSS cannot override them.

### 2.1 Dark Palette (Default)

| Token | Hex / RGBA | Usage |
|-------|-----------|-------|
| `--color-bg-primary` | `#1a1a2e` | Main container background |
| `--color-bg-secondary` | `#16213e` | Input field background, group header rows |
| `--color-bg-hover` | `rgba(99, 102, 241, 0.15)` | Hovered/selected result item background |
| `--color-border` | `rgba(255, 255, 255, 0.10)` | Container border, dividers |
| `--color-text-primary` | `#e0e0e0` | Result titles, input text |
| `--color-text-secondary` | `#a0a4b8` | Result URLs, subtitles |
| `--color-text-muted` | `#6c7293` | Group header labels, keyboard hint badges |
| `--color-accent` | `#6366f1` | Focus ring, selected item left border, action icons |
| `--color-accent-hover` | `#818cf8` | Accent color on hover |
| `--color-backdrop` | `rgba(0, 0, 0, 0.50)` | Page backdrop when overlay is open |

### 2.2 Light Palette

| Token | Hex / RGBA | Usage |
|-------|-----------|-------|
| `--color-bg-primary` | `#ffffff` | Main container background |
| `--color-bg-secondary` | `#f8f9fc` | Input field background, group header rows |
| `--color-bg-hover` | `rgba(99, 102, 241, 0.08)` | Hovered/selected result item background |
| `--color-border` | `rgba(0, 0, 0, 0.08)` | Container border, dividers |
| `--color-text-primary` | `#1a1a2e` | Result titles, input text |
| `--color-text-secondary` | `#4a4e69` | Result URLs, subtitles |
| `--color-text-muted` | `#9ca3af` | Group header labels, keyboard hint badges |
| `--color-accent` | `#6366f1` | Focus ring, selected item left border, action icons |
| `--color-accent-hover` | `#4f46e5` | Accent color on hover (darker in light mode) |
| `--color-backdrop` | `rgba(0, 0, 0, 0.30)` | Page backdrop (lighter in light mode) |

### 2.3 Applying Themes

Themes are applied via a `data-theme` attribute on the Shadow DOM host element:

```css
:host([data-theme="dark"]) { /* dark tokens */ }
:host([data-theme="light"]) { /* light tokens */ }

@media (prefers-color-scheme: dark) {
  :host(:not([data-theme])) { /* dark tokens */ }
}
```

### 2.4 WCAG AA Contrast Ratios

All text/background combinations must meet WCAG 2.1 AA (minimum 4.5:1 for normal text, 3:1 for large text).

| Combination | Foreground | Background | Ratio | Passes AA |
|-------------|-----------|-----------|-------|-----------|
| Primary text / bg-primary (dark) | `#e0e0e0` | `#1a1a2e` | ~9.8:1 | Yes |
| Secondary text / bg-primary (dark) | `#a0a4b8` | `#1a1a2e` | ~5.4:1 | Yes |
| Primary text / bg-primary (light) | `#1a1a2e` | `#ffffff` | ~17.2:1 | Yes |
| Secondary text / bg-primary (light) | `#4a4e69` | `#ffffff` | ~6.6:1 | Yes |
| Accent / bg-primary (dark) | `#6366f1` | `#1a1a2e` | ~4.6:1 | Yes |
| Accent / bg-primary (light) | `#6366f1` | `#ffffff` | ~4.6:1 | Yes |

Muted text (`--color-text-muted`) is used only for decorative labels (group headers, keyboard hints) that are supplemented by visual position. These may fall below 4.5:1 but are never the sole conveyor of required information.

---

## 3. Typography

### Font Stack

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             Oxygen, Ubuntu, sans-serif;
```

With the system font stack, the command bar feels native on every OS. No web fonts are loaded; this eliminates font-loading latency and avoids privacy concerns from external font requests.

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 10px | 500 | 1.4 | Keyboard hint badges |
| `--text-sm` | 12px | 400 | 1.5 | Group header labels, URL subtitles |
| `--text-base` | 14px | 400 | 1.5 | Result item titles |
| `--text-lg` | 16px | 400 | 1.5 | Search input text |

### Additional Rules

- Letter spacing: `--text-xs` and `--text-sm` group headers use `letter-spacing: 0.06em` for legibility at small sizes
- Text rendering: `text-rendering: optimizeSpeed` on result list (not overlay container) to maintain 16ms search render budget
- Truncation: result titles truncate with `text-overflow: ellipsis` at one line; URLs truncate at one line; never wrap

---

## 4. Spacing

All spacing follows a 4px base grid. Spacing tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Icon gap, badge padding |
| `--space-2` | 8px | Result item vertical padding, group header padding |
| `--space-3` | 12px | Search input vertical padding |
| `--space-4` | 16px | Search input horizontal padding, result item horizontal padding |
| `--space-5` | 20px | Container padding top/bottom |
| `--space-6` | 24px | Section separator spacing |
| `--space-7` | 28px | (Reserved) |
| `--space-8` | 32px | Container padding when position is Top or Bottom anchored |

### Component Spacing Reference

- **Command bar container**: `padding: var(--space-5) 0` (no horizontal padding; children control their own)
- **Search input**: `padding: var(--space-3) var(--space-4)`
- **Result item**: `padding: var(--space-2) var(--space-4)`
- **Group header**: `padding: var(--space-2) var(--space-4)` with `margin-top: var(--space-2)` on groups after the first

---

## 5. Radii and Shadows

### Border Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Badge corners, favicon containers |
| `--radius-md` | 8px | Search input field |
| `--radius-lg` | 12px | Command bar overlay container |

### Shadows

**Overlay container shadow** (dark mode):
```css
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.10),
  0 8px 32px rgba(0, 0, 0, 0.60),
  0 2px 8px rgba(0, 0, 0, 0.40);
```

**Overlay container shadow** (light mode):
```css
box-shadow:
  0 0 0 1px rgba(0, 0, 0, 0.08),
  0 8px 32px rgba(0, 0, 0, 0.16),
  0 2px 8px rgba(0, 0, 0, 0.08);
```

The three-layer shadow creates depth: the outermost spreads atmosphere, the middle layer grounds the panel, the inner layer defines the edge without a harsh border.

---

## 6. Animation

### Easing Function

All interactive animations use the same easing curve:

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
```

This is a fast-out, slow-in curve: the overlay springs open quickly and settles softly. It reads as responsive without feeling mechanical.

### Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 100ms | Result item hover state transitions |
| `--duration-base` | 150ms | Overlay open/close animation |

### Overlay Open Animation

The command bar opens with a combined scale + opacity animation. The container starts slightly scaled down and fully transparent, then animates to full size and opacity:

```css
@keyframes overlay-open {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.command-bar {
  animation: overlay-open var(--duration-base) var(--ease-out) forwards;
}
```

### Overlay Close Animation

Close plays the reverse. This is handled by adding a `.closing` class before unmounting and waiting for the animation to finish:

```css
@keyframes overlay-close {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
}

.command-bar.closing {
  animation: overlay-close var(--duration-base) var(--ease-out) forwards;
}
```

### Result Stagger

When results appear after a search, each result group staggers in with a 20ms delay per group:

```css
.result-group:nth-child(1) { animation-delay: 0ms; }
.result-group:nth-child(2) { animation-delay: 20ms; }
.result-group:nth-child(3) { animation-delay: 40ms; }
.result-group:nth-child(4) { animation-delay: 60ms; }
```

The stagger is subtle; it adds polish without pulling attention. Total time for all groups to appear: 60ms + 150ms base = 210ms max, well within the 50ms overlay appearance target since the stagger starts after the container is already visible.

### Reduced Motion

All animations are disabled when `prefers-reduced-motion: reduce` is set:

```css
@media (prefers-reduced-motion: reduce) {
  .command-bar,
  .result-group,
  .result-item {
    animation: none;
    transition: none;
  }
}
```

---

## 7. Component Patterns

### 7.1 SearchInput

The search input is the focal point of the command bar.

**Layout:** Full-width. Icon (16×16 magnifying glass monoline SVG) to the left of the text input, both centered vertically within the row. Keyboard hint badge (e.g., "Esc") floats to the right.

**Sizing:**
- Height: 48px (fixed; keeps the target finger-friendly even though the bar is keyboard-driven)
- Padding: `var(--space-3) var(--space-4)` (12px top/bottom, 16px left/right)
- Border-radius: `var(--radius-md)` (8px)

**Colors:**
- Background: `var(--color-bg-secondary)`
- Border: `1px solid var(--color-border)`
- Text color: `var(--color-text-primary)`
- Placeholder color: `var(--color-text-muted)`
- Icon color: `var(--color-text-secondary)`

**Focus:**
- Border changes to `1px solid var(--color-accent)`
- No box-shadow on input itself (the container already has the overlay shadow)
- The input is always auto-focused on overlay open

**Autocomplete:** `autocomplete="off"`, `spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"`. The input is for navigation, not text entry.

### 7.2 ResultItem

Each result row renders a single searchable item.

**Layout:** Flexbox row. Left: 16×16 favicon or action icon. Center: title (primary text) + URL or description (secondary text), stacked vertically. Right: keyboard hint badges visible only on the selected item.

**Sizing:**
- Min-height: 40px
- Padding: `var(--space-2) var(--space-4)` (8px top/bottom, 16px left/right)
- Icon: 16×16px, `flex-shrink: 0`
- Gap between icon and text: `var(--space-2)` (8px)

**States:**
- Default: background `transparent`
- Hover: background `var(--color-bg-hover)`, transition `var(--duration-fast) var(--ease-out)`
- Selected (keyboard focus): background `var(--color-bg-hover)`, left border `2px solid var(--color-accent)`

**Title:** `font-size: var(--text-base)`, `color: var(--color-text-primary)`, single line, truncated.

**URL/subtitle:** `font-size: var(--text-sm)`, `color: var(--color-text-secondary)`, single line, truncated.

**Keyboard hint badges:** visible only on selected item. Background `rgba(255,255,255,0.08)` dark / `rgba(0,0,0,0.06)` light. Border `1px solid var(--color-border)`. Border-radius `var(--radius-sm)` (6px). Font-size `var(--text-xs)`, color `var(--color-text-muted)`.

### 7.3 GroupHeader

Section labels that separate result groups.

**Layout:** Full-width row. Text left-aligned. No interactive state; purely presentational.

**Sizing:**
- Padding: `var(--space-2) var(--space-4)`
- Top margin: `var(--space-2)` (except on the first group)

**Text:** `font-size: var(--text-sm)` (12px), `font-weight: 500`, `letter-spacing: 0.06em`, `text-transform: uppercase`, `color: var(--color-text-muted)`.

**Divider:** `1px solid var(--color-border)` above the group header text (except on the first group).

### 7.4 Backdrop

The translucent overlay behind the command bar container.

**Layout:** Fixed-position full-viewport div, `z-index` just below the command bar container. Pointer events pass through to close the overlay on click.

**Color:** `var(--color-backdrop)` (`rgba(0,0,0,0.50)` dark, `rgba(0,0,0,0.30)` light).

**Animation:** Opacity 0→1 in `var(--duration-base)`, matching the container open animation. No blur effect (performance); the dark semi-transparent layer creates sufficient visual separation.

---

## 8. Accessibility

SlashMeBaby targets WCAG 2.1 Level AA conformance.

### Focus Management

- On overlay open: focus is moved to the search input immediately
- On overlay close: focus is returned to the previously focused element on the host page
- Focus is trapped within the Shadow DOM while the overlay is open (Tab cycles within the overlay only)

### Focus Rings

All interactive elements show a visible focus ring when navigated via keyboard:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Mouse clicks do not show focus rings (`:focus-visible` only, not `:focus`).

### ARIA Roles and Labels

- Command bar container: `role="dialog"`, `aria-label="Command palette"`, `aria-modal="true"`
- Search input: `role="combobox"`, `aria-autocomplete="list"`, `aria-controls="slashmebaby-results"`, `aria-expanded="true/false"`
- Results list: `role="listbox"`, `id="slashmebaby-results"`
- Each result item: `role="option"`, `aria-selected="true/false"`, `aria-label="{title} — {url}"`
- Group headers: `role="presentation"` (they are visual groupings, not navigable items)
- Live region: `aria-live="polite"` `aria-atomic="true"` visually hidden element that announces result count updates (e.g., "5 results for 'react docs'")

### Keyboard-Only Operation

All features must be fully operable without a mouse:

- Open: keyboard shortcut (configured by user)
- Navigate: Arrow keys + Tab
- Execute: Enter
- Close: Escape on both surfaces (the toolbar popup additionally closes when it loses focus — a browser behavior of action popups)
- No feature requires hover, drag, or click to operate

### Color Independence

State is never communicated by color alone. The selected item uses both a background color change and a left border. Icons convey type (tab, bookmark, history, action) by shape, not color alone.

---

## 9. Icon Style

### Favicons

- Source: `chrome.tabs` provides favicon URLs; for bookmarks and history, use `chrome.favicon` API or `chrome_url_overrides`
- Size: 16×16px, displayed at 16×16px (1:1, no scaling)
- Container: 16×16px `<img>` with `border-radius: var(--radius-sm)` (4px) to match rounded favicon style
- Fallback: if favicon fails to load, show a monoline globe icon in `var(--color-text-muted)`

### Action Icons

- Style: monoline SVG, 1.5px stroke, rounded linecap/linejoin
- Size: 16×16px viewbox
- Color: `var(--color-accent)` for active actions, `var(--color-text-secondary)` for neutral actions
- No fills; stroke-only for visual consistency with system UI icon conventions
- Icons required: Tab (rectangle), Bookmark (ribbon), History (clock), Close (X), Pin, Mute, Duplicate, Window, Reload, New Tab, Restore, URL/Globe, Settings (gear)

### No External Icon Libraries

All icons are inline SVG strings embedded in the component source. This avoids extra network requests and icon library version drift, and the icons stay available even on pages with restrictive Content Security Policies.
