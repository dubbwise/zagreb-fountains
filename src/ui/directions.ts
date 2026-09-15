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
