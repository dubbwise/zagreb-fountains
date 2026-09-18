import { describe, expect, it } from "vitest";
import { setActiveLanguage } from "../src/i18n";
import { introHtml } from "../src/ui/intro";

describe("introHtml", () => {
  it("explains the app, the location use and the credits", () => {
    setActiveLanguage("en");
    const html = introHtml({ theme: "system", language: "en" });
    expect(html).toContain("Find the nearest public water point in the City of Zagreb");
    expect(html).toContain("Why your location?");
    expect(html).toContain("It is never sent anywhere.");
    expect(html).toContain(
      '<a class="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    );
    expect(html).toContain(
      '<a class="underline" href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    );
    expect(html).toContain("Grad Zagreb");
    expect(html).toContain("https://data.zagreb.hr/dataset/geoportal_javni_zdenci");
    expect(html).toContain("mailto:zg@paperbeatsrock.co");
    expect(html).toContain("Find nearest water point");
  });

  it("marks the active theme and language", () => {
    setActiveLanguage("en");
    const html = introHtml({ theme: "dark", language: "en" });
    expect(html).toContain('data-theme="dark" aria-pressed="true"');
    expect(html).toContain('data-theme="light" aria-pressed="false"');
    expect(html).toContain('data-language="en" aria-pressed="true"');
    expect(html).toContain('data-language="hr" aria-pressed="false"');
  });

  it("renders Croatian when that language is active", () => {
    setActiveLanguage("hr");
    try {
      const html = introHtml({ theme: "system", language: "hr" });
      expect(html).toContain("Pronađi najbliži javni zdenac s pitkom vodom u Zagrebu");
      expect(html).toContain("Zašto lokacija?");
      expect(html).toContain("Pronađi najbliži zdenac");
      expect(html).toContain("Sustav");
      expect(html).toContain(
        '<a class="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      );
      expect(html).toContain(
        '<a class="underline" href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      );
    } finally {
      setActiveLanguage("en");
    }
  });
});
