import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CARTO_API_KEY,
  DARK_TILE_ATTRIBUTION,
  DARK_TILE_MAX_ZOOM,
  DARK_TILE_URL,
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
// Lime rather than amber: it stays clear of the orange "you are here" dot and
// reads on both basemaps.
const HIGHLIGHT_STYLE: L.PathOptions = { color: "#a3e635", weight: 4 };

/** Styled in style.css: a white-ringed dot with a pulsing halo. */
const USER_ICON = L.divIcon({
  className: "user-dot",
  html: '<span class="user-dot__halo"></span><span class="user-dot__core"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function fountainStyle(fountain: Fountain, dark: boolean): L.PathOptions {
  const working = dark ? "#38bdf8" : "#0369a1";
  const unverified = dark ? "#64748b" : "#94a3b8";
  return {
    color: "#ffffff",
    weight: 2,
    fillColor: fountain.status === "working" ? working : unverified,
    fillOpacity: 1,
  };
}

export function createFountainMap(container: HTMLElement): FountainMap {
  const map = L.map(container, { attributionControl: false, zoomControl: false }).setView(
    [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
    DEFAULT_ZOOM,
  );

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const lightTiles = L.tileLayer(TILE_URL, { maxZoom: TILE_MAX_ZOOM });
  // No key means no dark basemap; the light tiles then serve both themes.
  const darkTiles = CARTO_API_KEY ? L.tileLayer(DARK_TILE_URL, { maxZoom: DARK_TILE_MAX_ZOOM }) : null;
  const useDarkTiles = (): boolean => darkTiles !== null && darkQuery.matches;

  // Both controls share the top-right corner so they stack instead of overlapping,
  // and the bottom card never covers the required attribution.
  const attribution = L.control.attribution({ position: "topright" }).addTo(map);
  attribution.addAttribution(DATA_ATTRIBUTION);
  L.control.zoom({ position: "topright" }).addTo(map);

  const markers = new Map<string, { marker: L.CircleMarker; fountain: Fountain }>();
  let highlightedId: string | null = null;
  let onTap: (fountain: Fountain) => void = () => {};
  let userMarker: L.Marker | null = null;
  let accuracyCircle: L.Circle | null = null;

  /** Each basemap carries its own credit, so only the visible one is listed. */
  function applyTheme(): void {
    const dark = useDarkTiles();
    const [add, remove] = dark ? [darkTiles, lightTiles] : [lightTiles, darkTiles];
    const [addCredit, removeCredit] = dark
      ? [DARK_TILE_ATTRIBUTION, TILE_ATTRIBUTION]
      : [TILE_ATTRIBUTION, DARK_TILE_ATTRIBUTION];
    if (remove && map.hasLayer(remove)) {
      map.removeLayer(remove);
      attribution.removeAttribution(removeCredit);
    }
    if (add && !map.hasLayer(add)) {
      add.addTo(map);
      add.bringToBack();
      attribution.addAttribution(addCredit);
    }
    for (const { marker, fountain } of markers.values()) {
      if (fountain.id === highlightedId) continue;
      marker.setStyle(fountainStyle(fountain, dark));
    }
  }

  applyTheme();
  darkQuery.addEventListener("change", applyTheme);

  function highlight(id: string | null): void {
    const dark = useDarkTiles();
    const previous = highlightedId === null ? undefined : markers.get(highlightedId);
    previous?.marker.setRadius(FOUNTAIN_RADIUS).setStyle(fountainStyle(previous.fountain, dark));
    highlightedId = id;
    const next = id === null ? undefined : markers.get(id);
    next?.marker.setRadius(HIGHLIGHT_RADIUS).setStyle(HIGHLIGHT_STYLE).bringToFront();
  }

  function setFountains(fountains: readonly Fountain[]): void {
    const dark = useDarkTiles();
    for (const { marker } of markers.values()) marker.remove();
    markers.clear();
    for (const fountain of fountains) {
      const marker = L.circleMarker([fountain.lat, fountain.lon], {
        ...fountainStyle(fountain, dark),
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
      // A marker rather than a circle: it lives in the marker pane, which sits
      // above the fountain circles, and it carries the pulsing CSS dot.
      userMarker = L.marker(latLng, { icon: USER_ICON, interactive: false, keyboard: false }).addTo(map);
    }
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
