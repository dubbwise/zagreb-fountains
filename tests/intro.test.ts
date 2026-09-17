import { describe, expect, it } from "vitest";
import { setActiveLanguage } from "../src/i18n";
import { introHtml } from "../src/ui/intro";

describe("introHtml", () => {
  it("explains the app, the location use and the credits", () => {
    setActiveLanguage("en");
    const html = introHtml({ theme: "system", language: "en" });
    expect(html).toContain("Zagreb Fountains");
    expect(html).toContain("Why your location?");
    expect(html).toContain("It is never sent anywhere.");
    expect(html).toContain("© OpenStreetMap contributors");
    expect(html).toContain("CARTO");
    expect(html).toContain("Grad Zagreb");
    expect(html).toContain("https://data.zagreb.hr/dataset/geoportal_javni_zdenci");
    expect(html).toContain("mailto:zg@paperbeatsrock.co");
    expect(html).toContain("Find water");
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
      expect(html).toContain("Zagrebački zdenci");
      expect(html).toContain("Zašto lokacija?");
      expect(html).toContain("Pronađi vodu");
      expect(html).toContain("Sustav");
    } finally {
      setActiveLanguage("en");
    }
  });
});
