# Zagreb Fountains

Finds the nearest public drinking fountain in Zagreb from wherever you're standing. Data comes from the
City of Zagreb open data portal, dataset ["Geoportal Javni zdenci"](https://data.zagreb.hr/dataset/geoportal_javni_zdenci).
Map tiles © OpenStreetMap contributors.

## Requirements

Node >= 22.12.

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `VITE_CARTO_API_KEY` — free key from [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey), used only for
  the dark basemap. Keyless CARTO tiles come back stamped "API KEY REQUIRED", so without a key the map stays on the
  light OpenStreetMap tiles even when the system is in dark mode. The key is baked into the built JavaScript and is
  public by design; CARTO's fair use allows 5 million tile requests per month.

CI and deploys read the same value from the `CARTO_API_KEY` repository secret
(`gh secret set CARTO_API_KEY`). `npm run verify`'s dark-mode test needs the key present locally.

## Appearance

The app shows an intro screen on every launch. It carries the site description, attribution, a feedback link, and controls to set **theme** and **language**. Visitors dismiss it with "Find water" / "Pronađi vodu" or by pressing Escape, which also starts the location prompt; nothing location-related happens while the intro is open.

An ⓘ ("About this map" / "O ovoj karti") button on the map reopens the intro later; closing it from there does not re-prompt for location.

**Theme** choices are System, Light, or Dark. The setting is stored in `localStorage` under the key `zf.theme`; an absent key means System. When System is chosen, the app follows the device preference and reacts to changes live. Explicit Light or Dark overrides the device setting. The theme drives the card, page, browser theme colour, basemap (CARTO dark tiles for Dark mode, where a key is set), and Leaflet controls.

**Language** choices are English or Hrvatski (Croatian). The setting is stored under `zf.lang`; an absent key defaults to the browser's language. The app detects `navigator.language` starting with `hr` as Croatian, otherwise English. All user-visible text lives in `src/i18n/en.ts` and `src/i18n/hr.ts`, both typed by one `Strings` interface, so a missing key fails the build. Adding a third language means five edits: a new table file implementing `Strings`, widening the `Language` union in `src/settings.ts`, registering the table in `TABLES` and extending `detectLanguage()` in `src/i18n/index.ts`, and adding a button to the language row in `src/ui/intro.ts`.

**Attribution** lives on the intro screen rather than in a bar on the map. The credits section lists Leaflet, OpenStreetMap contributors, CARTO for the dark basemap, and the City of Zagreb as the data source, with a link to the dataset. The ⓘ control stays visible on the map at all times so those credits are always one tap away, which is what OpenStreetMap's and CARTO's terms require.

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

- [x] Confirm the exact Otvorena dozvola terms. DONE 2026-09-17: the licence allows free reuse with attribution. The existing credit `Izvor podataka: Grad Zagreb (data.zagreb.hr)` is appropriate and stands as is.
- [ ] Review how the city's `napomena_teren` hints read to the public. Some are internal survey notes,
      e.g. "izvorno SKI lokacija" or "-14,8 metara". The decision is deferred; the current behaviour (showing `napomena_teren` as provided) stands until determined.

## Docs

- [Spec](docs/superpowers/specs/2026-09-15-zagreb-fountains-design.md)
- [Plan](docs/superpowers/plans/2026-09-15-zagreb-fountains.md)
