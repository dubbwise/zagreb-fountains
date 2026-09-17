import "./style.css";
import { LOW_ACCURACY_M, RECOMPUTE_DISTANCE_M } from "./config";
import { loadFountains, type Fountain } from "./data/fountains";
import { findNearest, haversineMeters, isNearZagreb, type LatLon, type NearestResult } from "./geo/distance";
import { watchLocation, type LocationEvent } from "./geo/location";
import { createFountainMap, type UserPosition } from "./map/map";
import { t } from "./i18n";
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
/** Whether the last card render used the "approx." (low-accuracy) prefix. */
let renderedApprox = false;

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
  renderedApprox = position !== null && position.accuracyM > LOW_ACCURACY_M;
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
  // "No previous fix" counts as in range, so a tap made before the first fix
  // doesn't survive a first fix that lands outside Zagreb.
  const wasNearZagreb = position === null || isNearZagreb(position);
  position = { lat: event.lat, lon: event.lon, accuracyM: event.accuracyM };
  map.setUserPosition(position);

  if (!isNearZagreb(position)) {
    nearest = null;
    computedAt = null;
    hasFitted = false; // re-frame the map when the user comes back into range
    if (wasNearZagreb) tapped = null;
    update();
    return;
  }
  if (computedAt && haversineMeters(computedAt, position) < RECOMPUTE_DISTANCE_M) {
    // Still too close to recompute the nearest fountain, but a coarse first
    // fix followed by a precise one at the same spot should still drop
    // (or add) the "approx." prefix on the card.
    if ((position.accuracyM > LOW_ACCURACY_M) !== renderedApprox) update();
    return;
  }

  computedAt = { lat: position.lat, lon: position.lon };
  nearest = findNearest(position, fountains);
  if (nearest && !hasFitted) {
    map.fitTo([position, nearest.fountain]);
    hasFitted = true;
    tapped = null; // follow the map framing instead of a stale tapped fountain
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
  fatalElement.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center dark:bg-slate-950">
    <p class="text-lg font-medium">${escapeHtml(t().loadError)}</p>
    <button type="button" class="rounded-xl bg-sky-700 px-6 py-3 font-semibold text-white dark:bg-sky-600">${escapeHtml(t().retry)}</button>
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
