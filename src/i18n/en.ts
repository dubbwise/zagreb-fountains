export interface Strings {
  nearestFountain: string;
  selectedFountain: string;
  directions: string;
  retry: string;
  locating: string;
  enableLocation: string;
  outsideZagreb: string;
  unverified: string;
  cemetery: string;
  loadError: string;
  approx: string;
  walk: (minutes: number) => string;
  introLanguage: string;
  introTitle: string;
  introLocationBody: string;
  introLastUpdated: (date: string) => string;
  introContinue: string;
  introOpen: string;
}

export const en: Strings = {
  nearestFountain: "Nearest water point",
  selectedFountain: "Water point",
  directions: "Directions",
  retry: "Retry",
  locating: "Finding your location…",
  enableLocation: "Enable location to find the nearest water point",
  outsideZagreb: "No water points mapped near you. Showing Zagreb.",
  unverified: "Status not confirmed",
  cemetery: "Cemetery — follows cemetery opening hours",
  loadError: "Couldn't load water point data.",
  approx: "approx.",
  walk: (minutes) => `~${minutes} min walk`,
  introLanguage: "Language",
  introTitle: "Find public water points in Zagreb",
  introLocationBody: "Allow location in your browser to work out which water point is closest. It is never sent anywhere.",
  introLastUpdated: (date) => `Last updated: ${date}`,
  introContinue: "Find nearest water point",
  introOpen: "Show intro screen",
};
