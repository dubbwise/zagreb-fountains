export interface Strings {
  nearestLocation: string;
  selectedLocation: string;
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
  nearestLocation: "Nearest water point",
  selectedLocation: "Water point",
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
    "Browser will ask for location to find the nearest water point. Location is used only on your device, never sent anywhere.",
  introLastUpdated: (date) => `Updated: ${date}`,
  introContinue: "Find nearest water point",
  introOpen: "Show intro screen",
};
