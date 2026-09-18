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
  introTitle: "Pronađi zdenace s pitkom vodom u Zagrebu",
  introLocationBody: "Omogući lokaciju kako bi se izračunalo koji je zdenac najbliži. Lokacija se ne šalje nikamo.",
  introLastUpdated: (date) => `Zadnja provjera: ${date}`,
  introContinue: "Pronađi najbliži zdenac",
  introOpen: "Prikaži uvodni ekran",
};
