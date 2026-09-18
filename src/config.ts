/** Ban Jelačić Square — default map center and the reference point for "near Zagreb". */
export const DEFAULT_CENTER = { lat: 45.8131, lon: 15.9772 } as const;
export const DEFAULT_ZOOM = 14;

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_MAX_ZOOM = 19;

/**
 * Dark basemap, used only when the system asks for dark mode AND a key is set.
 * Keyless CARTO tiles come back stamped "API KEY REQUIRED", so without a key
 * the map stays on the light tiles. Set VITE_CARTO_API_KEY in .env.local.
 */
export const CARTO_API_KEY: string = import.meta.env.VITE_CARTO_API_KEY ?? "";
// The query parameter is `key`. An `api_key` parameter is silently ignored and
// the tiles come back watermarked, which still responds 200.
export const DARK_TILE_URL = `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
export const DARK_TILE_MAX_ZOOM = 20;

export const GEOLOCATION_TIMEOUT_MS = 10_000;
export const RECOMPUTE_DISTANCE_M = 25;
export const LOW_ACCURACY_M = 100;
export const NEAR_ZAGREB_RADIUS_M = 30_000;
export const UNVERIFIED_PREFERENCE_M = 150;
export const WALK_SPEED_KMH = 5;
export const WALK_DETOUR_FACTOR = 1.3;
