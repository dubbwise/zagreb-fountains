# Zagreb Fountains — Design

**Date:** 2026-09-15
**Status:** Approved in brainstorming, pending spec review

## Goal

A mobile-first web app that shows people on foot in Zagreb (tourists, runners, cyclists, dog walkers) the nearest public drinking-water fountain and hands them off to walking directions.

## Scope

**In v1**
- Full-screen map of all public drinking fountains in the City of Zagreb
- Geolocation → nearest fountain highlighted, with straight-line distance and estimated walking time
- Tap any fountain to see its details in the same card
- "Directions" button that opens Apple Maps (iOS/iPadOS) or Google Maps (everything else) in walking mode
- Weekly automated data refresh from OpenStreetMap

**Explicitly out of v1** (the architecture leaves room for each)
- Offline mode / service worker
- Attribute filters (bottle refill, wheelchair, seasonal)
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
    fetch-fountains.ts     # Overpass query → filter → normalize → public/data/fountains.json
  public/data/
    fountains.json         # committed snapshot
  src/
    main.ts                # bootstrap, wires modules together, owns app state
    strings.ts             # all user-visible text (English)
    config.ts              # tile URL + attribution, default center, thresholds
    data/fountains.ts      # Fountain type + loadFountains()
    geo/distance.ts        # haversine, findNearest, walkingMinutes, isNearZagreb
    geo/location.ts        # watchPosition wrapper → position | error events
    map/map.ts             # Leaflet setup, fountain markers, user marker, accuracy circle, highlight
    ui/nearestCard.ts      # bottom card rendering (all card states)
    ui/directions.ts       # platform detection + directions URL builder
    style.css              # Tailwind entry
  tests/
    fixtures/overpass-sample.json
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

Overpass API (`https://overpass-api.de/api/interpreter`), query:

```
[out:json][timeout:60];
area["name"="Grad Zagreb"]["boundary"="administrative"]->.a;
(
  node["amenity"="drinking_water"](area.a);
  node["amenity"="fountain"]["drinking_water"="yes"](area.a);
);
out tags center;
```

The request must send a descriptive `User-Agent` and `Accept: application/json`. Without them Overpass returned HTTP 406 during research. On 2026-09-15 this query returned 165 nodes.

### Filtering (exclude)

- `access` in `private`, `no`, `customers`
- `indoor=yes`
- `drinking_water=no`

The script logs every kept and excluded count, and each exclusion reason.

### Normalized record

```ts
type Fountain = {
  id: number;            // OSM node id
  lat: number;
  lon: number;
  name?: string;
  bottle?: boolean;      // from bottle=yes|no
  wheelchair?: boolean;  // from wheelchair=yes|no
  seasonal?: string;     // raw OSM value
  openingHours?: string; // raw OSM opening_hours
  fee?: boolean;         // from fee=yes|no
  checkDate?: string;    // raw OSM check_date
};
```

`fountains.json` is `{ generatedAt: string, count: number, fountains: Fountain[] }`, with fountains sorted by `id` so diffs stay minimal.

### Safety guard

If the new count is below 50% of the currently committed count, the script exits non-zero and writes nothing.

### Refresh

`refresh-data.yml` runs weekly (Monday 04:00 UTC) and on manual dispatch. It runs the script, then typecheck and tests. It commits only if `fountains` changed; changes to `generatedAt` alone don't count. The commit triggers `deploy.yml`.

## User flow

1. Load: the map is centered on Ban Jelačić Square (45.8131, 15.9772) and all fountain markers render right away.
2. The app calls `watchPosition` (high accuracy, 10 s timeout).
3. First fix: show the user dot, compute the nearest fountain, highlight it, and fit the map to both points.
4. Card: optional name, "Nearest fountain · 240 m · ~4 min walk", and a **Directions** button.
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
- `distance`: Ban Jelačić Square (45.8131, 15.9772) → Zagreb Cathedral (45.8144, 15.9798) ≈ 248 m (±1%); Ban Jelačić Square → Split (43.5081, 16.4402) ≈ 258.9 km (±1%); `findNearest` with a normal list, ties (lowest id wins), and an empty list (`null`); `walkingMinutes` rounding; `isNearZagreb` on both sides of 30 km
- `directions`: iPhone, iPad (including desktop-mode iPadOS user agent with touch), Android, and desktop user agents → correct URL
- `fetch-fountains`: fixture with private, indoor, `drinking_water=no`, and valid nodes → expected records; boolean tag parsing; sort order; the 50% guard; no network access in tests

**CI gate:** `tsc --noEmit`, `vitest run`, `vite build` must all pass before deploy or data commit.

**Manual verification before v1 is done:** serve the production build locally. With Playwright at a 390×844 viewport, simulate four scenarios: Ban Jelačić Square, Maksimir Park (45.8229, 16.0176), Split (outside Zagreb), and permission denied. Screenshot each and check the card text and the highlighted marker.

## Open risks

- **OSM tile usage policy:** fine for low traffic. Switch `config.ts` tile URL to a provider with a free tier if usage grows.
- **Data accuracy:** OSM rarely records seasonal shut-offs. Accepted for v1; fixes should be made upstream in OSM.
- **Overpass availability:** only affects the weekly job, not users. A failed run changes nothing and can be re-run manually.
