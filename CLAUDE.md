# CLAUDE.md

## Project
SlashMeBaby — Cross-browser command palette extension (Chrome + Firefox).

## Tech Stack
WXT + React 18 + TypeScript (strict) + Fuse.js + Vitest + Playwright

## Key Files
- FEATURES.md, DESIGN.md, ARCHITECTURE.md, CONTEXT.md, PLAN.md
- wxt.config.ts, src/entrypoints/background/, src/entrypoints/content/
- src/components/CommandBar/, src/lib/

## Conventions
- TDD: Write failing test first, then implement
- Browser APIs called directly via `chrome.*` (Firefox supports the `chrome` namespace; Chrome-only APIs like `chrome.tabGroups` are feature-detected at runtime)
- Typed messaging in src/lib/messaging.ts
- CSS scoped inside Shadow DOM only
- Conventional commits (feat:, fix:, test:, docs:, chore:)

## Git workflow
- Commit locally as freely as you like
- Ask approval before pushing to remote or opening a PR
- After PR approval, run `npm run pack` and copy the built zip from `.output/` to `$HOME/Downloads/`, overwriting any existing file of the same name, so the user can load it into Chrome for manual testing

## Testing
- Unit: npx vitest run
- E2E: npx playwright test
- Coverage: npx vitest run --coverage
