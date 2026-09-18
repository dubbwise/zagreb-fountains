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
  introLocationHeading: string;
  introLocationBody: string;
  introThemeLabel: string;
  introThemeSystem: string;
  introThemeLight: string;
  introThemeDark: string;
  introLanguageLabel: string;
  introCreditsHeading: string;
  introCreditsMapPrefix: string;
  introCreditsContributors: string;
  introCreditsDarkBasemap: string;
  introCreditsData: string;
  introFeedback: string;
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
  introTitle: "Find the nearest public water point in Zagreb",
  introLocationHeading: "Why your location?",
  introLocationBody: "It is used in your browser to work out which water point is closest. It is never sent anywhere.",
  introThemeLabel: "Theme",
  introThemeSystem: "System",
  introThemeLight: "Light",
  introThemeDark: "Dark",
  introLanguageLabel: "Language",
  introCreditsHeading: "Credits",
  introCreditsMapPrefix: "Map:",
  introCreditsContributors: "contributors",
  introCreditsDarkBasemap: "dark basemap",
  introCreditsData: "Data: Grad Zagreb",
  introFeedback: "Feedback",
  introContinue: "Find nearest water point",
  introOpen: "About this map",
};
