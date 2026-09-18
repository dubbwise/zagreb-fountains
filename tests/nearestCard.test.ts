import { describe, expect, it } from "vitest";
import type { Fountain } from "../src/data/fountains";
import { setActiveLanguage } from "../src/i18n";
// Compared against the i18n tables, never literal copy: rewording is not a
// breaking change. See AGENTS.md.
import { en } from "../src/i18n/en";
import { hr } from "../src/i18n/hr";
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
    expect(cardHtml({ kind: "locating" })).toContain(en.locating);
  });

  it("offers a retry button when location fails", () => {
    const html = cardHtml({ kind: "locationError" });
    expect(html).toContain(en.enableLocation);
    expect(html).toContain('data-action="retry"');
  });

  it("explains when the user is outside Zagreb", () => {
    expect(cardHtml({ kind: "outside" })).toContain(en.outsideZagreb);
  });

  it("renders the nearest fountain with distance, walking time and directions", () => {
    const html = cardHtml(fountainState());
    expect(html).toContain(en.nearestFountain);
    expect(html).toContain("Britanski trg");
    expect(html).toContain("sjeverno od javnog WC-a");
    expect(html).toContain(`240 m · ${en.walk(4)}`);
    expect(html).toContain(
      'href="https://www.google.com/maps/dir/?api=1&amp;destination=45.812749,15.964876&amp;travelmode=walking"',
    );
    expect(html).not.toContain(en.unverified);
    expect(html).not.toContain(en.cemetery);
  });

  it("labels a tapped fountain that is not the nearest", () => {
    const html = cardHtml(fountainState({ isNearest: false }));
    expect(html).toContain(`>${en.selectedFountain}<`);
    expect(html).not.toContain(en.nearestFountain);
  });

  it("prefixes approx. when accuracy is low", () => {
    expect(cardHtml(fountainState({ approx: true }))).toContain(`${en.approx} 240 m · ${en.walk(4)}`);
  });

  it("omits the distance line when distance is unknown", () => {
    // The distance itself is data, so its absence is the thing worth asserting.
    expect(cardHtml(fountainState({ distanceM: null }))).not.toContain("240 m");
  });

  it("shows badges for unverified and cemetery fountains", () => {
    const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, status: "unverified", cemetery: true } }));
    expect(html).toContain(en.unverified);
    expect(html).toContain(en.cemetery);
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
      expect(html).toContain(hr.nearestFountain);
      expect(html).toContain(`240 m · ${hr.walk(4)}`);
      expect(html).toContain(hr.unverified);
      expect(html).toContain(hr.directions);
    } finally {
      setActiveLanguage("en");
    }
  });
});
