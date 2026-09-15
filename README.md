# Zagreb Fountains

Finds the nearest public drinking fountain in Zagreb from wherever you're standing. Data comes from the
City of Zagreb open data portal, dataset ["Geoportal Javni zdenci"](https://data.zagreb.hr/dataset/geoportal_javni_zdenci).
Map tiles © OpenStreetMap contributors.

## Requirements

Node >= 22.12.

## Scripts

- `npm run dev` — local dev server.
- `npm run build` — production build to `dist/`.
- `npm run preview` — serve the production build locally.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run test` — run the Vitest unit suite.
- `npm run fetch-data` — download the latest fountain data from `data.zagreb.hr`, validate it, and rewrite
  `public/data/fountains.json`. It only rewrites the file when the fountains actually changed, and refuses
  (exits non-zero, writes nothing) if validation fails — see "Safety guard" in the spec.
- `npm run verify` — Playwright end-to-end checks against a production build served on port 4173. First
  time, install the browser with `npx playwright install chromium`. Screenshots land in
  `e2e/screenshots/`. Not run in CI.

## Deployment (GitHub Pages)

Prerequisites, before the first push to `main`:

- Repo Settings → Pages → Source = "GitHub Actions" (or
  `gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow`).
- The `github-pages` environment must allow deployments from `main`.

`.github/workflows/deploy.yml` runs on push to `main` and on manual dispatch: it builds, then publishes to
Pages.

## Data refresh

`.github/workflows/refresh-data.yml` runs every Monday at 04:00 UTC, and on manual dispatch. It fetches the
latest data, validates and builds it, and commits `public/data/fountains.json` only if the fountains
changed. That commit triggers a deploy.

**Warning:** GitHub disables scheduled workflows after 60 days with no repository activity. If the weekly
refresh silently stops, re-enable it from the Actions tab, or run it manually (`workflow_dispatch`) from
time to time.

## Pre-launch checklist

- [ ] Confirm the exact Otvorena dozvola terms (attribution wording, any share-alike clause) on
      data.gov.hr before announcing the site publicly.
- [ ] Review how the city's `napomena_teren` hints read to the public. Some are internal survey notes,
      e.g. "izvorno SKI lokacija" or "-14,8 metara". Decide whether to keep, filter, or drop hints in v1.1.

## Docs

- [Spec](docs/superpowers/specs/2026-09-15-zagreb-fountains-design.md)
- [Plan](docs/superpowers/plans/2026-09-15-zagreb-fountains.md)
