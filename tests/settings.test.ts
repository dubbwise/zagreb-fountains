import { describe, expect, it, vi } from "vitest";
import { createSettings, type SettingsDeps } from "../src/settings";

function fakeDeps(overrides: { stored?: Record<string, string>; prefersDark?: boolean; throwing?: boolean } = {}) {
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
        if (overrides.throwing) throw new Error("blocked");
        stored.set(key, value);
      },
      removeItem: (key) => {
        if (overrides.throwing) throw new Error("blocked");
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

  it("applies the dark class and the theme colour to the document", () => {
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
