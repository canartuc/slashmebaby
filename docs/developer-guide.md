# SlashMeBaby Developer Guide

## Prerequisites

- **Node.js** 24 or higher (see `engines` in `package.json`)
- **npm** (the version bundled with Node.js 24 is fine)
- A Chromium-based browser (Chrome, Edge, Brave) or Firefox for testing

## Getting Started

```bash
# Clone the repository
git clone https://github.com/canartuc/slashmebaby.git
cd slashmebaby

# Install dependencies
npm install

# Start the development server (Chrome)
npm run dev

# Or start for Firefox
npm run dev:firefox
```

The dev server launches a browser instance with the extension side-loaded and enables hot module replacement. Changes to source files are reflected immediately.

## Project Structure

```
slashmebaby/
├── src/
│   ├── entrypoints/          # WXT entrypoints (discovered by srcDir config)
│   │   ├── background/       # Service worker: caches, actions, message router
│   │   │   ├── index.ts      # Message router + WXT entrypoint
│   │   │   ├── tabs.ts       # TabCache class
│   │   │   ├── bookmarks.ts  # BookmarkCache class
│   │   │   ├── history.ts    # HistoryCache class
│   │   │   └── actions.ts    # ActionRegistry class
│   │   ├── content/          # Content script: Shadow DOM overlay
│   │   │   ├── index.tsx     # Shadow DOM mount + toggle listener
│   │   │   └── App.tsx       # Root React component
│   │   ├── popup/            # Browser action popup fallback
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── Popup.tsx
│   │   ├── settings/         # Extension settings page
│   │   │   ├── index.html
│   │   │   └── main.tsx
│   │   └── onboarding/       # First-run onboarding wizard
│   │       ├── index.html
│   │       └── main.tsx
│   ├── components/           # Shared React components
│   │   ├── CommandBar/       # Search input, result list, group headers
│   │   ├── Settings/         # Settings page sub-components
│   │   └── Onboarding/       # Onboarding wizard step components
│   ├── hooks/                # Custom React hooks
│   │   ├── useKeyboard.ts    # Keyboard navigation
│   │   ├── useSearch.ts      # Search messaging bridge
│   │   ├── useSettings.ts    # Settings load/save
│   │   └── useTheme.ts       # System/light/dark theme resolution
│   ├── lib/                  # Pure logic libraries (no React)
│   │   ├── messaging.ts      # Message types, type guards, UserSettings
│   │   ├── search.ts         # Fuse.js search engine, scoring formulas
│   │   └── storage.ts        # chrome.storage wrappers
│   ├── styles/               # CSS stylesheets
│   │   ├── command-bar.css   # Command bar overlay styles
│   │   ├── popup.css         # Popup fallback styles
│   │   ├── settings.css      # Settings page styles
│   │   └── onboarding.css    # Onboarding wizard styles
│   └── __tests__/            # Unit tests (mirrors src structure)
│       ├── setup.ts          # Test setup: chrome API stubs
│       ├── lib/              # Tests for src/lib/
│       ├── background/       # Tests for background service worker
│       ├── components/       # Tests for React components
│       └── hooks/            # Tests for custom hooks
├── e2e/                      # Playwright E2E tests
│   ├── helpers.ts            # Extension ID discovery helper
│   └── extension.spec.ts     # E2E test suite
├── wxt.config.ts             # WXT build configuration
├── vitest.config.ts          # Vitest test configuration
├── playwright.config.ts      # Playwright E2E configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Chrome, hot reload) |
| `npm run dev:firefox` | Start dev server (Firefox, hot reload) |
| `npm run build` | Production build for Chrome MV3 |
| `npm run build:firefox` | Production build for Firefox MV2 |
| `npm run pack` | Build and zip for Chrome Web Store |
| `npm run pack:firefox` | Build and zip for Firefox Add-ons |
| `npx vitest run` | Run all unit tests |
| `npx vitest run --coverage` | Run tests with coverage report |
| `npx playwright test` | Run E2E tests (requires build first) |
| `npm run compile` | TypeScript type-check only |

## Adding a New Action

Actions are defined in `src/entrypoints/background/actions.ts`.

1. Add a new entry to the `ACTION_DEFINITIONS` array:

```typescript
{ id: 'my-action', title: 'My New Action', description: 'Does something useful' },
```

2. Add a case to the `execute()` switch statement:

```typescript
case 'my-action':
  return await this.myAction(targetTabId!);
```

3. Implement the private method:

```typescript
private myAction(tabId: number): Promise<ExecuteActionResponse> {
  return new Promise((resolve) => {
    // Use chrome.tabs or other APIs
    resolve({ success: true });
  });
}
```

4. Add tests in `src/__tests__/background/actions.test.ts`.

## Adding a New Data Source

To add a new searchable data source (e.g., reading list, downloads):

1. Create a cache class in `src/entrypoints/background/` following the pattern of `TabCache`, `BookmarkCache`, or `HistoryCache`.

2. The cache must implement:
   - `refresh(): Promise<void>` fetches data from the browser API
   - `getItems(): SearchableItem[]` returns cached items

3. Register the cache in `src/entrypoints/background/index.ts`:
   - Instantiate it in `createMessageRouter()`
   - Add it to the `Promise.all([...])` initialization
   - Include items in the SEARCH handler

4. Add the new source category to `Source` type in `src/lib/messaging.ts`.

5. Add a half-life constant in `src/lib/search.ts` under `HALF_LIFE_BY_CATEGORY`.

## Testing Guide

### Unit Tests (Vitest)

Tests live in `src/__tests__/` and mirror the source structure. The test setup in `setup.ts` provides:

- Chrome API stubs (`chrome.tabs`, `chrome.bookmarks`, etc.)
- WXT global stubs (`defineBackground`, `defineContentScript`)
- jsdom environment for React component testing

Run specific test files:

```bash
npx vitest run src/__tests__/lib/search.test.ts
npx vitest run --watch   # Watch mode for development
```

### E2E Tests (Playwright)

E2E tests require a built extension:

```bash
npm run build
npx playwright test
```

Tests load the extension in Chromium and verify pages render correctly. The helper in `e2e/helpers.ts` discovers the extension ID from the service worker URL.

## Building for Production

```bash
# Chrome
npm run build
# Output: .output/chrome-mv3/

# Firefox
npm run build:firefox
# Output: .output/firefox-mv2/
```

## Loading the Extension

### Chrome / Chromium

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `.output/chrome-mv3/` directory

### Firefox

1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file inside `.output/firefox-mv2/`
