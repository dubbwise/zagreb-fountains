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
