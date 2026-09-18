import { describe, expect, it, vi } from "vitest";
import { createSettings, themeColor, type SettingsDeps } from "../src/settings";

function fakeDeps(overrides: { stored?: Record<string, string>; throwing?: boolean; writesThrow?: boolean } = {}) {
  const stored = new Map(Object.entries(overrides.stored ?? {}));
  const root = { classList: { toggle: vi.fn() }, lang: "" };
  const deps: SettingsDeps = {
    storage: {
      getItem: (key) => {
        if (overrides.throwing) throw new Error("blocked");
        return stored.get(key) ?? null;
      },
      setItem: (key, value) => {
        if (overrides.throwing || overrides.writesThrow) throw new Error("blocked");
        stored.set(key, value);
      },
      removeItem: (key) => {
        if (overrides.throwing || overrides.writesThrow) throw new Error("blocked");
        stored.delete(key);
      },
    },
    root,
  };
  return { deps, stored, root };
}

describe("theme", () => {
  it("defaults to light when nothing is stored", () => {
    const { deps } = fakeDeps();
    expect(createSettings(deps, "en").getTheme()).toBe("light");
  });

  it("reads a stored choice", () => {
    const { deps } = fakeDeps({ stored: { "zf.theme": "dark" } });
    expect(createSettings(deps, "en").getTheme()).toBe("dark");
  });

  it("ignores an unrecognised stored value", () => {
    // "system" was a valid value in an earlier version; it must now read as light.
    const { deps } = fakeDeps({ stored: { "zf.theme": "system" } });
    expect(createSettings(deps, "en").getTheme()).toBe("light");
  });

  it("persists an explicit choice", () => {
    const { deps, stored } = fakeDeps();
    const settings = createSettings(deps, "en");
    settings.setTheme("dark");
    expect(settings.getTheme()).toBe("dark");
    expect(stored.get("zf.theme")).toBe("dark");
  });

  it("persists light rather than clearing the key", () => {
    // Light is the default, but it is still written: an absent key and a
    // stored "light" must behave identically, and a future default change
    // should not silently rewrite a visitor's explicit choice.
    const { deps, stored } = fakeDeps({ stored: { "zf.theme": "dark" } });
    const settings = createSettings(deps, "en");
    settings.setTheme("light");
    expect(stored.get("zf.theme")).toBe("light");
  });

  it("applies the dark class to the document", () => {
    const { deps, root } = fakeDeps();
    const settings = createSettings(deps, "en");
    settings.setTheme("dark");
    expect(root.classList.toggle).toHaveBeenCalledWith("dark", true);
    settings.setTheme("light");
    expect(root.classList.toggle).toHaveBeenCalledWith("dark", false);
  });

  it("notifies subscribers, and stops after unsubscribe", () => {
    const { deps } = fakeDeps();
    const settings = createSettings(deps, "en");
    const listener = vi.fn();
    const unsubscribe = settings.onChange(listener);
    settings.setTheme("dark");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    settings.setTheme("light");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("lets a choice made this session win over stale storage (asymmetric read/write)", () => {
    const { deps, root } = fakeDeps({ stored: { "zf.theme": "dark" }, writesThrow: true });
    const settings = createSettings(deps, "en");
    settings.setTheme("light");
    expect(settings.getTheme()).toBe("light");
    expect(root.classList.toggle).toHaveBeenLastCalledWith("dark", false);
  });

  it("toggles back and forth with writes throwing", () => {
    const { deps } = fakeDeps({ writesThrow: true });
    const settings = createSettings(deps, "en");
    settings.setTheme("dark");
    expect(settings.getTheme()).toBe("dark");
    settings.setTheme("light");
    expect(settings.getTheme()).toBe("light");
  });
});

describe("language", () => {
  it("falls back to the supplied default", () => {
    const { deps, root } = fakeDeps();
    const settings = createSettings(deps, "hr");
    expect(settings.getLanguage()).toBe("hr");
    expect(root.lang).toBe("hr");
  });

  it("persists a choice and updates the document language", () => {
    const { deps, stored, root } = fakeDeps();
    const settings = createSettings(deps, "en");
    settings.setLanguage("hr");
    expect(settings.getLanguage()).toBe("hr");
    expect(stored.get("zf.lang")).toBe("hr");
    expect(root.lang).toBe("hr");
  });

  it("ignores an unrecognised stored value", () => {
    const { deps } = fakeDeps({ stored: { "zf.lang": "de" } });
    expect(createSettings(deps, "en").getLanguage()).toBe("en");
  });

  it("lets a choice made this session win over stale storage (asymmetric read/write)", () => {
    const { deps, root } = fakeDeps({ stored: { "zf.lang": "hr" }, writesThrow: true });
    const settings = createSettings(deps, "en");
    settings.setLanguage("en");
    expect(settings.getLanguage()).toBe("en");
    expect(root.lang).toBe("en");
  });
});

describe("blocked storage", () => {
  it("still works, keeping the choice in memory", () => {
    const { deps } = fakeDeps({ throwing: true });
    const settings = createSettings(deps, "en");
    expect(settings.getTheme()).toBe("light");
    expect(() => settings.setTheme("dark")).not.toThrow();
    expect(settings.getTheme()).toBe("dark");
  });
});

describe("themeColor", () => {
  it("returns the theme color for light and dark", () => {
    expect(themeColor("light")).toBe("#0161b0");
    expect(themeColor("dark")).toBe("#292929");
  });
});
