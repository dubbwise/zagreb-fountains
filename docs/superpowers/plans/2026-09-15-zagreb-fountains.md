# Zagreb Fountains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first web app that shows the nearest working public drinking fountain in Zagreb and hands off to walking directions.

**Architecture:** Static Vite + TypeScript site with no framework and no backend. A Node script downloads the City of Zagreb "Javni zdenci" GeoJSON, validates it, and commits a small normalized snapshot to `public/data/fountains.json`. A weekly GitHub Action refreshes that snapshot. The browser loads the snapshot, uses the Geolocation API and pure distance functions to pick the nearest fountain, draws it with Leaflet, and links out to Apple Maps or Google Maps.

**Tech Stack:** Node ≥ 22.12, Vite 8, TypeScript 7 (strict), Tailwind CSS 4 (via `@tailwindcss/vite`), Leaflet 1.9, Vitest 5, tsx 4, Playwright 1.63 (manual verification only), GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-15-zagreb-fountains-design.md`

## Global Constraints

- Project root: `/Users/bb/Sandbox/zagreb-fountains` (git repo already exists with the spec committed). All paths below are relative to it.
- Node `>=22.12`; npm 10.
- TypeScript `strict: true`. No `any` in `src/`.
- Data source: `https://data.zagreb.hr/api/3/action/package_show?id=geoportal_javni_zdenci` → first resource with `format` `GeoJSON`.
- Exclude `status_odrz = "nije u funkciji"`; `u funkciji` → `working`; null, `treba teren`, or anything else → `unverified`.
- Cemetery: `odrzava_ki` contains `Gradska groblja`.
- Safety guard: Zagreb bbox lat 45.6–46.0, lon 15.7–16.3; refuse if count < 50% of previous; refuse if 0.
- Default center: Ban Jelačić Square (45.8131, 15.9772). Near Zagreb: ≤ 30 km from center.
- Geolocation: `watchPosition`, high accuracy, 10 s timeout. Recompute nearest only after moving ≥ 25 m. Low accuracy: > 100 m.
- Nearest: prefer `working`; choose `unverified` only if more than 150 m closer. Exact ties → lowest `id`.
- Walking minutes: `ceil(distance_m × 1.3 / (5000 / 60))`, minimum 1, shown as `~N min walk`.
- Distance display: below 1,000 m (after rounding to 10 m) → `240 m`; otherwise `1.2 km`.
- Directions: iOS/iPadOS `https://maps.apple.com/?daddr={lat},{lon}&dirflg=w`; otherwise `https://www.google.com/maps/dir/?api=1&destination={lat},{lon}&travelmode=walking` (coordinates with 6 decimals).
- Attribution always visible: OpenStreetMap tiles and `Izvor podataka: Grad Zagreb (data.zagreb.hr)`.
- All user-visible copy lives in `src/strings.ts` (English only in v1).
- Commit after every task. End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Clarifications to the Spec

These came from building and running a prototype of this plan on 2026-09-15. The spec's intent is unchanged.

1. `walkingMinutes` returns at least 1 so the card never says "~0 min walk".
2. Snapshot coordinates are rounded to 6 decimals (~11 cm) to keep diffs stable.
3. Tapping the currently-nearest marker returns the card to "follow nearest" mode. Tapping any other marker pins that fountain.
4. The map re-frames on the first in-range fix, and again after the user was outside Zagreb and comes back.
5. Leaflet's zoom control moves to the top-right under the attribution. At phone width the attribution wraps and covered the top-left zoom buttons.
6. GitHub doesn't start new workflow runs for pushes made with `GITHUB_TOKEN`. The refresh workflow therefore starts the deploy explicitly with `gh workflow run deploy.yml` (a `workflow_dispatch` event, which is allowed).
7. An inline SVG emoji favicon avoids a `/favicon.ico` 404.

## File Structure

```
zagreb-fountains/
  package.json, package-lock.json, tsconfig.json, vite.config.ts, playwright.config.ts, .gitignore, index.html
  scripts/
    lib/fountain-data.ts   # pure: resource selection, normalize/validate, count guard, snapshot build
    fetch-fountains.ts     # IO: download → normalize → guard → write snapshot if fountains changed
  public/data/fountains.json
  src/
    main.ts                # app state + wiring (the only file that touches all modules)
    style.css              # Tailwind entry
    config.ts              # constants (center, thresholds, tile + attribution)
    strings.ts             # all copy
    data/fountains.ts      # Fountain + Snapshot types, loadFountains()
    geo/distance.ts        # haversine, findNearest, walkingMinutes, formatDistance, isNearZagreb
    geo/location.ts        # watchLocation() wrapper over Geolocation
    map/map.ts             # all Leaflet code behind the FountainMap interface
    ui/directions.ts       # platform detection + directions URL
    ui/nearestCard.ts      # CardState → HTML (pure) + renderCard()
  tests/
    fixtures/zdenci-sample.geojson, fixtures/package-show-sample.json
    fountains.test.ts, distance.test.ts, directions.test.ts, location.test.ts, nearestCard.test.ts, fountain-data.test.ts
  e2e/verify.spec.ts       # manual Playwright verification (not run in CI)
  .github/workflows/deploy.yml, .github/workflows/refresh-data.yml
```

---

### Task 1: Project scaffold and fountain data loader

**Files:**
- Create: `package.json`, `.gitignore`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/style.css`, `src/main.ts` (placeholder; replaced in Task 8)
- Create: `src/data/fountains.ts`
- Test: `tests/fountains.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface Fountain { id: string; lat: number; lon: number; location: string; hint?: string; status: "working" | "unverified"; cemetery: boolean; type?: string }`
  - `interface Snapshot { generatedAt: string; sourceModified: string; count: number; fountains: Fountain[] }`
  - `loadFountains(url: string, fetchFn?: typeof fetch): Promise<Fountain[]>`
  - npm scripts: `dev`, `build`, `preview`, `typecheck`, `test`, `fetch-data`, `verify`

- [ ] **Step 1: Make sure the branch is `main`**

Run: `git branch -M main && git branch --show-current`
Expected: `main`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "zagreb-fountains",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.12"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "fetch-data": "tsx scripts/fetch-fountains.ts",
    "verify": "playwright test"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
npm install leaflet@^1.9.4
npm install -D vite@^8.3.0 typescript@^7.0.2 tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3 vitest@^5.0.1 tsx@^4.23.13 @types/node@^22 @types/leaflet@^1.9.22
```
Expected: both finish without `ERESOLVE` errors, and `package.json` now has `dependencies` and `devDependencies`.

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
dist/
e2e/.results/
e2e/screenshots/
playwright-report/
.DS_Store
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tests", "scripts", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 6: Create `vite.config.ts`**

Import `defineConfig` from `vitest/config`, not `vite`. Otherwise `tsc` rejects the `test` key.

```ts
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the site works under a GitHub Pages sub-path.
  base: "./",
  plugins: [tailwindcss()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="Find the nearest public drinking fountain in Zagreb." />
    <meta name="theme-color" content="#0369a1" />
    <link
      rel="icon"
      href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💧</text></svg>"
    />
    <title>Zagreb Fountains</title>
  </head>
  <body class="h-dvh overflow-hidden bg-slate-100 text-slate-900 antialiased">
    <div id="map" class="absolute inset-0"></div>
    <section
      id="card"
      class="absolute inset-x-0 bottom-0 z-[1000] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      aria-live="polite"
    ></section>
    <div id="fatal" class="absolute inset-0 z-[2000] hidden" role="alert"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/style.css` and a placeholder `src/main.ts`**

`src/style.css`:
```css
@import "tailwindcss";
```

`src/main.ts` (replaced in Task 8):
```ts
import "./style.css";
```

- [ ] **Step 9: Write the failing test `tests/fountains.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { loadFountains, type Fountain, type Snapshot } from "../src/data/fountains";

const fountain: Fountain = {
  id: "8596b290-ea0d-4caa-8890-047804249320",
  lat: 45.812749,
  lon: 15.964876,
  location: "Britanski trg",
  hint: "sjeverno od javnog WC-a",
  status: "working",
  cemetery: false,
  type: "Viktorija zdenac",
};

function fakeFetch(response: Response) {
  return vi.fn(async () => response);
}

describe("loadFountains", () => {
  it("returns the fountains from a snapshot", async () => {
    const snapshot: Snapshot = {
      generatedAt: "2026-09-15T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 1,
      fountains: [fountain],
    };
    const fetchFn = fakeFetch(new Response(JSON.stringify(snapshot), { status: 200 }));

    await expect(loadFountains("data/fountains.json", fetchFn as unknown as typeof fetch)).resolves.toEqual([
      fountain,
    ]);
    expect(fetchFn).toHaveBeenCalledWith("data/fountains.json");
  });

  it("throws on a non-OK response", async () => {
    const fetchFn = fakeFetch(new Response("not found", { status: 404 }));
    await expect(loadFountains("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("HTTP 404");
  });

  it("throws when the payload has no fountains array", async () => {
    const fetchFn = fakeFetch(new Response("{}", { status: 200 }));
    await expect(loadFountains("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("malformed");
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx vitest run tests/fountains.test.ts`
Expected: FAIL, with an error that `../src/data/fountains` can't be resolved.

- [ ] **Step 11: Implement `src/data/fountains.ts`**

```ts
export interface Fountain {
  id: string;
  lat: number;
  lon: number;
  location: string;
  hint?: string;
  status: "working" | "unverified";
  cemetery: boolean;
  type?: string;
}

export interface Snapshot {
  generatedAt: string;
  sourceModified: string;
  count: number;
  fountains: Fountain[];
}

export async function loadFountains(url: string, fetchFn: typeof fetch = fetch): Promise<Fountain[]> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to load fountains: HTTP ${response.status}`);
  }
  const data = (await response.json()) as Partial<Snapshot>;
  if (!Array.isArray(data.fountains)) {
    throw new Error("Fountain data is malformed");
  }
  return data.fountains;
}
```

- [ ] **Step 12: Run tests, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: `Tests  3 passed (3)`, no `tsc` output, and a Vite build ending in `✓ built in`.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json .gitignore tsconfig.json vite.config.ts index.html src tests
git commit -m "feat: scaffold Vite + TS + Tailwind app with fountain data loader

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Configuration and distance logic

**Files:**
- Create: `src/config.ts`, `src/geo/distance.ts`
- Test: `tests/distance.test.ts`

**Interfaces:**
- Consumes: `Fountain` from `src/data/fountains.ts`
- Produces:
  - `src/config.ts` constants: `DEFAULT_CENTER`, `DEFAULT_ZOOM`, `TILE_URL`, `TILE_MAX_ZOOM`, `TILE_ATTRIBUTION`, `DATA_ATTRIBUTION`, `GEOLOCATION_TIMEOUT_MS`, `RECOMPUTE_DISTANCE_M`, `LOW_ACCURACY_M`, `NEAR_ZAGREB_RADIUS_M`, `UNVERIFIED_PREFERENCE_M`, `WALK_SPEED_KMH`, `WALK_DETOUR_FACTOR`
  - `interface LatLon { lat: number; lon: number }`
  - `interface NearestResult { fountain: Fountain; distanceM: number }`
  - `haversineMeters(a: LatLon, b: LatLon): number`
  - `findNearest(from: LatLon, fountains: readonly Fountain[]): NearestResult | null`
  - `walkingMinutes(distanceM: number): number`
  - `formatDistance(distanceM: number): string`
  - `isNearZagreb(point: LatLon): boolean`

- [ ] **Step 1: Create `src/config.ts`**

```ts
/** Ban Jelačić Square — default map center and the reference point for "near Zagreb". */
export const DEFAULT_CENTER = { lat: 45.8131, lon: 15.9772 } as const;
export const DEFAULT_ZOOM = 14;

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_MAX_ZOOM = 19;
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const DATA_ATTRIBUTION =
  'Izvor podataka: Grad Zagreb (<a href="https://data.zagreb.hr/dataset/geoportal_javni_zdenci">data.zagreb.hr</a>)';

export const GEOLOCATION_TIMEOUT_MS = 10_000;
export const RECOMPUTE_DISTANCE_M = 25;
export const LOW_ACCURACY_M = 100;
export const NEAR_ZAGREB_RADIUS_M = 30_000;
export const UNVERIFIED_PREFERENCE_M = 150;
export const WALK_SPEED_KMH = 5;
export const WALK_DETOUR_FACTOR = 1.3;
```

- [ ] **Step 2: Write the failing test `tests/distance.test.ts`**

Test fountains are placed due north of the center. Along a meridian, haversine distance is exactly `R × Δlat`, so the expected distances are exact.

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CENTER } from "../src/config";
import type { Fountain } from "../src/data/fountains";
import { findNearest, formatDistance, haversineMeters, isNearZagreb, walkingMinutes } from "../src/geo/distance";

const METERS_PER_DEGREE_LAT = (6_371_008.8 * Math.PI) / 180;

/** A point the given number of meters due north of the default center. */
function north(meters: number) {
  return { lat: DEFAULT_CENTER.lat + meters / METERS_PER_DEGREE_LAT, lon: DEFAULT_CENTER.lon };
}

function fountain(id: string, metersNorth: number, status: Fountain["status"] = "working"): Fountain {
  return { id, ...north(metersNorth), location: `Fountain ${id}`, status, cemetery: false };
}

function expectWithinOnePercent(actual: number, expected: number): void {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01);
}

describe("haversineMeters", () => {
  it("measures Ban Jelačić Square to Zagreb Cathedral", () => {
    expectWithinOnePercent(haversineMeters({ lat: 45.8131, lon: 15.9772 }, { lat: 45.8144, lon: 15.9798 }), 248);
  });

  it("measures Ban Jelačić Square to Split", () => {
    expectWithinOnePercent(haversineMeters(DEFAULT_CENTER, { lat: 43.5081, lon: 16.4402 }), 258_906);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters(DEFAULT_CENTER, DEFAULT_CENTER)).toBe(0);
  });
});

describe("findNearest", () => {
  it("returns null for an empty list", () => {
    expect(findNearest(DEFAULT_CENTER, [])).toBeNull();
  });

  it("returns the closest working fountain with its distance", () => {
    const result = findNearest(DEFAULT_CENTER, [fountain("far", 900), fountain("near", 300), fountain("mid", 600)]);
    expect(result?.fountain.id).toBe("near");
    expect(result?.distanceM).toBeCloseTo(300, 3);
  });

  it("breaks exact ties by lowest id", () => {
    expect(findNearest(DEFAULT_CENTER, [fountain("b", 300), fountain("a", 300)])?.fountain.id).toBe("a");
  });

  it("keeps a working fountain when an unverified one is at most 150 m closer", () => {
    const result = findNearest(DEFAULT_CENTER, [fountain("w", 300), fountain("u", 200, "unverified")]);
    expect(result?.fountain.id).toBe("w");
  });

  it("picks an unverified fountain when it is more than 150 m closer", () => {
    const result = findNearest(DEFAULT_CENTER, [fountain("w", 400), fountain("u", 200, "unverified")]);
    expect(result?.fountain.id).toBe("u");
  });

  it("falls back to an unverified fountain when none are working", () => {
    expect(findNearest(DEFAULT_CENTER, [fountain("u", 500, "unverified")])?.fountain.id).toBe("u");
  });
});

describe("walkingMinutes", () => {
  it.each([
    [240, 4],
    [100, 2],
    [1000, 16],
    [0, 1],
  ])("%d m takes ~%d min", (meters, minutes) => {
    expect(walkingMinutes(meters)).toBe(minutes);
  });
});

describe("formatDistance", () => {
  it.each([
    [244, "240 m"],
    [245, "250 m"],
    [994, "990 m"],
    [995, "1.0 km"],
    [2345, "2.3 km"],
    [12_340, "12.3 km"],
  ])("%d m is shown as %s", (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });
});

describe("isNearZagreb", () => {
  it("accepts points within 30 km of the center", () => {
    expect(isNearZagreb(north(28_900))).toBe(true);
  });

  it("rejects points beyond 30 km", () => {
    expect(isNearZagreb(north(31_100))).toBe(false);
    expect(isNearZagreb({ lat: 43.5081, lon: 16.4402 })).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/distance.test.ts`
Expected: FAIL, with an error that `../src/geo/distance` can't be resolved.

- [ ] **Step 4: Implement `src/geo/distance.ts`**

```ts
import {
  DEFAULT_CENTER,
  NEAR_ZAGREB_RADIUS_M,
  UNVERIFIED_PREFERENCE_M,
  WALK_DETOUR_FACTOR,
  WALK_SPEED_KMH,
} from "../config";
import type { Fountain } from "../data/fountains";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface NearestResult {
  fountain: Fountain;
  distanceM: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function isCloser(candidate: NearestResult, best: NearestResult | null): boolean {
  if (best === null) return true;
  if (candidate.distanceM !== best.distanceM) return candidate.distanceM < best.distanceM;
  return candidate.fountain.id < best.fountain.id;
}

/**
 * Nearest working fountain, unless an unverified one is more than
 * UNVERIFIED_PREFERENCE_M closer. Exact distance ties go to the lowest id.
 */
export function findNearest(from: LatLon, fountains: readonly Fountain[]): NearestResult | null {
  let working: NearestResult | null = null;
  let unverified: NearestResult | null = null;
  for (const fountain of fountains) {
    const candidate = { fountain, distanceM: haversineMeters(from, fountain) };
    if (fountain.status === "working") {
      if (isCloser(candidate, working)) working = candidate;
    } else if (isCloser(candidate, unverified)) {
      unverified = candidate;
    }
  }
  if (working === null) return unverified;
  if (unverified !== null && unverified.distanceM < working.distanceM - UNVERIFIED_PREFERENCE_M) return unverified;
  return working;
}

export function walkingMinutes(distanceM: number): number {
  const metersPerMinute = (WALK_SPEED_KMH * 1000) / 60;
  return Math.max(1, Math.ceil((distanceM * WALK_DETOUR_FACTOR) / metersPerMinute));
}

export function formatDistance(distanceM: number): string {
  const roundedM = Math.round(distanceM / 10) * 10;
  if (roundedM < 1000) return `${roundedM} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

export function isNearZagreb(point: LatLon): boolean {
  return haversineMeters(point, DEFAULT_CENTER) <= NEAR_ZAGREB_RADIUS_M;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: every test in `distance.test.ts` and `fountains.test.ts` passes, and `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/geo/distance.ts tests/distance.test.ts
git commit -m "feat: add distance, nearest-fountain and walking-time logic

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Directions link builder

**Files:**
- Create: `src/ui/directions.ts`
- Test: `tests/directions.test.ts`

**Interfaces:**
- Consumes: `LatLon` from `src/geo/distance.ts`
- Produces:
  - `isAppleMobile(userAgent: string, maxTouchPoints: number): boolean`
  - `directionsUrl(destination: LatLon, userAgent: string, maxTouchPoints: number): string`

- [ ] **Step 1: Write the failing test `tests/directions.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { directionsUrl, isAppleMobile } from "../src/ui/directions";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const BRITANSKI_TRG = { lat: 45.8127489060025, lon: 15.9648762099405 };
const APPLE_URL = "https://maps.apple.com/?daddr=45.812749,15.964876&dirflg=w";
const GOOGLE_URL = "https://www.google.com/maps/dir/?api=1&destination=45.812749,15.964876&travelmode=walking";

describe("isAppleMobile", () => {
  it.each([
    ["iPhone", IPHONE, 5, true],
    ["iPad", IPAD, 5, true],
    ["iPadOS desktop mode (Mac UA with touch)", MAC_SAFARI, 5, true],
    ["Mac desktop (no touch)", MAC_SAFARI, 0, false],
    ["Android", ANDROID, 5, false],
    ["Windows desktop", WINDOWS, 0, false],
  ])("%s → %s", (_label, userAgent, touchPoints, expected) => {
    expect(isAppleMobile(userAgent, touchPoints)).toBe(expected);
  });
});

describe("directionsUrl", () => {
  it("uses Apple Maps walking directions on iOS", () => {
    expect(directionsUrl(BRITANSKI_TRG, IPHONE, 5)).toBe(APPLE_URL);
  });

  it("uses Apple Maps on iPadOS desktop mode", () => {
    expect(directionsUrl(BRITANSKI_TRG, MAC_SAFARI, 5)).toBe(APPLE_URL);
  });

  it("uses Google Maps walking directions on Android and desktop", () => {
    expect(directionsUrl(BRITANSKI_TRG, ANDROID, 5)).toBe(GOOGLE_URL);
    expect(directionsUrl(BRITANSKI_TRG, WINDOWS, 0)).toBe(GOOGLE_URL);
    expect(directionsUrl(BRITANSKI_TRG, MAC_SAFARI, 0)).toBe(GOOGLE_URL);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/directions.test.ts`
Expected: FAIL, with an error that `../src/ui/directions` can't be resolved.

- [ ] **Step 3: Implement `src/ui/directions.ts`**

```ts
import type { LatLon } from "../geo/distance";

/** iPadOS in desktop mode reports a Mac user agent, so touch support is the tell. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function directionsUrl(destination: LatLon, userAgent: string, maxTouchPoints: number): string {
  const coords = `${destination.lat.toFixed(6)},${destination.lon.toFixed(6)}`;
  if (isAppleMobile(userAgent, maxTouchPoints)) {
    return `https://maps.apple.com/?daddr=${coords}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=walking`;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass and `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/ui/directions.ts tests/directions.test.ts
git commit -m "feat: build Apple/Google Maps walking directions links

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Geolocation wrapper

**Files:**
- Create: `src/geo/location.ts`
- Test: `tests/location.test.ts`

**Interfaces:**
- Consumes: `GEOLOCATION_TIMEOUT_MS` from `src/config.ts`
- Produces:
  - `type LocationErrorReason = "denied" | "unavailable" | "timeout"`
  - `type LocationEvent = { type: "position"; lat: number; lon: number; accuracyM: number } | { type: "error"; reason: LocationErrorReason }`
  - `watchLocation(geolocation: Geolocation | undefined, onEvent: (event: LocationEvent) => void): () => void` (returns a function that stops watching)

- [ ] **Step 1: Write the failing test `tests/location.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { watchLocation, type LocationEvent } from "../src/geo/location";

function fakeGeolocation() {
  let onSuccess: PositionCallback = () => {};
  let onError: PositionErrorCallback = () => {};
  const watchPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
    onSuccess = success;
    onError = error ?? (() => {});
    return 7;
  });
  const clearWatch = vi.fn();
  return {
    geolocation: { watchPosition, clearWatch, getCurrentPosition: vi.fn() } as unknown as Geolocation,
    watchPosition,
    clearWatch,
    emit(latitude: number, longitude: number, accuracy: number) {
      onSuccess({ coords: { latitude, longitude, accuracy } } as GeolocationPosition);
    },
    fail(code: number) {
      onError({ code, message: "" } as GeolocationPositionError);
    },
  };
}

describe("watchLocation", () => {
  it("emits position events", () => {
    const fake = fakeGeolocation();
    const events: LocationEvent[] = [];
    watchLocation(fake.geolocation, (event) => events.push(event));

    fake.emit(45.8131, 15.9772, 12);

    expect(events).toEqual([{ type: "position", lat: 45.8131, lon: 15.9772, accuracyM: 12 }]);
  });

  it("requests high accuracy with a 10 s timeout", () => {
    const fake = fakeGeolocation();
    watchLocation(fake.geolocation, () => {});

    expect(fake.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ])("maps error code %d to %s", (code, reason) => {
    const fake = fakeGeolocation();
    const events: LocationEvent[] = [];
    watchLocation(fake.geolocation, (event) => events.push(event));

    fake.fail(code);

    expect(events).toEqual([{ type: "error", reason }]);
  });

  it("stops watching when the returned function is called", () => {
    const fake = fakeGeolocation();
    const stop = watchLocation(fake.geolocation, () => {});

    stop();

    expect(fake.clearWatch).toHaveBeenCalledWith(7);
  });

  it("reports unavailable when the browser has no geolocation", () => {
    const events: LocationEvent[] = [];
    const stop = watchLocation(undefined, (event) => events.push(event));

    expect(events).toEqual([{ type: "error", reason: "unavailable" }]);
    expect(() => stop()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/location.test.ts`
Expected: FAIL, with an error that `../src/geo/location` can't be resolved.

- [ ] **Step 3: Implement `src/geo/location.ts`**

```ts
import { GEOLOCATION_TIMEOUT_MS } from "../config";

export type LocationErrorReason = "denied" | "unavailable" | "timeout";

export type LocationEvent =
  | { type: "position"; lat: number; lon: number; accuracyM: number }
  | { type: "error"; reason: LocationErrorReason };

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

/** Starts watching the device position. Returns a function that stops watching. */
export function watchLocation(
  geolocation: Geolocation | undefined,
  onEvent: (event: LocationEvent) => void,
): () => void {
  if (!geolocation) {
    onEvent({ type: "error", reason: "unavailable" });
    return () => {};
  }
  const watchId = geolocation.watchPosition(
    (position) =>
      onEvent({
        type: "position",
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracyM: position.coords.accuracy,
      }),
    (error) =>
      onEvent({
        type: "error",
        reason: error.code === PERMISSION_DENIED ? "denied" : error.code === TIMEOUT ? "timeout" : "unavailable",
      }),
    { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 30_000 },
  );
  return () => geolocation.clearWatch(watchId);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass and `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/geo/location.ts tests/location.test.ts
git commit -m "feat: wrap Geolocation watchPosition in typed events

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Copy and the bottom card

**Files:**
- Create: `src/strings.ts`, `src/ui/nearestCard.ts`
- Test: `tests/nearestCard.test.ts`

**Interfaces:**
- Consumes: `Fountain` (Task 1); `formatDistance`, `walkingMinutes` (Task 2)
- Produces:
  - `strings` object (keys: `nearestFountain`, `selectedFountain`, `directions`, `retry`, `locating`, `enableLocation`, `outsideZagreb`, `unverified`, `cemetery`, `loadError`, `approx`, `walk(minutes)`)
  - `type FountainCardState = { kind: "fountain"; fountain: Fountain; distanceM: number | null; approx: boolean; isNearest: boolean; directionsUrl: string }`
  - `type CardState = { kind: "locating" } | { kind: "locationError" } | { kind: "outside" } | FountainCardState`
  - `escapeHtml(value: string): string`
  - `cardHtml(state: CardState): string`
  - `renderCard(container: HTMLElement, state: CardState, handlers: { onRetry: () => void }): void`

- [ ] **Step 1: Create `src/strings.ts`**

```ts
export const strings = {
  nearestFountain: "Nearest fountain",
  selectedFountain: "Fountain",
  directions: "Directions",
  retry: "Retry",
  locating: "Finding your location…",
  enableLocation: "Enable location to find the nearest fountain",
  outsideZagreb: "No fountains mapped near you. Showing Zagreb.",
  unverified: "Status not confirmed",
  cemetery: "Cemetery — follows cemetery opening hours",
  loadError: "Couldn't load fountain data.",
  approx: "approx.",
  walk: (minutes: number): string => `~${minutes} min walk`,
} as const;
```

- [ ] **Step 2: Write the failing test `tests/nearestCard.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Fountain } from "../src/data/fountains";
import { cardHtml, type FountainCardState } from "../src/ui/nearestCard";

const BRITANSKI_TRG: Fountain = {
  id: "8596b290-ea0d-4caa-8890-047804249320",
  lat: 45.812749,
  lon: 15.964876,
  location: "Britanski trg",
  hint: "sjeverno od javnog WC-a",
  status: "working",
  cemetery: false,
  type: "Viktorija zdenac",
};

function fountainState(overrides: Partial<FountainCardState> = {}): FountainCardState {
  return {
    kind: "fountain",
    fountain: BRITANSKI_TRG,
    distanceM: 244,
    approx: false,
    isNearest: true,
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=45.812749,15.964876&travelmode=walking",
    ...overrides,
  };
}

describe("cardHtml", () => {
  it("shows a locating message", () => {
    expect(cardHtml({ kind: "locating" })).toContain("Finding your location");
  });

  it("offers a retry button when location fails", () => {
    const html = cardHtml({ kind: "locationError" });
    expect(html).toContain("Enable location to find the nearest fountain");
    expect(html).toContain('data-action="retry"');
  });

  it("explains when the user is outside Zagreb", () => {
    expect(cardHtml({ kind: "outside" })).toContain("No fountains mapped near you. Showing Zagreb.");
  });

  it("renders the nearest fountain with distance, walking time and directions", () => {
    const html = cardHtml(fountainState());
    expect(html).toContain("Nearest fountain");
    expect(html).toContain("Britanski trg");
    expect(html).toContain("sjeverno od javnog WC-a");
    expect(html).toContain("240 m · ~4 min walk");
    expect(html).toContain(
      'href="https://www.google.com/maps/dir/?api=1&amp;destination=45.812749,15.964876&amp;travelmode=walking"',
    );
    expect(html).not.toContain("Status not confirmed");
    expect(html).not.toContain("Cemetery");
  });

  it("labels a tapped fountain that is not the nearest", () => {
    const html = cardHtml(fountainState({ isNearest: false }));
    expect(html).toContain(">Fountain<");
    expect(html).not.toContain("Nearest fountain");
  });

  it("prefixes approx. when accuracy is low", () => {
    expect(cardHtml(fountainState({ approx: true }))).toContain("approx. 240 m · ~4 min walk");
  });

  it("omits the distance line when distance is unknown", () => {
    expect(cardHtml(fountainState({ distanceM: null }))).not.toContain("min walk");
  });

  it("shows badges for unverified and cemetery fountains", () => {
    const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, status: "unverified", cemetery: true } }));
    expect(html).toContain("Status not confirmed");
    expect(html).toContain("Cemetery — follows cemetery opening hours");
  });

  it("escapes HTML coming from the data", () => {
    const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, location: "<img src=x onerror=alert(1)>" } }));
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/nearestCard.test.ts`
Expected: FAIL, with an error that `../src/ui/nearestCard` can't be resolved.

- [ ] **Step 4: Implement `src/ui/nearestCard.ts`**

```ts
import type { Fountain } from "../data/fountains";
import { formatDistance, walkingMinutes } from "../geo/distance";
import { strings } from "../strings";

export type FountainCardState = {
  kind: "fountain";
  fountain: Fountain;
  distanceM: number | null;
  approx: boolean;
  isNearest: boolean;
  directionsUrl: string;
};

export type CardState = { kind: "locating" } | { kind: "locationError" } | { kind: "outside" } | FountainCardState;

const BUTTON_CLASS =
  "mt-3 block w-full rounded-xl bg-sky-700 px-4 py-3 text-center font-semibold text-white active:bg-sky-800";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const panel = (inner: string): string =>
  `<div class="mx-auto max-w-md rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-900/5">${inner}</div>`;
const message = (text: string): string => `<p class="text-slate-700">${escapeHtml(text)}</p>`;
const badge = (text: string): string =>
  `<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">${escapeHtml(text)}</span>`;

function fountainHtml({ fountain, distanceM, approx, isNearest, directionsUrl }: FountainCardState): string {
  const label = isNearest ? strings.nearestFountain : strings.selectedFountain;
  const parts = [
    `<p class="text-xs font-semibold uppercase tracking-wide text-sky-700">${escapeHtml(label)}</p>`,
    `<h2 class="mt-1 text-lg font-semibold leading-snug">${escapeHtml(fountain.location)}</h2>`,
  ];
  if (fountain.hint) {
    parts.push(`<p class="mt-0.5 text-sm text-slate-500">${escapeHtml(fountain.hint)}</p>`);
  }
  if (distanceM !== null) {
    const distance = `${approx ? `${strings.approx} ` : ""}${formatDistance(distanceM)}`;
    const line = `${distance} · ${strings.walk(walkingMinutes(distanceM))}`;
    parts.push(`<p class="mt-2 font-medium text-slate-800">${escapeHtml(line)}</p>`);
  }
  const badges: string[] = [];
  if (fountain.status === "unverified") badges.push(badge(strings.unverified));
  if (fountain.cemetery) badges.push(badge(strings.cemetery));
  if (badges.length > 0) {
    parts.push(`<div class="mt-2 flex flex-wrap gap-2">${badges.join("")}</div>`);
  }
  parts.push(
    `<a href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener" class="${BUTTON_CLASS}">${escapeHtml(strings.directions)}</a>`,
  );
  return parts.join("");
}

export function cardHtml(state: CardState): string {
  switch (state.kind) {
    case "locating":
      return panel(message(strings.locating));
    case "locationError":
      return panel(
        `${message(strings.enableLocation)}<button type="button" data-action="retry" class="${BUTTON_CLASS}">${escapeHtml(strings.retry)}</button>`,
      );
    case "outside":
      return panel(message(strings.outsideZagreb));
    case "fountain":
      return panel(fountainHtml(state));
  }
}

export function renderCard(container: HTMLElement, state: CardState, handlers: { onRetry: () => void }): void {
  container.innerHTML = cardHtml(state);
  container.querySelector<HTMLButtonElement>('[data-action="retry"]')?.addEventListener("click", handlers.onRetry);
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass and `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/strings.ts src/ui/nearestCard.ts tests/nearestCard.test.ts
git commit -m "feat: render the fountain card states with escaped content

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: City data normalization and validation

**Files:**
- Create: `scripts/lib/fountain-data.ts`
- Create: `tests/fixtures/zdenci-sample.geojson`, `tests/fixtures/package-show-sample.json`
- Test: `tests/fountain-data.test.ts`

**Interfaces:**
- Consumes: `Fountain`, `Snapshot` (Task 1)
- Produces:
  - `class DataValidationError extends Error`
  - `interface CkanResource { format?: string; url: string; last_modified?: string | null }`
  - `interface ZdenciCollection` / `ZdenacFeature` / `ZdenacProperties` (raw city GeoJSON shapes)
  - `interface Exclusion { id: string; location: string; reason: string }`
  - `ZAGREB_BBOX`
  - `selectGeoJsonResource(packageShow: unknown): CkanResource`
  - `normalizeFeatures(input: unknown): { fountains: Fountain[]; excluded: Exclusion[] }`
  - `assertCountPlausible(nextCount: number, previousCount: number | null): void`
  - `sameFountains(a: readonly Fountain[], b: readonly Fountain[]): boolean`
  - `buildSnapshot(fountains: Fountain[], sourceModified: string | null | undefined, now: Date): Snapshot`

- [ ] **Step 1: Create `tests/fixtures/zdenci-sample.geojson`**

These are six real features from the city dataset (downloaded 2026-09-15), trimmed to the relevant properties. Together they cover working, not working, null status, `treba teren`, cemetery maintainer, empty hint, and a trailing space in a hint. They are deliberately out of id order.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.9648762099405, 45.8127489060025] },
      "properties": {
        "objectid": 1,
        "globalid": "8596b290-ea0d-4caa-8890-047804249320",
        "lokacija": "Britanski trg",
        "napomena_teren": "sjeverno od javnog WC-a",
        "status_odrz": "u funkciji",
        "odrzava_ki": "Gradski ured za mjesnu samoupravu, promet, komunalne poslove, civilnu zaštitu i sigurnost",
        "tip_zdenca": "Viktorija zdenac",
        "aktivan_da_ne": "DA"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.9075755741544, 45.7241629467747] },
      "properties": {
        "objectid": 2,
        "globalid": "a3c6b83f-56ab-4f27-94d7-00846fc73ed2",
        "lokacija": "Brezovička cesta 100",
        "napomena_teren": "uz poštu, preko puta autobusne stanice",
        "status_odrz": "nije u funkciji",
        "odrzava_ki": "Gradski ured za mjesnu samoupravu, promet, komunalne poslove, civilnu zaštitu i sigurnost",
        "tip_zdenca": "Viktorija zdenac",
        "aktivan_da_ne": "DA"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [16.0207448524108, 45.8408410019109] },
      "properties": {
        "objectid": 3,
        "globalid": "3c30aa94-0f69-4509-9a8d-c26c71107a14",
        "lokacija": "Čret, Melinišće",
        "napomena_teren": null,
        "status_odrz": null,
        "odrzava_ki": "Gradski ured za mjesnu samoupravu, promet, komunalne poslove, civilnu zaštitu i sigurnost",
        "tip_zdenca": "Viktorija zdenac",
        "aktivan_da_ne": "DA"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.9628974617954, 45.7749505418414] },
      "properties": {
        "objectid": 4,
        "globalid": "3be68cf0-1f79-4c8d-ac2b-285a8da09842",
        "lokacija": "Školsko igralište OŠ Trnsko",
        "napomena_teren": "(potreban popravak!, curi) sjeveroistocno od igralista ",
        "status_odrz": "treba teren",
        "odrzava_ki": "Gradski ured za mjesnu samoupravu, promet, komunalne poslove, civilnu zaštitu i sigurnost",
        "tip_zdenca": "Viktorija zdenac",
        "aktivan_da_ne": "DA"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.9894089129953, 45.8331599667715] },
      "properties": {
        "objectid": 5,
        "globalid": "723802ff-5fce-40c0-889d-fabbd29f4f79",
        "lokacija": "Groblje Mirogoj - jug",
        "napomena_teren": "izvorno SKI lokacija",
        "status_odrz": "u funkciji",
        "odrzava_ki": "Gradska groblja Zagreb",
        "tip_zdenca": "Viktorija zdenac",
        "aktivan_da_ne": "DA"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.9970064797527, 45.8118112909066] },
      "properties": {
        "objectid": 6,
        "globalid": "94ad52d5-a065-4d7d-999d-5e6be333fb9d",
        "lokacija": "Park Bartula Kašića - uz ogradu dječjeg parka",
        "napomena_teren": "",
        "status_odrz": "u funkciji",
        "odrzava_ki": "Gradski ured za mjesnu samoupravu, promet, komunalne poslove, civilnu zaštitu i sigurnost",
        "tip_zdenca": "Viktorija zdenac",
        "aktivan_da_ne": "DA"
      }
    }
  ]
}
```

- [ ] **Step 2: Create `tests/fixtures/package-show-sample.json`**

The response is shaped like the real CKAN `package_show` output. A CSV resource comes first, so the test proves the code selects by format.

```json
{
  "success": true,
  "result": {
    "name": "geoportal_javni_zdenci",
    "resources": [
      {
        "format": "CSV",
        "name": "Geoportal Javni zdenci (CSV)",
        "url": "https://data.zagreb.hr/example/data.csv",
        "last_modified": "2026-09-14T11:08:20.000000"
      },
      {
        "format": "GeoJSON",
        "name": "Geoportal Javni zdenci",
        "url": "https://data.zagreb.hr/dataset/0d1c65b5-6e8f-4b6a-be90-cc9ecb6fa374/resource/2010797b-3e1e-4a43-9a5a-b1619722d2ac/download/data.geojson",
        "last_modified": "2026-09-14T11:08:23.379555"
      }
    ]
  }
}
```

- [ ] **Step 3: Write the failing test `tests/fountain-data.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Fountain } from "../src/data/fountains";
import {
  assertCountPlausible,
  buildSnapshot,
  DataValidationError,
  normalizeFeatures,
  sameFountains,
  selectGeoJsonResource,
  type ZdenciCollection,
} from "../scripts/lib/fountain-data";

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

const zdenci = (): ZdenciCollection => readFixture("zdenci-sample.geojson") as ZdenciCollection;

const EXPECTED: Fountain[] = [
  {
    id: "3be68cf0-1f79-4c8d-ac2b-285a8da09842",
    lat: 45.774951,
    lon: 15.962897,
    location: "Školsko igralište OŠ Trnsko",
    hint: "(potreban popravak!, curi) sjeveroistocno od igralista",
    status: "unverified",
    cemetery: false,
    type: "Viktorija zdenac",
  },
  {
    id: "3c30aa94-0f69-4509-9a8d-c26c71107a14",
    lat: 45.840841,
    lon: 16.020745,
    location: "Čret, Melinišće",
    status: "unverified",
    cemetery: false,
    type: "Viktorija zdenac",
  },
  {
    id: "723802ff-5fce-40c0-889d-fabbd29f4f79",
    lat: 45.83316,
    lon: 15.989409,
    location: "Groblje Mirogoj - jug",
    hint: "izvorno SKI lokacija",
    status: "working",
    cemetery: true,
    type: "Viktorija zdenac",
  },
  {
    id: "8596b290-ea0d-4caa-8890-047804249320",
    lat: 45.812749,
    lon: 15.964876,
    location: "Britanski trg",
    hint: "sjeverno od javnog WC-a",
    status: "working",
    cemetery: false,
    type: "Viktorija zdenac",
  },
  {
    id: "94ad52d5-a065-4d7d-999d-5e6be333fb9d",
    lat: 45.811811,
    lon: 15.997006,
    location: "Park Bartula Kašića - uz ogradu dječjeg parka",
    status: "working",
    cemetery: false,
    type: "Viktorija zdenac",
  },
];

describe("normalizeFeatures", () => {
  it("keeps working and unverified fountains, sorted by id", () => {
    expect(normalizeFeatures(zdenci()).fountains).toEqual(EXPECTED);
  });

  it("excludes fountains marked as not working, with a reason", () => {
    expect(normalizeFeatures(zdenci()).excluded).toEqual([
      {
        id: "a3c6b83f-56ab-4f27-94d7-00846fc73ed2",
        location: "Brezovička cesta 100",
        reason: "not working (nije u funkciji)",
      },
    ]);
  });

  it("rejects input that is not a feature collection", () => {
    expect(() => normalizeFeatures({})).toThrow(DataValidationError);
  });

  it("rejects a feature without globalid", () => {
    const collection = zdenci();
    collection.features[0]!.properties!.globalid = null;
    expect(() => normalizeFeatures(collection)).toThrow(/missing globalid/);
  });

  it("rejects a feature with a blank lokacija", () => {
    const collection = zdenci();
    collection.features[0]!.properties!.lokacija = "   ";
    expect(() => normalizeFeatures(collection)).toThrow(/missing lokacija/);
  });

  it("rejects non-point geometry", () => {
    const collection = zdenci();
    collection.features[0]!.geometry = { type: "LineString", coordinates: [[15.9, 45.8], [15.91, 45.81]] };
    expect(() => normalizeFeatures(collection)).toThrow(/Point geometry/);
  });

  it("rejects projected (non-WGS84) coordinates", () => {
    const collection = zdenci();
    collection.features[0]!.geometry = { type: "Point", coordinates: [458412.11, 5074904.8] };
    expect(() => normalizeFeatures(collection)).toThrow(/outside Zagreb/);
  });
});

describe("selectGeoJsonResource", () => {
  it("picks the GeoJSON resource", () => {
    const resource = selectGeoJsonResource(readFixture("package-show-sample.json"));
    expect(resource.url).toMatch(/data\.geojson$/);
    expect(resource.last_modified).toBe("2026-09-14T11:08:23.379555");
  });

  it("rejects an unsuccessful response", () => {
    expect(() => selectGeoJsonResource({ success: false })).toThrow(DataValidationError);
  });

  it("rejects a dataset without GeoJSON", () => {
    const response = { success: true, result: { resources: [{ format: "CSV", url: "https://example.com/a.csv" }] } };
    expect(() => selectGeoJsonResource(response)).toThrow(/no GeoJSON/);
  });
});

describe("assertCountPlausible", () => {
  it("accepts a first run and small changes", () => {
    expect(() => assertCountPlausible(199, null)).not.toThrow();
    expect(() => assertCountPlausible(193, 199)).not.toThrow();
    expect(() => assertCountPlausible(100, 199)).not.toThrow();
  });

  it("rejects a drop below 50% of the previous count", () => {
    expect(() => assertCountPlausible(99, 199)).toThrow(DataValidationError);
  });

  it("rejects an empty result", () => {
    expect(() => assertCountPlausible(0, null)).toThrow(/no usable fountains/);
  });
});

describe("sameFountains", () => {
  it("is true for identical lists", () => {
    expect(sameFountains(EXPECTED, structuredClone(EXPECTED))).toBe(true);
  });

  it("is false when any field differs", () => {
    const changed = structuredClone(EXPECTED);
    changed[0]!.hint = "changed";
    expect(sameFountains(EXPECTED, changed)).toBe(false);
    expect(sameFountains(EXPECTED, EXPECTED.slice(1))).toBe(false);
  });
});

describe("buildSnapshot", () => {
  it("wraps fountains with metadata", () => {
    expect(buildSnapshot(EXPECTED, "2026-09-14T11:08:23.379555", new Date("2026-09-15T04:00:00Z"))).toEqual({
      generatedAt: "2026-09-15T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 5,
      fountains: EXPECTED,
    });
  });

  it("uses an empty string when the source has no modified date", () => {
    expect(buildSnapshot(EXPECTED, null, new Date(0)).sourceModified).toBe("");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/fountain-data.test.ts`
Expected: FAIL, with an error that `../scripts/lib/fountain-data` can't be resolved.

- [ ] **Step 5: Implement `scripts/lib/fountain-data.ts`**

```ts
import type { Fountain, Snapshot } from "../../src/data/fountains";

export const ZAGREB_BBOX = { minLat: 45.6, maxLat: 46.0, minLon: 15.7, maxLon: 16.3 } as const;

const STATUS_WORKING = "u funkciji";
const STATUS_NOT_WORKING = "nije u funkciji";
const CEMETERY_MAINTAINER = "Gradska groblja";
const MIN_COUNT_RATIO = 0.5;

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataValidationError";
  }
}

export interface CkanResource {
  format?: string;
  url: string;
  last_modified?: string | null;
}

export interface ZdenacProperties {
  globalid?: string | null;
  lokacija?: string | null;
  napomena_teren?: string | null;
  status_odrz?: string | null;
  odrzava_ki?: string | null;
  tip_zdenca?: string | null;
  [key: string]: unknown;
}

export interface ZdenacFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: ZdenacProperties | null;
}

export interface ZdenciCollection {
  type: "FeatureCollection";
  features: ZdenacFeature[];
}

export interface Exclusion {
  id: string;
  location: string;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

export function selectGeoJsonResource(packageShow: unknown): CkanResource {
  if (
    !isRecord(packageShow) ||
    packageShow.success !== true ||
    !isRecord(packageShow.result) ||
    !Array.isArray(packageShow.result.resources)
  ) {
    throw new DataValidationError("Unexpected package_show response");
  }
  const resource = (packageShow.result.resources as CkanResource[]).find(
    (candidate) =>
      typeof candidate.format === "string" &&
      candidate.format.toLowerCase() === "geojson" &&
      typeof candidate.url === "string",
  );
  if (!resource) throw new DataValidationError("Dataset has no GeoJSON resource");
  return resource;
}

export function normalizeFeatures(input: unknown): { fountains: Fountain[]; excluded: Exclusion[] } {
  if (!isRecord(input) || !Array.isArray(input.features)) {
    throw new DataValidationError("Expected a GeoJSON FeatureCollection with a features array");
  }
  const fountains: Fountain[] = [];
  const excluded: Exclusion[] = [];

  (input.features as ZdenacFeature[]).forEach((feature, index) => {
    const props: ZdenacProperties = feature.properties ?? {};
    const id = clean(props.globalid);
    if (!id) throw new DataValidationError(`Feature at index ${index} is missing globalid`);
    const location = clean(props.lokacija);
    if (!location) throw new DataValidationError(`Feature ${id} is missing lokacija`);

    const coordinates = feature.geometry?.type === "Point" ? feature.geometry.coordinates : undefined;
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
      throw new DataValidationError(`Feature ${id} does not have Point geometry`);
    }
    const [lon, lat] = coordinates as [number, number];
    if (lat < ZAGREB_BBOX.minLat || lat > ZAGREB_BBOX.maxLat || lon < ZAGREB_BBOX.minLon || lon > ZAGREB_BBOX.maxLon) {
      throw new DataValidationError(`Feature ${id} has coordinates outside Zagreb (${lat}, ${lon})`);
    }

    const status = clean(props.status_odrz);
    if (status === STATUS_NOT_WORKING) {
      excluded.push({ id, location, reason: `not working (${STATUS_NOT_WORKING})` });
      return;
    }
    const hint = clean(props.napomena_teren);
    const type = clean(props.tip_zdenca);
    fountains.push({
      id,
      lat: round6(lat),
      lon: round6(lon),
      location,
      ...(hint ? { hint } : {}),
      status: status === STATUS_WORKING ? "working" : "unverified",
      cemetery: (clean(props.odrzava_ki) ?? "").includes(CEMETERY_MAINTAINER),
      ...(type ? { type } : {}),
    });
  });

  fountains.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { fountains, excluded };
}

export function assertCountPlausible(nextCount: number, previousCount: number | null): void {
  if (nextCount === 0) {
    throw new DataValidationError("Source returned no usable fountains");
  }
  if (previousCount !== null && nextCount < previousCount * MIN_COUNT_RATIO) {
    throw new DataValidationError(
      `Only ${nextCount} fountains, less than half of the previous ${previousCount}; refusing to overwrite`,
    );
  }
}

export function sameFountains(a: readonly Fountain[], b: readonly Fountain[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildSnapshot(
  fountains: Fountain[],
  sourceModified: string | null | undefined,
  now: Date,
): Snapshot {
  return {
    generatedAt: now.toISOString(),
    sourceModified: sourceModified ?? "",
    count: fountains.length,
    fountains,
  };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass and `tsc` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/fountain-data.ts tests/fixtures tests/fountain-data.test.ts
git commit -m "feat: normalize and validate City of Zagreb fountain GeoJSON

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Fetch script and first data snapshot

**Files:**
- Create: `scripts/fetch-fountains.ts`
- Create (generated): `public/data/fountains.json`

**Interfaces:**
- Consumes: everything exported from `scripts/lib/fountain-data.ts` (Task 6); `Snapshot` (Task 1)
- Produces: `npm run fetch-data`, which writes `public/data/fountains.json` only when the fountain list changed and exits non-zero on any validation failure. The browser loads this file in Task 8.

This script is a thin IO wrapper around the functions tested in Task 6, so it gets no unit test. It's verified by running it against the live portal.

- [ ] **Step 1: Implement `scripts/fetch-fountains.ts`**

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Snapshot } from "../src/data/fountains";
import {
  assertCountPlausible,
  buildSnapshot,
  normalizeFeatures,
  sameFountains,
  selectGeoJsonResource,
} from "./lib/fountain-data";

const PACKAGE_SHOW_URL = "https://data.zagreb.hr/api/3/action/package_show?id=geoportal_javni_zdenci";
const OUTPUT_PATH = "public/data/fountains.json";
const REQUEST_HEADERS = { "User-Agent": "zagreb-fountains-data-refresh/1.0", Accept: "application/json" };

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return response.json();
}

async function readPreviousSnapshot(): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as Snapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function main(): Promise<void> {
  const resource = selectGeoJsonResource(await getJson(PACKAGE_SHOW_URL));
  console.log(`Downloading ${resource.url}`);
  const { fountains, excluded } = normalizeFeatures(await getJson(resource.url));

  const unverified = fountains.filter((fountain) => fountain.status === "unverified").length;
  const cemetery = fountains.filter((fountain) => fountain.cemetery).length;
  console.log(`Kept ${fountains.length} fountains (${unverified} unverified, ${cemetery} cemetery)`);
  console.log(`Excluded ${excluded.length}:`);
  for (const exclusion of excluded) {
    console.log(`  - ${exclusion.id} ${exclusion.location}: ${exclusion.reason}`);
  }

  const previous = await readPreviousSnapshot();
  assertCountPlausible(fountains.length, previous?.count ?? null);
  if (previous && sameFountains(previous.fountains, fountains)) {
    console.log("No changes to fountains; snapshot left untouched.");
    return;
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const snapshot = buildSnapshot(fountains, resource.last_modified, new Date());
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 3: Run against the live portal**

Run: `npm run fetch-data`
Expected (counts as of 2026-09-15; they may drift slightly):
```
Downloading https://data.zagreb.hr/dataset/.../download/data.geojson
Kept 193 fountains (25 unverified, 39 cemetery)
Excluded 6:
  - a3c6b83f-56ab-4f27-94d7-00846fc73ed2 Brezovička cesta 100: not working (nije u funkciji)
  ...
Wrote public/data/fountains.json
```
If it exits with a `DataValidationError`, stop and report the message. Don't loosen the guard to make the run pass.

- [ ] **Step 4: Run again to confirm it skips unchanged data**

Run: `npm run fetch-data && git status --short public/data`
Expected: the log ends with `No changes to fountains; snapshot left untouched.`, and `git status` still shows the file only as untracked (`??`), not rewritten.

- [ ] **Step 5: Spot-check the snapshot**

Run: `node -e 'const s=require("./public/data/fountains.json");console.log(s.count, s.fountains.length, s.sourceModified, s.fountains.find(f=>f.location==="Britanski trg"))'`
Expected: `193 193 2026-09-14T11:08:23.379555`, or whatever the current values are, with `count` equal to `fountains.length`, followed by a Britanski trg record with `status: 'working'`.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-fountains.ts public/data/fountains.json
git commit -m "feat: fetch fountain snapshot from data.zagreb.hr

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Map and app wiring

**Files:**
- Create: `src/map/map.ts`
- Modify: `src/main.ts` (replace the Task 1 placeholder entirely)

**Interfaces:**
- Consumes: `config` (Task 2), `Fountain`/`loadFountains` (Task 1), `findNearest`/`haversineMeters`/`isNearZagreb`/`LatLon`/`NearestResult` (Task 2), `directionsUrl` (Task 3), `watchLocation`/`LocationEvent` (Task 4), `strings`/`renderCard`/`escapeHtml`/`CardState` (Task 5), `public/data/fountains.json` (Task 7)
- Produces:
  - `interface UserPosition extends LatLon { accuracyM: number }`
  - `interface FountainMap { setFountains(fountains: readonly Fountain[]): void; setUserPosition(position: UserPosition): void; highlight(id: string | null): void; fitTo(points: readonly LatLon[]): void; onFountainTap(callback: (fountain: Fountain) => void): void }`
  - `createFountainMap(container: HTMLElement): FountainMap`
  - A running app. Task 9 depends on these DOM hooks: `#card` text, `path.leaflet-interactive` fountain markers, and the `Directions` link.

Leaflet needs a real DOM and `main.ts` is wiring only, so neither has unit tests. They're verified end-to-end in Task 9.

- [ ] **Step 1: Implement `src/map/map.ts`**

```ts
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  DATA_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LOW_ACCURACY_M,
  TILE_ATTRIBUTION,
  TILE_MAX_ZOOM,
  TILE_URL,
} from "../config";
import type { Fountain } from "../data/fountains";
import type { LatLon } from "../geo/distance";

export interface UserPosition extends LatLon {
  accuracyM: number;
}

export interface FountainMap {
  setFountains(fountains: readonly Fountain[]): void;
  setUserPosition(position: UserPosition): void;
  highlight(id: string | null): void;
  fitTo(points: readonly LatLon[]): void;
  onFountainTap(callback: (fountain: Fountain) => void): void;
}

const FOUNTAIN_RADIUS = 9;
const HIGHLIGHT_RADIUS = 13;
const HIGHLIGHT_STYLE: L.PathOptions = { color: "#f59e0b", weight: 4 };

function fountainStyle(fountain: Fountain): L.PathOptions {
  return {
    color: "#ffffff",
    weight: 2,
    fillColor: fountain.status === "working" ? "#0369a1" : "#94a3b8",
    fillOpacity: 1,
  };
}

export function createFountainMap(container: HTMLElement): FountainMap {
  const map = L.map(container, { attributionControl: false, zoomControl: false }).setView(
    [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
    DEFAULT_ZOOM,
  );
  L.tileLayer(TILE_URL, { maxZoom: TILE_MAX_ZOOM }).addTo(map);
  // Both controls share the top-right corner so they stack instead of overlapping,
  // and the bottom card never covers the required attribution.
  L.control
    .attribution({ position: "topright" })
    .addAttribution(TILE_ATTRIBUTION)
    .addAttribution(DATA_ATTRIBUTION)
    .addTo(map);
  L.control.zoom({ position: "topright" }).addTo(map);

  const markers = new Map<string, { marker: L.CircleMarker; fountain: Fountain }>();
  let highlightedId: string | null = null;
  let onTap: (fountain: Fountain) => void = () => {};
  let userMarker: L.CircleMarker | null = null;
  let accuracyCircle: L.Circle | null = null;

  function highlight(id: string | null): void {
    const previous = highlightedId === null ? undefined : markers.get(highlightedId);
    previous?.marker.setRadius(FOUNTAIN_RADIUS).setStyle(fountainStyle(previous.fountain));
    highlightedId = id;
    const next = id === null ? undefined : markers.get(id);
    next?.marker.setRadius(HIGHLIGHT_RADIUS).setStyle(HIGHLIGHT_STYLE).bringToFront();
  }

  function setFountains(fountains: readonly Fountain[]): void {
    for (const { marker } of markers.values()) marker.remove();
    markers.clear();
    for (const fountain of fountains) {
      const marker = L.circleMarker([fountain.lat, fountain.lon], {
        ...fountainStyle(fountain),
        radius: FOUNTAIN_RADIUS,
      }).addTo(map);
      marker.on("click", () => onTap(fountain));
      markers.set(fountain.id, { marker, fountain });
    }
    const current = highlightedId;
    highlightedId = null;
    highlight(current);
  }

  function setUserPosition(position: UserPosition): void {
    const latLng = L.latLng(position.lat, position.lon);
    if (position.accuracyM > LOW_ACCURACY_M) {
      if (accuracyCircle) {
        accuracyCircle.setLatLng(latLng).setRadius(position.accuracyM);
      } else {
        accuracyCircle = L.circle(latLng, {
          radius: position.accuracyM,
          color: "#2563eb",
          weight: 1,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
      }
    } else {
      accuracyCircle?.remove();
      accuracyCircle = null;
    }
    if (userMarker) {
      userMarker.setLatLng(latLng);
    } else {
      userMarker = L.circleMarker(latLng, {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
    }
    userMarker.bringToFront();
  }

  function fitTo(points: readonly LatLon[]): void {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((point) => L.latLng(point.lat, point.lon)));
    // Extra bottom padding keeps both points above the card.
    map.fitBounds(bounds, { paddingTopLeft: [48, 48], paddingBottomRight: [48, 240], maxZoom: 17 });
  }

  return {
    setFountains,
    setUserPosition,
    highlight,
    fitTo,
    onFountainTap(callback) {
      onTap = callback;
    },
  };
}
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import "./style.css";
import { LOW_ACCURACY_M, RECOMPUTE_DISTANCE_M } from "./config";
import { loadFountains, type Fountain } from "./data/fountains";
import { findNearest, haversineMeters, isNearZagreb, type LatLon, type NearestResult } from "./geo/distance";
import { watchLocation, type LocationEvent } from "./geo/location";
import { createFountainMap, type UserPosition } from "./map/map";
import { strings } from "./strings";
import { directionsUrl } from "./ui/directions";
import { escapeHtml, renderCard, type CardState } from "./ui/nearestCard";

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

const map = createFountainMap(byId("map"));
const cardElement = byId("card");
const fatalElement = byId("fatal");

let fountains: Fountain[] = [];
let position: UserPosition | null = null;
let locationFailed = false;
let computedAt: LatLon | null = null;
let nearest: NearestResult | null = null;
/** A fountain the user tapped; null means "show the nearest". */
let tapped: Fountain | null = null;
let hasFitted = false;
let stopWatching: () => void = () => {};

function cardState(shown: Fountain | null): CardState {
  const near = position !== null && isNearZagreb(position);
  if (shown) {
    return {
      kind: "fountain",
      fountain: shown,
      distanceM: near && position ? haversineMeters(position, shown) : null,
      approx: near && position !== null && position.accuracyM > LOW_ACCURACY_M,
      isNearest: nearest?.fountain.id === shown.id,
      directionsUrl: directionsUrl(shown, navigator.userAgent, navigator.maxTouchPoints),
    };
  }
  if (position && !near) return { kind: "outside" };
  if (locationFailed) return { kind: "locationError" };
  return { kind: "locating" };
}

function update(): void {
  const shown = tapped ?? nearest?.fountain ?? null;
  map.highlight(shown?.id ?? null);
  renderCard(cardElement, cardState(shown), { onRetry: startLocation });
}

function handleLocation(event: LocationEvent): void {
  if (event.type === "error") {
    // Keep showing the last known position if we ever had one.
    if (position === null) {
      locationFailed = true;
      update();
    }
    return;
  }
  locationFailed = false;
  position = { lat: event.lat, lon: event.lon, accuracyM: event.accuracyM };
  map.setUserPosition(position);

  if (!isNearZagreb(position)) {
    nearest = null;
    computedAt = null;
    hasFitted = false; // re-frame the map when the user comes back into range
    update();
    return;
  }
  if (computedAt && haversineMeters(computedAt, position) < RECOMPUTE_DISTANCE_M) return;

  computedAt = { lat: position.lat, lon: position.lon };
  nearest = findNearest(position, fountains);
  if (nearest && !hasFitted) {
    map.fitTo([position, nearest.fountain]);
    hasFitted = true;
  }
  update();
}

function startLocation(): void {
  stopWatching();
  locationFailed = false;
  update();
  stopWatching = watchLocation("geolocation" in navigator ? navigator.geolocation : undefined, handleLocation);
}

function showFatal(): void {
  fatalElement.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
    <p class="text-lg font-medium">${escapeHtml(strings.loadError)}</p>
    <button type="button" class="rounded-xl bg-sky-700 px-6 py-3 font-semibold text-white">${escapeHtml(strings.retry)}</button>
  </div>`;
  fatalElement.classList.remove("hidden");
  fatalElement.querySelector("button")?.addEventListener("click", () => void boot());
}

async function boot(): Promise<void> {
  fatalElement.classList.add("hidden");
  try {
    fountains = await loadFountains(`${import.meta.env.BASE_URL}data/fountains.json`);
  } catch (error) {
    console.error(error);
    showFatal();
    return;
  }
  map.setFountains(fountains);
  startLocation();
}

map.onFountainTap((fountain) => {
  // Tapping the nearest fountain returns to "follow nearest" mode.
  tapped = nearest?.fountain.id === fountain.id ? null : fountain;
  update();
});

void boot();
```

- [ ] **Step 3: Typecheck, test, and build**

Run: `npm run typecheck && npm test && npm run build && ls dist/data`
Expected: no `tsc` output, all tests pass, `✓ built in`, and `fountains.json` listed under `dist/data`.

- [ ] **Step 4: Smoke-run the dev server**

Run: `npm run dev`, then open the printed URL (default `http://localhost:5173/`) in a desktop browser.

Expected:
- The map is centered on the old town and shows about 190 blue and grey dots.
- The top-right corner shows the attribution, including "Izvor podataka: Grad Zagreb", with the +/− buttons directly below it and not overlapping.
- The card shows "Finding your location…". After you allow location it shows either a fountain or "No fountains mapped near you. Showing Zagreb."
- The browser console has no errors.

Stop the server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/map/map.ts src/main.ts
git commit -m "feat: wire map, geolocation and card into the app

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification with Playwright

**Files:**
- Create: `playwright.config.ts`, `e2e/verify.spec.ts`
- Modify: `package.json` (adds the `@playwright/test` devDependency via npm)

**Interfaces:**
- Consumes: the built app from Task 8 (`#card`, `path.leaflet-interactive`, `Directions` link)
- Produces: `npm run verify`, which builds and serves the production bundle, runs the four spec scenarios at 390×844, and writes screenshots to `e2e/screenshots/`. Run it manually; it isn't part of CI because it depends on live map tiles.

- [ ] **Step 1: Install Playwright and Chromium**

Run: `npm install -D @playwright/test@^1.63.0 && npx playwright install chromium`
Expected: installs finish; Chromium downloads.

- [ ] **Step 2: Create `playwright.config.ts`**

The fixed Android user agent makes the Directions link the Google Maps variant on any host OS.

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.results",
  timeout: 45_000,
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Create `e2e/verify.spec.ts`**

In the denied case, headless Chromium never answers the permission prompt, so the app's 10 s timeout fires. That path shows the same "Enable location" card, which is why the wait is 20 s.

```ts
import { expect, test, type Page } from "@playwright/test";

const SCREENSHOTS = "e2e/screenshots";
const WALK_LINE = /(\d+ m|\d+\.\d km) · ~\d+ min walk/;

async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("path.leaflet-interactive")).not.toHaveCount(0);
}

test.describe("at Ban Jelačić Square", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 }, permissions: ["geolocation"] });

  test("highlights the nearest fountain with directions", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Nearest fountain");
    await expect(card).toContainText(WALK_LINE);
    await expect(card.getByRole("link", { name: "Directions" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=45\.\d{6},15\.\d{6}&travelmode=walking$/,
    );
    await page.screenshot({ path: `${SCREENSHOTS}/1-ban-jelacic.png` });
  });
});

test.describe("in Maksimir Park", () => {
  test.use({ geolocation: { latitude: 45.8229, longitude: 16.0176, accuracy: 20 }, permissions: ["geolocation"] });

  test("highlights the nearest fountain", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Nearest fountain");
    await expect(card).toContainText(WALK_LINE);
    await page.screenshot({ path: `${SCREENSHOTS}/2-maksimir.png` });
  });
});

test.describe("in Split (outside Zagreb)", () => {
  test.use({ geolocation: { latitude: 43.5081, longitude: 16.4402, accuracy: 20 }, permissions: ["geolocation"] });

  test("explains there are no fountains nearby", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#card")).toContainText("No fountains mapped near you. Showing Zagreb.");
    await page.screenshot({ path: `${SCREENSHOTS}/3-split.png` });
  });
});

test.describe("with location permission denied", () => {
  test.use({ permissions: [] });

  test("offers to enable location and retry", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Enable location to find the nearest fountain", { timeout: 20_000 });
    await expect(card.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/4-denied.png` });
  });
});
```

- [ ] **Step 4: Typecheck and run the verification**

Run: `npm run typecheck && npm run verify`
Expected: `4 passed`.

- [ ] **Step 5: Inspect the screenshots**

Open `e2e/screenshots/1-ban-jelacic.png` through `4-denied.png` and check:
1. **Ban Jelačić:** the blue user dot and one larger amber-ringed fountain are both visible above the card. The card reads "Nearest fountain", a location, and "… m · ~N min walk".
2. **Maksimir:** same as above, with a Maksimir location on the card.
3. **Split:** the map shows Zagreb and the card reads "No fountains mapped near you. Showing Zagreb."
4. **Denied:** the card shows "Enable location to find the nearest fountain" and a Retry button.

In all four, the attribution is visible top-right and the zoom buttons aren't covered. If any check fails, fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/verify.spec.ts
git commit -m "test: add Playwright verification for the four spec scenarios

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: CI, deploy, and weekly data refresh

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/refresh-data.yml`

**Interfaces:**
- Consumes: npm scripts `typecheck`, `test`, `build`, `fetch-data`
- Produces: a GitHub Pages deploy on every push to `main` or manual dispatch, and a Monday 04:00 UTC data refresh that commits `public/data/fountains.json` only when fountains changed, then starts a deploy.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Create `.github/workflows/refresh-data.yml`**

Pushes made with `GITHUB_TOKEN` don't start other workflows, so this workflow starts the deploy explicitly. A `workflow_dispatch` event is exempt from that rule.

```yaml
name: Refresh fountain data

on:
  schedule:
    - cron: "0 4 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  actions: write

concurrency:
  group: refresh-data
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run fetch-data
      - run: npm run typecheck
      - run: npm test

      - name: Commit snapshot if fountains changed
        id: commit
        run: |
          if git diff --quiet -- public/data/fountains.json; then
            echo "No fountain changes."
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/data/fountains.json
          git commit -m "chore(data): refresh fountains from data.zagreb.hr"
          git push
          echo "changed=true" >> "$GITHUB_OUTPUT"

      - name: Trigger deploy
        if: steps.commit.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh workflow run deploy.yml --ref main
```

- [ ] **Step 3: Validate the workflow YAML parses**

Run: `npx --yes yaml@2 valid < .github/workflows/deploy.yml && npx --yes yaml@2 valid < .github/workflows/refresh-data.yml && echo ok`
Expected: `ok`. A syntax error prints a `YAMLParseError` with the line number and exits non-zero.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: deploy to GitHub Pages and refresh fountain data weekly

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Publish to GitHub (ask the user first)**

This step creates a public repository and deploys a public site. **Stop and get explicit approval from the user before running anything here.** Confirm the repository name and that it should be public, since free GitHub Pages requires a public repo.

`gh` is currently not logged in. The user must run `! gh auth login` themselves.

After approval:
```bash
gh repo create zagreb-fountains --public --source . --remote origin --push
gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=workflow
gh workflow run deploy.yml --ref main
gh run watch "$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh api "repos/{owner}/{repo}/pages" --jq .html_url
```
Expected: the deploy run finishes green, and the last command prints the Pages URL (e.g. `https://<user>.github.io/zagreb-fountains/`). Open it on a phone and check that the nearest fountain appears.

Then start the refresh once by hand to prove it works:
```bash
gh workflow run refresh-data.yml --ref main
gh run watch "$(gh run list --workflow refresh-data.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```
Expected: the run is green and its log shows "No fountain changes." (or a data commit followed by a deploy run).

Note: GitHub disables scheduled workflows after 60 days without repository activity. If refreshes stop, re-enable the workflow in the Actions tab.

---

## Pre-launch Checklist (from spec "Open risks")

- [ ] Confirm the exact Otvorena dozvola terms (attribution wording, any share-alike clause) on data.gov.hr before announcing the site publicly.
- [ ] Review how the city's `napomena_teren` hints read to the public. Some are internal survey notes, e.g. "izvorno SKI lokacija" or "-14,8 metara". Decide whether to keep, filter, or drop hints in v1.1.
