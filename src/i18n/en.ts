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
  introTitle: "Find public water points in Zagreb.",
  introLocationBody:
    "Browser will ask for location to find the nearest water point. Location is local use only, never sent anywhere.",
  introLastUpdated: (date) => `Updated: ${date}`,
  introContinue: "Open map",
  introOpen: "Show intro screen",
};
