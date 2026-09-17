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
  introTitle: string;
  introLede: string;
  introLocationHeading: string;
  introLocationBody: string;
  introThemeLabel: string;
  introThemeSystem: string;
  introThemeLight: string;
  introThemeDark: string;
  introLanguageLabel: string;
  introCreditsHeading: string;
  introCreditsMap: string;
  introCreditsData: string;
  introFeedback: string;
  introContinue: string;
  introOpen: string;
}

export const en: Strings = {
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
  walk: (minutes) => `~${minutes} min walk`,
  introTitle: "Zagreb Fountains",
  introLede: "Find the nearest public drinking fountain in Zagreb, from the City of Zagreb's open data.",
  introLocationHeading: "Why your location?",
  introLocationBody: "It is used in your browser to work out which fountain is closest. It is never sent anywhere.",
  introThemeLabel: "Theme",
  introThemeSystem: "System",
  introThemeLight: "Light",
  introThemeDark: "Dark",
  introLanguageLabel: "Language",
  introCreditsHeading: "Credits",
  introCreditsMap: "Map: Leaflet, © OpenStreetMap contributors, dark basemap © CARTO.",
  introCreditsData: "Data: Grad Zagreb",
  introFeedback: "Feedback",
  introContinue: "Find water",
  introOpen: "About this map",
};
