# Contributing to SlashMeBaby

Bug reports, feature requests, and pull requests are all welcome. This file covers the mechanics; [docs/developer-guide.md](docs/developer-guide.md) has the deeper architecture walkthrough.

## Development setup

Requires Node.js 24 or later (see `.nvmrc`).

```bash
git clone https://github.com/canartuc/slashmebaby.git
cd slashmebaby
npm install
npm run dev          # Chrome dev server with the extension side-loaded
npm run dev:firefox  # same, for Firefox
```

## How to contribute

1. Open an issue first for anything non-trivial, so we can agree on the approach before you write code.
2. Fork the repo and create a branch off `main`.
3. Make your change, following the conventions below.
4. Open a pull request against `main`. Fill in the PR template, including the AI-assistance disclosure (see [AI_CONTRIBUTIONS.md](AI_CONTRIBUTIONS.md)).

## Quality gates

CI runs these on every PR, and they all have to pass. Run them locally first:

```bash
npx tsc --noEmit               # type-check (strict mode, no errors)
npm run lint                   # ESLint, zero warnings allowed
npx vitest run                 # unit tests
npx playwright test            # end-to-end tests (Chromium)
npx vitest run --coverage      # coverage thresholds
```

Coverage is enforced by the thresholds in `vitest.config.ts`: **100% statement coverage** on `src/lib/` and `src/entrypoints/background/`, plus branch/function thresholds (see the config). `npx vitest run --coverage` fails if your change drops below them. Code in those directories ships without a UI in front of it, so it gets the strictest treatment.

CI also runs `npm audit --audit-level=high` and builds both the Chrome MV3 and Firefox MV2 bundles.

## Tests first (TDD)

This project is developed test-first: write a failing test that describes the behavior, watch it fail, then implement until it passes. This is a repo convention (see [CLAUDE.md](CLAUDE.md)), not a suggestion. PRs that add behavior without tests will be sent back.

- Unit tests live in `src/__tests__/`, mirroring the source layout.
- E2E tests live in `e2e/` and run against the built extension in a real Chromium.

## Commit format

Conventional commits:

```
feat: add sort-tabs-by-domain action
fix: close palette on Escape when input is empty
test: cover favicon cache eviction
docs: clarify Firefox install steps
chore: bump wxt
```

The PR title should follow the same format, since PRs are squash-merged.

## Code style

Facts about how this codebase works. Match them:

- **Browser APIs** are called directly through the `chrome.*` namespace (typed by `@types/chrome`). WXT handles the cross-browser builds (Chrome MV3, Firefox MV2); don't add polyfills or `browser.*` shims.
- **Messaging is typed.** Every message between content/popup and the background worker has an interface and a runtime type guard in `src/lib/messaging.ts`, and is routed in `src/entrypoints/background/index.ts`. New message types need both.
- **Content-UI CSS lives inside the Shadow DOM.** The overlay mounts into a shadow root created in `src/entrypoints/content/index.tsx`; all its styles are injected there. Never style the host page.
- TypeScript strict mode is on; don't weaken it with `any` or `@ts-ignore`.

## Where things live

```
src/entrypoints/background/   service worker: caches, actions, message router, favicon proxy
src/entrypoints/content/      Shadow DOM overlay injected into pages
src/entrypoints/popup/        toolbar popup fallback
src/entrypoints/settings/     settings page
src/entrypoints/onboarding/   first-run tutorial
src/components/               shared React components (CommandBar, Settings, Onboarding)
src/hooks/                    React hooks (keyboard nav, search bridge, settings)
src/lib/                      pure logic: search, messaging types, URL safety, storage
src/__tests__/                unit tests (Vitest)
e2e/                          end-to-end tests (Playwright)
```

## Visual design baselines

`e2e/design-baselines.spec.ts` compares every designed surface against
checked-in screenshots under `e2e/__screenshots__/darwin/`. Baselines are
OS/font-renderer specific — they are generated and enforced on macOS
(darwin); the suite auto-skips elsewhere (CI's design enforcement is the
cross-surface pixel diff in `surface-parity.spec.ts`'s visual sibling).

- **Regenerate** after an intentional design change:
  `npm run build && npx playwright test e2e/design-baselines.spec.ts --update-snapshots`
  Then EYEBALL every changed PNG before committing, and confirm two
  consecutive plain runs pass without retries.
- **Review rule:** a PR with an intentional design change must include the
  regenerated PNGs, and the reviewer must inspect before/after images in
  the Playwright HTML report. NEVER raise `maxDiffPixelRatio` to make a
  red baseline pass; a per-shot bump to 0.002 is allowed only for proven
  headed anti-aliasing jitter, with a comment.
- A baseline test that needs retries to pass is investigated, not shipped.
- Adding a scenario row to TESTSCENARIOS.md obligates a matching update to
  the automation coverage map (`docs/test-coverage.md`).

## Related documents

- [AI_CONTRIBUTIONS.md](AI_CONTRIBUTIONS.md), the policy on AI-assisted contributions
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), the Contributor Covenant v2.1
- [SECURITY.md](SECURITY.md), how to report vulnerabilities (privately, not in the issue tracker)
