import type { Strings } from "./en";

export const hr: Strings = {
  nearestLocation: "Najbliži zdenac",
  selectedLocation: "Zdenac",
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
  introTitle: "Javni zdenci Grada Zagreba.",
  introLocationBody:
    "Preglednik će zatražiti lokaciju kako bi pronašao najbliži zdenac. Lokacija se koristi samo na tvom uređaju i nikamo se ne šalje.",
  introLastUpdated: (date) => `Ažurirano: ${date}`,
  introContinue: "Nađi najbliži zdenac",
  introOpen: "Prikaži uvodni ekran",
};
