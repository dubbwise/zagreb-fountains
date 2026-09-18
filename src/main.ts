import "./style.css";
import { LOW_ACCURACY_M, RECOMPUTE_DISTANCE_M } from "./config";
import { loadFountains, type Fountain } from "./data/fountains";
import { detectLanguage, setActiveLanguage, t } from "./i18n";
import { findNearest, haversineMeters, isNearZagreb, type LatLon, type NearestResult } from "./geo/distance";
import { watchLocation, type LocationEvent } from "./geo/location";
import { createFountainMap, type UserPosition } from "./map/map";
import { createSettings, themeColor } from "./settings";
import { directionsUrl } from "./ui/directions";
import { renderIntro } from "./ui/intro";
import { escapeHtml, renderCard, type CardState } from "./ui/nearestCard";

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

const settings = createSettings(
  {
    storage: localStorage,
    media: window.matchMedia("(prefers-color-scheme: dark)"),
    root: document.documentElement,
  },
  detectLanguage(navigator.language),
);
setActiveLanguage(settings.getLanguage());

const mapElement = byId("map");
const map = createFountainMap(mapElement, { dark: settings.effectiveTheme() === "dark", infoLabel: t().introOpen });
const cardElement = byId("card");
const fatalElement = byId("fatal");
const introElement = byId("intro");
let locationStarted = false;
/** The control that opened the intro, so closeIntro() can return focus to it. */
let introOpener: Element | null = null;
/**
 * Set when a fetch failure happens while the intro is still open: #fatal
 * (z-2000) would otherwise cover #intro (z-1500) immediately, so a
 * first-time visitor never sees the explainer or the credits. Flushed once
 * the intro closes.
 */
let fatalPending = false;

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
  fatalElement.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-4 bg-surface/50 p-6 text-center">
    <p class="text-lg font-medium">${escapeHtml(t().loadError)}</p>
    <button type="button" class="rounded-md bg-accent px-6 py-3 font-semibold text-white active:bg-accent-active">${escapeHtml(t().retry)}</button>
  </div>`;
  fatalElement.classList.remove("hidden");
  fatalElement.querySelector("button")?.addEventListener("click", () => void boot());
}

function drawIntro(): void {
  renderIntro(
    introElement,
    { theme: settings.getTheme(), language: settings.getLanguage() },
    {
      onTheme: (theme) => settings.setTheme(theme),
      onLanguage: (language) => settings.setLanguage(language),
      onContinue: closeIntro,
    },
  );
}

/**
 * `rememberOpener` is only set when this is called from the ⓘ control: on
 * first load there is no opener, so focus is left where renderIntro puts it.
 */
function openIntro(rememberOpener = false): void {
  introOpener = rememberOpener ? document.activeElement : null;
  // #map and #card sit behind the (opaque) intro overlay but are not covered
  // by it in the accessibility tree without this: inert removes both from
  // tab order and from screen reader / aria-live announcements while the
  // dialog is open, which is what "modal" is supposed to mean.
  mapElement.inert = true;
  cardElement.inert = true;
  introElement.classList.remove("hidden");
  drawIntro();
}

/** Continuing starts the location watch once; reopening later must not re-prompt. */
function closeIntro(): void {
  introElement.classList.add("hidden");
  mapElement.inert = false;
  cardElement.inert = false;
  if (introOpener instanceof HTMLElement && introOpener.isConnected) introOpener.focus();
  introOpener = null;
  map.refreshSize();
  if (fatalPending) {
    fatalPending = false;
    showFatal();
  }
  if (locationStarted) return;
  locationStarted = true;
  startLocation();
}

settings.onChange(() => {
  setActiveLanguage(settings.getLanguage());
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor(settings.effectiveTheme()));
  map.setDark(settings.effectiveTheme() === "dark");
  map.setInfoLabel(t().introOpen);
  if (!introElement.classList.contains("hidden")) drawIntro();
  update();
});

map.onInfoTap(() => openIntro(true));

// The spec treats Escape as "continue": same effect, including starting the
// location watch the first time.
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !introElement.classList.contains("hidden") &&
    fatalElement.classList.contains("hidden")
  ) {
    closeIntro();
  }
});

async function boot(): Promise<void> {
  fatalElement.classList.add("hidden");
  try {
    fountains = await loadFountains(`${import.meta.env.BASE_URL}data/fountains.json`);
  } catch (error) {
    console.error(error);
    if (introElement.classList.contains("hidden")) showFatal();
    else fatalPending = true;
    return;
  }
  map.setFountains(fountains);
  update();
}

map.onFountainTap((fountain) => {
  // Tapping the nearest fountain returns to "follow nearest" mode.
  tapped = nearest?.fountain.id === fountain.id ? null : fountain;
  update();
});

openIntro();
void boot();
