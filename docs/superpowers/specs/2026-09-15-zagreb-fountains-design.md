# Zagreb Fountains — Design

**Date:** 2026-09-15
**Status:** Approved in brainstorming, pending spec review

## Goal

A mobile-first web app that shows people on foot in Zagreb (tourists, runners, cyclists, dog walkers) the nearest public drinking-water fountain and hands them off to walking directions.

## Scope

**In v1**
- Full-screen map of the City of Zagreb's public drinking fountains (official city dataset)
- Geolocation → nearest working fountain highlighted, with straight-line distance and estimated walking time
- Tap any fountain to see its details in the same card
- "Directions" button that opens Apple Maps (iOS/iPadOS) or Google Maps (everything else) in walking mode
- Weekly automated data refresh from the city's open data portal

**Explicitly out of v1** (the architecture leaves room for each)
- Merging OpenStreetMap data (bottle-refill tags, Panoramax photos, fountains missing from the city dataset)
- Offline mode / service worker
- Attribute filters
- Croatian localization (strings are centralized to make this a one-file addition)
- User reports / status updates / any backend
- In-app routing

## Stack

- Vite + TypeScript (strict), no UI framework in v1
- Tailwind CSS for styling
- Leaflet for the map, OpenStreetMap standard raster tiles
- Vitest for unit tests
- GitHub Pages hosting, GitHub Actions for CI, deploy, and data refresh

A framework (e.g. Preact/React) can be introduced later on top of `ui/` without touching `data/` or `geo/`.

## Architecture

```
zagreb-fountains/
  scripts/
    fetch-fountains.ts     # download city GeoJSON → filter → normalize → public/data/fountains.json
  public/data/
    fountains.json         # committed snapshot
  src/
    main.ts                # bootstrap, wires modules together, owns app state
    strings.ts             # all user-visible text (English)
    config.ts              # tile URL + attributions, default center, thresholds
    data/fountains.ts      # Fountain type + loadFountains()
    geo/distance.ts        # haversine, findNearest, walkingMinutes, isNearZagreb
    geo/location.ts        # watchPosition wrapper → position | error events
    map/map.ts             # Leaflet setup, fountain markers, user marker, accuracy circle, highlight
    ui/nearestCard.ts      # bottom card rendering (all card states)
    ui/directions.ts       # platform detection + directions URL builder
    style.css              # Tailwind entry
  tests/
    fixtures/zdenci-sample.geojson
    distance.test.ts
    directions.test.ts
    fetch-fountains.test.ts
  .github/workflows/
    deploy.yml             # on push to main: typecheck, test, build, publish to Pages
    refresh-data.yml       # weekly cron + manual trigger: fetch, typecheck, test, commit if changed
```

### Module boundaries

| Module | Responsibility | Depends on |
|---|---|---|
| `data/fountains` | Load and type the snapshot | `fetch` |
| `geo/distance` | Pure math, no DOM | nothing |
| `geo/location` | Browser Geolocation API wrapper | `navigator.geolocation` |
| `map/map` | All Leaflet code; exposes `setFountains`, `setUserPosition`, `highlight`, `onFountainTap` | Leaflet, `config` |
| `ui/nearestCard` | Renders card for a given state object | `strings` |
| `ui/directions` | Pure: `(fountain, userAgent) → URL` | nothing |
| `main` | Holds state, connects events to renderers | all of the above |

`geo/distance`, `ui/directions`, and the filter/normalize functions in `scripts/fetch-fountains.ts` are pure and unit-tested. Leaflet is used only inside `map/map.ts`.

## Data

### Source

City of Zagreb open data portal, dataset **"Geoportal Javni zdenci"** (publisher: Grad Zagreb; portal states it refreshes every 3 days).

- Dataset page: `https://data.zagreb.hr/dataset/geoportal_javni_zdenci`
- Resource resolution: the script calls the CKAN API `https://data.zagreb.hr/api/3/action/package_show?id=geoportal_javni_zdenci` and uses the first resource whose `format` is `GeoJSON`. It doesn't hardcode the resource URL, so a re-uploaded resource with a new ID keeps working.
- Format: GeoJSON FeatureCollection of `Point` features. Coordinates are WGS84 `[lon, lat]`, so no reprojection is needed. The `e`/`n`/`x`/`y` properties are projected HTRS96/TM and are ignored.
- On 2026-09-14 the file held 199 features, about 327 KB. All coordinates fall within lat 45.715–45.894, lon 15.835–16.114.
- Requests send a descriptive `User-Agent`.

### Fields used

| Source property | Use |
|---|---|
| `globalid` | Stable unique ID (199/199 unique; `id_ki` has a duplicate and isn't used) |
| `geometry.coordinates` | Position |
| `lokacija` | Human-readable location, used as the card title (always present) |
| `napomena_teren` | Optional extra hint, e.g. "sjeverno od javnog WC-a" (86% present) |
| `status_odrz` | `u funkciji` (working), `nije u funkciji` (not working), `treba teren` (needs survey), or null |
| `odrzava_ki` | Maintainer. Values containing `Gradska groblja` mark a cemetery-maintained fountain |
| `tip_zdenca` | Fountain type (Viktorija zdenac, Pojilica, …), stored for future use |

### Filtering

- **Exclude** `status_odrz = "nije u funkciji"` (6 on 2026-09-14).
- **Keep** null and `treba teren`. The city lists them as active (`aktivan_da_ne = DA`) and they're treated as probably working.
- The script logs kept and excluded counts, with the reason for each exclusion.

### Normalized record

```ts
type Fountain = {
  id: string;             // globalid
  lat: number;
  lon: number;
  location: string;       // lokacija
  hint?: string;          // napomena_teren, trimmed; omitted if empty
  status: "working" | "unverified"; // u funkciji → working; null / treba teren → unverified
  cemetery: boolean;      // odrzava_ki contains "Gradska groblja"
  type?: string;          // tip_zdenca
};
```

`fountains.json` is `{ generatedAt: string, sourceModified: string, count: number, fountains: Fountain[] }`, with fountains sorted by `id` so diffs stay minimal. `sourceModified` is the resource's `last_modified` from CKAN.

### Safety guard

The script exits non-zero and writes nothing when any of these is true:
- The download or JSON parse fails.
- A feature is missing `globalid` or `lokacija`, or has non-point geometry.
- Any coordinate falls outside the Zagreb bounding box (lat 45.6–46.0, lon 15.7–16.3). This catches a switch to projected coordinates.
- The new count is below 50% of the currently committed count.

### Refresh

`refresh-data.yml` runs weekly (Monday 04:00 UTC) and on manual dispatch. It runs the script, then typecheck and tests. It commits only if `fountains` changed; changes to `generatedAt` or `sourceModified` alone don't count. The commit triggers `deploy.yml`.

### Licensing and attribution

The dataset is published under the Croatian **Otvorena dozvola** (Open License), which permits commercial and non-commercial reuse, modification, and redistribution with mandatory source attribution. The map attribution control shows `Izvor podataka: Grad Zagreb (data.zagreb.hr)` alongside the OpenStreetMap tile attribution.

## User flow

1. Load: the map is centered on Ban Jelačić Square (45.8131, 15.9772) and all fountain markers render right away. Unverified fountains use a muted marker style.
2. The app calls `watchPosition` (high accuracy, 10 s timeout).
3. First fix: show the user dot, compute the nearest fountain, highlight it, and fit the map to both points. Nearest prefers `working` fountains. An `unverified` one is chosen only if it is more than 150 m closer than the nearest working one.
4. Card: title from `location`, optional `hint` line, "240 m · ~4 min walk", a **Directions** button, and badges for "Status not confirmed" (unverified) and "Cemetery — follows cemetery opening hours" (cemetery).
5. Tapping a marker selects that fountain and updates the card with the same fields.
6. Nearest is recomputed only after the user has moved ≥ 25 m since the last computation.
7. Directions:
   - iOS/iPadOS: `https://maps.apple.com/?daddr={lat},{lon}&dirflg=w`
   - Otherwise: `https://www.google.com/maps/dir/?api=1&destination={lat},{lon}&travelmode=walking`

### Calculations

- Distance: haversine, Earth radius 6,371,008.8 m
- Walking minutes: `ceil(distance_m × 1.3 / (5000 / 60))`, shown with a "~" prefix
- Distance display: below 1,000 m round to the nearest 10 m; otherwise km with one decimal
- "Near Zagreb" means within 30 km of the default center

## Error and edge states

| Situation | Behavior |
|---|---|
| Permission denied | Map stays usable. Card shows "Enable location to find the nearest fountain" and a **Retry** button. Tapping a marker still offers Directions. |
| Timeout (10 s) or position unavailable | Card shows the same Retry state. A later fix recovers automatically. |
| User > 30 km from center | Nearest isn't computed. Card shows "No fountains mapped near you. Showing Zagreb." |
| Accuracy > 100 m | Accuracy circle is drawn and the distance gets an "approx." prefix. |
| `fountains.json` fails to load | Full-screen error with **Retry**. |
| Tiles fail to load | Markers, card, and Directions keep working on a blank background. |

## Testing

**Unit (Vitest)**
- `distance`: Ban Jelačić Square (45.8131, 15.9772) → Zagreb Cathedral (45.8144, 15.9798) ≈ 248 m (±1%); Ban Jelačić Square → Split (43.5081, 16.4402) ≈ 258.9 km (±1%); `findNearest` with a normal list, ties (lowest `id` wins), an empty list (`null`), and the working-vs-unverified 150 m preference; `walkingMinutes` rounding; `isNearZagreb` on both sides of 30 km
- `directions`: iPhone, iPad (including desktop-mode iPadOS user agent with touch), Android, and desktop user agents → correct URL
- `fetch-fountains`: a fixture built from real city features covering working, not-working, null status, `treba teren`, cemetery maintainer, and empty `napomena_teren` → expected records; resource selection from a sample `package_show` response; sort order; every safety-guard condition; no network access in tests

**CI gate:** `tsc --noEmit`, `vitest run`, `vite build` must all pass before deploy or data commit.

**Manual verification before v1 is done:** serve the production build locally. With Playwright at a 390×844 viewport, simulate four scenarios: Ban Jelačić Square, Maksimir Park (45.8229, 16.0176), Split (outside Zagreb), and permission denied. Screenshot each and check the card text, badges, and the highlighted marker.

## Open risks

- **License wording (pre-launch check):** a secondary source described open data as also requiring share-alike. The full Otvorena dozvola text couldn't be retrieved during research (data.gov.hr/otvorena returned no body). Confirm the exact attribution and share-alike terms before public launch.
- **Status freshness:** `status_odrz` reflects the city's last field survey, not live state. 25 fountains have no confirmed status (24 null, 1 `treba teren`). Accepted for v1 via the "unverified" badge.
- **Coverage gaps:** 33 OSM drinking-water points aren't within 60 m of a city fountain. Some are springs, which are not tested water. A later version can review and merge them.
- **Portal availability or schema change:** only affects the weekly job, not users. The safety guard blocks bad data, and the job can be re-run manually.
- **OSM tile usage policy:** fine for low traffic. Switch `config.ts` tile URL to a provider with a free tier if usage grows.
