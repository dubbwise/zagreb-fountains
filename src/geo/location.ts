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
