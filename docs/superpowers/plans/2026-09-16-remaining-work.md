# Zagreb Fountains — Remaining Work

**Date:** 2026-09-16
**Status:** v1 is merged to `main` (73 unit tests, 5 e2e, typecheck and build clean). Nothing is published yet.

Related docs:
- Spec: `docs/superpowers/specs/2026-09-15-zagreb-fountains-design.md`
- v1 plan: `docs/superpowers/plans/2026-09-15-zagreb-fountains.md`

---

## 1. Before launch (blocking)

- [x] **Confirm the open-data license terms.** DONE 2026-09-17: the *Otvorena dozvola* allows free reuse with attribution. The existing credit `Izvor podataka: Grad Zagreb (data.zagreb.hr)` is appropriate and stands as is.

- [ ] **Review the hint line shown on the card.** `napomena_teren` from the city is sometimes an internal survey note rather than something useful to a passer-by, for example "izvorno SKI lokacija", "-14,8 metara", "(potreban popravak!, curi)". 171 of 199 records have one. The decision is deferred; the current behaviour (showing `napomena_teren` as provided) stands until determined.
  - Where: the `hint` field in `scripts/lib/fountain-data.ts`, rendered by `src/ui/nearestCard.ts`.

## 2. Publishing — DONE 2026-09-16

Live site: **https://dubbwise.github.io/zagreb-fountains/**
Repo: **https://github.com/dubbwise/zagreb-fountains** (public)

- [x] Logged in to GitHub (`gh auth login`, account `dubbwise`).
- [x] Created the public repo and added the `origin` remote.
- [x] Enabled Pages with `build_type=workflow` before the first push, so the first deploy wouldn't fail.
- [x] Pushed `main`. The deploy ran green: build 15 s (typecheck, test, build, upload), deploy 17 s.
- [x] Verified live: page and `data/fountains.json` both return 200, 193 markers render, the card shows the nearest fountain with distance and walking time, the Directions link points at Google Maps, and both attributions are visible. Chromium reports `isSecureContext: true`, so geolocation is allowed.
- [ ] **Open the URL on a phone** and check the nearest fountain and Directions against real GPS. This was the original reason for publishing: location is blocked on a plain `http://` LAN address, because browsers only allow it on secure pages (HTTPS, or localhost).
- [ ] **Run the refresh workflow once by hand** to prove it works end to end:
  ```bash
  gh workflow run refresh-data.yml --ref main
  ```
  Expect "No fountain changes." (the snapshot is current), or a data commit followed by a deploy.

## 3. After publishing (small, high value)

- [ ] **Add a contact URL to the fetch script's User-Agent** (`scripts/fetch-fountains.ts`, `REQUEST_HEADERS`). It currently reads `zagreb-fountains-data-refresh/1.0` with no contact. This was blocked during v1 because no repo URL existed; the repo now exists, so use:
  `zagreb-fountains-data-refresh/1.0 (+https://github.com/dubbwise/zagreb-fountains)`
- [ ] **Watch for the 60-day schedule disable.** GitHub disables scheduled workflows after 60 days without repository activity, and the refresh commits only when data changes, so the weekly refresh can stop silently. The README warns about this. Consider a calendar reminder to run `gh workflow run refresh-data.yml --ref main` monthly, or re-enable it in the Actions tab when it stops.
- [ ] **CARTO's raster basemaps are deprecated.** Checked 2026-09-17. CARTO's own FAQ says the `basemaps.cartocdn.com` PNG tiles "are still available, but they now require an API key and are being retired", and that they are "considering stopping data updates to the raster basemaps, in which case raster cartography will stay where it is and the gap will widen over time." No sunset date is announced and the 5M-tiles/month free tier still applies, so nothing breaks today — but `DARK_TILE_URL` is on a clock and its data will drift stale.
  - There is **no native dark tile layer from OpenStreetMap** to fall back to. `tile.openstreetmap.org` serves only the Standard (OSM Carto) style, and osm.org's own "Preferred Map Colour Scheme → Dark" dims those light tiles with a CSS filter; of the eight layers in its `config/layers.yml`, only Thunderforest Transport defines a dark style URL, and that needs its own API key.
  - Options when it matters: keep CARTO until it breaks; switch the dark basemap to filtered OSM tiles (removes the API key, the GitHub secret and the watermark trap entirely, at some cartographic cost — this is what osm.org itself does); move to a keyed provider such as Stadia Alidade Smooth Dark; or move to vector tiles with MapLibre, which replaces Leaflet.

- [ ] **Narrow the refresh workflow's write access** (final review, Minor 7). The refresh job runs `npm ci` install scripts while holding `contents: write` and persisted git credentials, so a compromised dependency could push to the repo. Fix by splitting fetch and validation from the commit step, or by setting `persist-credentials: false` on checkout and pushing with an explicit token only in the commit step.

## 3a. From the v1.1 intro screen work (2026-09-17)

These items came out of the v1.1 whole-branch review and were triaged as non-blocking.

- [ ] **The location prompt still fires after a failed data load.** `src/main.ts` — `closeIntro()` flushes the deferred error screen and then starts the location watch unconditionally, so a first-time visitor whose fountain data fails to load sees the error screen and immediately gets a native permission prompt with no explanatory UI behind it. Pre-existing rather than introduced by v1.1, and the final re-review judged it a fast-follow rather than a blocker. Fix by gating `startLocation()` on a successful data load.

- [ ] **Neither test suite covers Safari**, which is likely the most common browser for this app's audience. Playwright runs Chromium only. One symptom already surfaced and was fixed during v1.1: Safari does not focus a `<button>` on click, which broke the intro's focus restore until it was made explicit. Consider adding a WebKit project to `playwright.config.ts`.

- [ ] **The tile-coverage guard measures a union bounding box** (`e2e/verify.spec.ts`), so it cannot detect a missing tile in the middle of the grid. Judged low risk because Leaflet loads tiles from the centre outward, meaning an interior-only gap is the opposite of the normal failure order. If tightening is ever wanted, also assert the loaded tile count against the expected grid size for the container.

- [ ] **`tests/i18n.test.ts`'s key-parity test duplicates a compile-time guarantee** — `hr: Strings` already fails the build on a missing key. Harmless, and it does catch extra keys the type would not, so it was kept.

- [ ] **`README.md`'s "where a key is set" phrasing is terse** — the Environment section a couple of paragraphs above explains the CARTO key fully, so this is only a cross-reference nicety.

## 4. Deferred small items (no behaviour risk)

These came out of task reviews, were triaged as non-blocking, and are recorded so they aren't lost.

- [ ] `scripts/lib/fountain-data.ts`: reject or normalize a `status_odrz` whose casing differs from the expected values. Today `unrecognizedStatuses` logs them and they map to `unverified`.
- [ ] `scripts/lib/fountain-data.ts`: `sameFountains` compares with `JSON.stringify`, so it is sensitive to key order. Safe today, since one place builds the records; reordering the fields would cause one redundant data commit.
- [ ] `scripts/fetch-fountains.ts`: the fountains array is filtered twice just to produce log counts (immaterial at n=193).
- [ ] `src/geo/location.ts`: the error-code mapping is a nested ternary; a `switch` would read better.
- [ ] `src/map/map.ts`: `setUserPosition` repeats the create/update/remove pattern for the accuracy circle and the user marker.
- [ ] `src/ui/directions.ts`: the user-agent regex also matches `iPod`, which is broader than the spec's "iOS/iPadOS" wording but correct in practice; `maxTouchPoints === 1` is untested.
- [ ] `tests/nearestCard.test.ts`: the unverified and cemetery badges are only tested together, never on their own.
- [ ] `src/main.ts`: pressing Retry while a fountain is tapped keeps the fountain card rather than showing "Finding your location…". Currently unreachable, because Retry only renders in the location-error state.

## 5. Later versions (from the spec's "out of scope")

- [ ] **Merge OpenStreetMap data.** 33 OSM drinking-water points sit more than 60 m from any city fountain; some are natural springs and should stay out. OSM also has bottle-refill tags for 92 points, wheelchair access for 11, and 103 street-level photos (Panoramax).
- [ ] **Offline support:** a service worker for the data and map tiles, for tourists on limited data.
- [ ] **Filters:** bottle refill, wheelchair access, seasonal, not in a cemetery.
- [x] **Croatian localization.** DONE 2026-09-17. See `docs/superpowers/specs/2026-09-17-zagreb-fountains-intro-design.md`.
- [ ] **User reports** ("broken", "dry", "missing"). Needs a backend and moderation; explicitly out of scope for v1.
