import type { Strings } from "./en";

export const hr: Strings = {
  nearestFountain: "Najbliži zdenac",
  selectedFountain: "Zdenac",
  directions: "Upute",
  retry: "Pokušaj ponovno",
  locating: "Tražim tvoju lokaciju…",
  enableLocation: "Uključi lokaciju za pronalazak najbližeg zdenca",
  outsideZagreb: "U tvojoj blizini nema zdenaca. Prikazujem Zagreb.",
  unverified: "Status nije potvrđen",
  cemetery: "Groblje — vrijedi radno vrijeme groblja",
  loadError: "Učitavanje podataka nije uspjelo.",
  approx: "otprilike",
  walk: (minutes) => `~${minutes} min hoda`,
  introLanguage: "Jezik",
  introTitle: "Zdenci s pitkom vodom u Zagrebu.",
  introLocationBody: "Preglednik će zatražiti lokaciju kako bi pronašao najbliži zdenac. Lokacija se koristi samo lokalno, nikad se ne dijeli dalje.",
  introLastUpdated: (date) => `Ažurirano: ${date}`,
  introContinue: "Prikaži mapu",
  introOpen: "Prikaži uvodni ekran",
};
