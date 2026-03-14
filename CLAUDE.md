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
- All browser APIs via WXT's `browser` namespace
- Typed messaging in src/lib/messaging.ts
- CSS scoped inside Shadow DOM only
- Conventional commits (feat:, fix:, test:, docs:, chore:)

## Testing
- Unit: npx vitest run
- E2E: npx playwright test
- Coverage: npx vitest run --coverage
