import { describe, expect, it } from "vitest";
import { setActiveLanguage } from "../src/i18n";
import { introHtml } from "../src/ui/intro";

describe("introHtml", () => {
  it("explains the app, the location use and the credits", () => {
    setActiveLanguage("en");
    const html = introHtml({
      theme: "system",
      language: "en",
      lastCheckedAt: "2026-09-15T15:40:55.478Z",
    });
    expect(html).toContain("Find public water points in Zagreb");
    expect(html).toContain('id="intro-title"');
    expect(html).toContain("intro-title-mask");
    expect(html).toContain("istockphoto-496241260-612x612.jpg");
    expect(html).toContain("It is never sent anywhere.");
    expect(html).toContain("Last updated:");
    expect(html).toContain(
      '<a class="underline underline-offset-2" href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>',
    );
    expect(html).toContain(
      '<a class="underline underline-offset-2" href="https://carto.com/" target="_blank" rel="noopener">CARTO</a>',
    );
    expect(html).toContain("https://data.zagreb.hr/dataset/geoportal_javni_zdenci");
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
      const html = introHtml({
        theme: "system",
        language: "hr",
        lastCheckedAt: "2026-09-15T15:40:55.478Z",
      });
      expect(html).toContain("Pronađi zdenace s pitkom vodom u Zagrebu");
      expect(html).toContain("Pronađi najbliži zdenac");
      expect(html).toContain("Zadnja provjera:");
      expect(html).toContain(
        '<a class="underline underline-offset-2" href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>',
      );
      expect(html).toContain(
        '<a class="underline underline-offset-2" href="https://carto.com/" target="_blank" rel="noopener">CARTO</a>',
      );
    } finally {
      setActiveLanguage("en");
    }
  });

  it("omits the last-updated line until a timestamp is available", () => {
    setActiveLanguage("en");
    const html = introHtml({ theme: "system", language: "en" });
    expect(html).not.toContain("Last updated:");
  });
});
