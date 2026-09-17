import { describe, expect, it } from "vitest";
import type { Fountain } from "../src/data/fountains";
import { setActiveLanguage } from "../src/i18n";
import { cardHtml, type FountainCardState } from "../src/ui/nearestCard";

const BRITANSKI_TRG: Fountain = {
  id: "8596b290-ea0d-4caa-8890-047804249320",
  lat: 45.812749,
  lon: 15.964876,
  location: "Britanski trg",
  hint: "sjeverno od javnog WC-a",
  status: "working",
  cemetery: false,
  type: "Viktorija zdenac",
};

function fountainState(overrides: Partial<FountainCardState> = {}): FountainCardState {
  return {
    kind: "fountain",
    fountain: BRITANSKI_TRG,
    distanceM: 244,
    approx: false,
    isNearest: true,
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=45.812749,15.964876&travelmode=walking",
    ...overrides,
  };
}

describe("cardHtml", () => {
  it("shows a locating message", () => {
    expect(cardHtml({ kind: "locating" })).toContain("Finding your location");
  });

  it("offers a retry button when location fails", () => {
    const html = cardHtml({ kind: "locationError" });
    expect(html).toContain("Enable location to find the nearest fountain");
    expect(html).toContain('data-action="retry"');
  });

  it("explains when the user is outside Zagreb", () => {
    expect(cardHtml({ kind: "outside" })).toContain("No fountains mapped near you. Showing Zagreb.");
  });

  it("renders the nearest fountain with distance, walking time and directions", () => {
    const html = cardHtml(fountainState());
    expect(html).toContain("Nearest fountain");
    expect(html).toContain("Britanski trg");
    expect(html).toContain("sjeverno od javnog WC-a");
    expect(html).toContain("240 m · ~4 min walk");
    expect(html).toContain(
      'href="https://www.google.com/maps/dir/?api=1&amp;destination=45.812749,15.964876&amp;travelmode=walking"',
    );
    expect(html).not.toContain("Status not confirmed");
    expect(html).not.toContain("Cemetery");
  });

  it("labels a tapped fountain that is not the nearest", () => {
    const html = cardHtml(fountainState({ isNearest: false }));
    expect(html).toContain(">Fountain<");
    expect(html).not.toContain("Nearest fountain");
  });

  it("prefixes approx. when accuracy is low", () => {
    expect(cardHtml(fountainState({ approx: true }))).toContain("approx. 240 m · ~4 min walk");
  });

  it("omits the distance line when distance is unknown", () => {
    expect(cardHtml(fountainState({ distanceM: null }))).not.toContain("min walk");
  });

  it("shows badges for unverified and cemetery fountains", () => {
    const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, status: "unverified", cemetery: true } }));
    expect(html).toContain("Status not confirmed");
    expect(html).toContain("Cemetery — follows cemetery opening hours");
  });

  it("escapes HTML coming from the data", () => {
    const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, location: "<img src=x onerror=alert(1)>" } }));
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });

  it("renders in Croatian when that language is active", () => {
    setActiveLanguage("hr");
    try {
      const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, status: "unverified" } }));
      expect(html).toContain("Najbliži zdenac");
      expect(html).toContain("240 m · ~4 min hoda");
      expect(html).toContain("Status nije potvrđen");
      expect(html).toContain("Upute");
    } finally {
      setActiveLanguage("en");
    }
  });
});
