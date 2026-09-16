# Zagreb Fountains — Remaining Work

**Date:** 2026-09-16
**Status:** v1 is merged to `main` (73 unit tests, 5 e2e, typecheck and build clean). Nothing is published yet.

Related docs:
- Spec: `docs/superpowers/specs/2026-09-15-zagreb-fountains-design.md`
- v1 plan: `docs/superpowers/plans/2026-09-15-zagreb-fountains.md`

---

## 1. Before launch (blocking)

- [ ] **Confirm the open-data license terms.** The dataset is published under the Croatian *Otvorena dozvola*. A search summary said it allows commercial reuse with attribution; one source also mentioned a share-alike condition, and the official text at data.gov.hr/otvorena could not be retrieved during research. Confirm the exact attribution wording and whether share-alike applies.
  - Today the app credits `Izvor podataka: Grad Zagreb (data.zagreb.hr)` in the map attribution (`src/config.ts`).
  - If the terms differ, update `DATA_ATTRIBUTION` and the README.

- [ ] **Review the hint line shown on the card.** `napomena_teren` from the city is sometimes an internal survey note rather than something useful to a passer-by, for example "izvorno SKI lokacija", "-14,8 metara", "(potreban popravak!, curi)". 171 of 199 records have one.
  - Options: keep as is; drop the hint entirely; or filter out hints that match internal patterns (a leading `-`, "izvorno", "SKI").
  - Where: the `hint` field in `scripts/lib/fountain-data.ts`, rendered by `src/ui/nearestCard.ts`.

## 2. Publishing (needs user action)

- [ ] **Log in to GitHub:** run `! gh auth login` in the terminal. The CLI is installed but not logged in.
- [ ] **Create the repo and push.** Free GitHub Pages needs a public repo:
  ```bash
  gh repo create zagreb-fountains --public --source . --remote origin --push
  ```
- [ ] **Enable Pages with the Actions source**, before or right after the first push:
  ```bash
  gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=workflow
  ```
- [ ] **Allow the `github-pages` environment to deploy from `main`** (repo Settings → Environments), otherwise `deploy-pages` fails.
- [ ] **Run the first deploy and watch it:**
  ```bash
  gh workflow run deploy.yml --ref main
  gh run watch "$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
  gh api "repos/{owner}/{repo}/pages" --jq .html_url
  ```
- [ ] **Open the URL on a phone** and check that the nearest fountain and Directions work on real GPS.
- [ ] **Run the refresh workflow once by hand** to prove it works end to end:
  ```bash
  gh workflow run refresh-data.yml --ref main
  ```
  Expect "No fountain changes." or a data commit followed by a deploy.

## 3. After publishing (small, high value)

- [ ] **Add a contact URL to the fetch script's User-Agent** (`scripts/fetch-fountains.ts`, `REQUEST_HEADERS`). It currently reads `zagreb-fountains-data-refresh/1.0` with no contact. Deferred during v1 because no repo URL existed. Add the repository URL so the portal can identify the client.
- [ ] **Watch for the 60-day schedule disable.** GitHub disables scheduled workflows after 60 days without repository activity, and the refresh commits only when data changes, so the weekly refresh can stop silently. The README warns about this. Consider a calendar reminder to run `gh workflow run refresh-data.yml --ref main` monthly, or re-enable it in the Actions tab when it stops.
- [ ] **Narrow the refresh workflow's write access** (final review, Minor 7). The refresh job runs `npm ci` install scripts while holding `contents: write` and persisted git credentials, so a compromised dependency could push to the repo. Fix by splitting fetch and validation from the commit step, or by setting `persist-credentials: false` on checkout and pushing with an explicit token only in the commit step.

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
- [ ] **Croatian localization.** All copy already lives in `src/strings.ts`, so this is one extra file plus a language switch.
- [ ] **User reports** ("broken", "dry", "missing"). Needs a backend and moderation; explicitly out of scope for v1.
