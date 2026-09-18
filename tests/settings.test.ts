import { describe, expect, it, vi } from "vitest";
import { createSettings, themeColor, type SettingsDeps } from "../src/settings";

function fakeDeps(
  overrides: { stored?: Record<string, string>; prefersDark?: boolean; throwing?: boolean; writesThrow?: boolean } = {},
) {
  const stored = new Map(Object.entries(overrides.stored ?? {}));
  const mediaListeners: Array<() => void> = [];
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
    media: {
      matches: overrides.prefersDark ?? false,
      addEventListener: (_type, listener) => mediaListeners.push(listener),
    },
    root,
  };
  return { deps, stored, root, fireMediaChange: () => mediaListeners.forEach((listener) => listener()) };
}

describe("theme", () => {
  it("defaults to system and follows the media query", () => {
    const { deps } = fakeDeps({ prefersDark: true });
    const settings = createSettings(deps, "en");
    expect(settings.getTheme()).toBe("system");
    expect(settings.effectiveTheme()).toBe("dark");
  });

  it("an explicit choice overrides the media query", () => {
    const { deps, stored } = fakeDeps({ prefersDark: true });
    const settings = createSettings(deps, "en");
    settings.setTheme("light");
    expect(settings.effectiveTheme()).toBe("light");
    expect(stored.get("zf.theme")).toBe("light");
  });

  it("choosing system clears the stored value", () => {
    const { deps, stored } = fakeDeps({ stored: { "zf.theme": "dark" } });
    const settings = createSettings(deps, "en");
    expect(settings.getTheme()).toBe("dark");
    settings.setTheme("system");
    expect(stored.has("zf.theme")).toBe(false);
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

  it("follows live system changes only while set to system", () => {
    const { deps, fireMediaChange } = fakeDeps();
    const settings = createSettings(deps, "en");
    const listener = vi.fn();
    settings.onChange(listener);

    deps.media.matches = true;
    fireMediaChange();
    expect(settings.effectiveTheme()).toBe("dark");
    expect(listener).toHaveBeenCalledTimes(1);

    settings.setTheme("light");
    listener.mockClear();
    deps.media.matches = false;
    fireMediaChange();
    expect(settings.effectiveTheme()).toBe("light");
    expect(listener).not.toHaveBeenCalled();
  });

  it("lets a choice made this session win over stale storage (asymmetric read/write)", () => {
    const { deps, root } = fakeDeps({ stored: { "zf.theme": "dark" }, writesThrow: true });
    const settings = createSettings(deps, "en");
    settings.setTheme("light");
    expect(settings.getTheme()).toBe("light");
    expect(settings.effectiveTheme()).toBe("light");
    expect(root.classList.toggle).toHaveBeenLastCalledWith("dark", false);
  });

  it("choosing system after an explicit choice, with writes throwing", () => {
    const { deps } = fakeDeps({ writesThrow: true });
    const settings = createSettings(deps, "en");
    settings.setTheme("dark");
    expect(settings.getTheme()).toBe("dark");
    settings.setTheme("system");
    expect(settings.getTheme()).toBe("system");
    expect(settings.effectiveTheme()).toBe("light");
    deps.media.matches = true;
    expect(settings.effectiveTheme()).toBe("dark");
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
    expect(settings.getTheme()).toBe("system");
    expect(() => settings.setTheme("dark")).not.toThrow();
    expect(settings.getTheme()).toBe("dark");
    expect(settings.effectiveTheme()).toBe("dark");
  });
});

describe("themeColor", () => {
  it("returns the theme color for light and dark", () => {
    expect(themeColor("light")).toBe("#3376b8");
    expect(themeColor("dark")).toBe("#292929");
  });
});
