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
