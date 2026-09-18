import {
  DEFAULT_CENTER,
  NEAR_ZAGREB_RADIUS_M,
  UNVERIFIED_PREFERENCE_M,
  WALK_DETOUR_FACTOR,
  WALK_SPEED_KMH,
} from "../config";
import type { Location } from "../data/locations";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface NearestResult {
  location: Location;
  distanceM: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function isCloser(candidate: NearestResult, best: NearestResult | null): boolean {
  if (best === null) return true;
  if (candidate.distanceM !== best.distanceM) return candidate.distanceM < best.distanceM;
  return candidate.location.id < best.location.id;
}

/**
 * Nearest working location, unless an unverified one is more than
 * UNVERIFIED_PREFERENCE_M closer. Exact distance ties go to the lowest id.
 */
export function findNearest(from: LatLon, locations: readonly Location[]): NearestResult | null {
  let working: NearestResult | null = null;
  let unverified: NearestResult | null = null;
  for (const location of locations) {
    const candidate = { location, distanceM: haversineMeters(from, location) };
    if (location.status === "working") {
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
