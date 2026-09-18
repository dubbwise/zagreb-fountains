# Working in this repo

## Copy is not a breaking change

User-visible wording changes freely. It is **not** a breaking change, and it
must never fail the build.

**Do not assert literal user-visible copy in tests.** A test that breaks when a
sentence is reworded guards nothing; it only blocks the build. This has broken
CI more than once.

Instead:

- **Compare against the i18n table**, not a literal:
  `expect(html).toContain(en.introTitle)` — not the sentence itself.
  Playwright specs are TypeScript and can import `src/i18n/en.ts` too.
- **Locate elements by structure**, not by text: `[data-theme="dark"]`,
  `[data-language="hr"]`, `#intro-title`, `role` + `aria-pressed`.
- Where a control's accessible name is hardcoded in source rather than coming
  from the i18n tables, prefer a `data-*` selector over the visible string.

**What is still fair to assert:** ids, classes, `data-*` attributes, ARIA
state, URLs, numbers and dates, element counts, and behaviour (what happens on
click, what renders when a value is absent).

**One exception:** attribution URLs. OpenStreetMap's and CARTO's terms require
their credits to be present and linked, so those URLs are asserted on purpose.
Losing one is a licence problem, not a copy change.

## When copy changes

Change the string in `src/i18n/en.ts` and `src/i18n/hr.ts`. Nothing else should
need touching. If a test fails, the test was over-specified — fix the test, not
the copy.

## Distinguish copy from features

A missing _sentence_ is copy. A missing _link, control, or behaviour_ is a
regression. If a test fails because an element vanished entirely, check whether
that was intended before deleting the assertion.

## Commands

```bash
npm run typecheck     # tsc --noEmit
npm run test          # vitest
npm run build         # production build
npm run verify        # Playwright, not run in CI
npm run format        # prettier --write .
```

CI (`.github/workflows/deploy.yml`) gates on typecheck, test and build, then
deploys to GitHub Pages on push to `main`. Playwright is local-only.

There is no ESLint: `typescript-eslint` does not yet support TypeScript 7.
See `docs/superpowers/plans/2026-09-16-remaining-work.md`.
