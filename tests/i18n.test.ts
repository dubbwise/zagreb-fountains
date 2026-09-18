import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { hr } from "../src/i18n/hr";
import { detectLanguage, setActiveLanguage, t } from "../src/i18n";

describe("tables", () => {
  it("cover exactly the same keys", () => {
    expect(Object.keys(hr).sort()).toEqual(Object.keys(en).sort());
  });

  it("have no empty strings", () => {
    for (const table of [en, hr]) {
      for (const [key, value] of Object.entries(table)) {
        if (typeof value === "string") expect(value.trim(), key).not.toBe("");
      }
    }
  });
});

describe("detectLanguage", () => {
  it.each([
    ["hr", "hr"],
    ["hr-HR", "hr"],
    ["HR", "hr"],
    ["en-GB", "en"],
    ["de", "en"],
    ["", "en"],
  ])("%s resolves to %s", (navigatorLanguage, expected) => {
    expect(detectLanguage(navigatorLanguage)).toBe(expected);
  });
});

describe("t", () => {
  it("returns the active table and switches", () => {
    // Identity against the table, so rewording never breaks this.
    setActiveLanguage("en");
    expect(t()).toBe(en);
    setActiveLanguage("hr");
    expect(t()).toBe(hr);
    setActiveLanguage("en");
  });
});
