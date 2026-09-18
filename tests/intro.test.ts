import { describe, expect, it } from "vitest";
import { setActiveLanguage } from "../src/i18n";
import { en } from "../src/i18n/en";
import { hr } from "../src/i18n/hr";
import { introHtml } from "../src/ui/intro";

/**
 * These tests deliberately assert no literal user-visible copy. Wording is not
 * a breaking change, and a test that fails on a reworded sentence guards
 * nothing — it just blocks the build. Anything language-dependent is compared
 * against the i18n table, so rewording flows through automatically; everything
 * else is structure (ids, classes, attributes, URLs). See AGENTS.md.
 */
describe("introHtml", () => {
  const CHECKED_AT = "2026-09-15T15:40:55.478Z";

  it("renders the title, the masked image and the attribution links", () => {
    setActiveLanguage("en");
    const html = introHtml({ theme: "system", language: "en", lastCheckedAt: CHECKED_AT });

    expect(html).toContain(en.introTitle);
    expect(html).toContain('id="intro-title"');
    expect(html).toContain("intro-title-mask");
    expect(html).toContain("istockphoto-496241260-612x612.jpg");
    expect(html).toContain(en.introLocationBody);
    expect(html).toContain(en.introContinue);

    // Attribution is a licence obligation, so the URLs are asserted even
    // though the link text around them is not.
    expect(html).toContain('href="https://www.openstreetmap.org/"');
    expect(html).toContain('href="https://carto.com/"');
    expect(html).toContain("https://data.zagreb.hr/dataset/geoportal_javni_zdenci");
  });

  it("marks the active theme and language", () => {
    setActiveLanguage("en");
    const html = introHtml({ theme: "dark", language: "en" });
    expect(html).toContain('data-theme="dark" aria-pressed="true"');
    expect(html).toContain('data-theme="light" aria-pressed="false"');
    expect(html).toContain('data-language="en" aria-pressed="true"');
    expect(html).toContain('data-language="hr" aria-pressed="false"');
  });

  it("renders the Croatian table when that language is active", () => {
    setActiveLanguage("hr");
    try {
      const html = introHtml({ theme: "system", language: "hr", lastCheckedAt: CHECKED_AT });
      expect(html).toContain(hr.introTitle);
      expect(html).toContain(hr.introContinue);
      expect(html).not.toContain(en.introTitle);
    } finally {
      setActiveLanguage("en");
    }
  });

  it("shows the checked-at date only once a timestamp is available", () => {
    setActiveLanguage("en");
    // The date itself is data, not copy, so asserting it survives rewording of
    // the sentence it sits in.
    const formatted = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(CHECKED_AT));

    expect(introHtml({ theme: "system", language: "en", lastCheckedAt: CHECKED_AT })).toContain(formatted);
    expect(introHtml({ theme: "system", language: "en" })).not.toContain(formatted);
  });
});
