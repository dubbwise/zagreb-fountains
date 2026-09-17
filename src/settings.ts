export type Theme = "system" | "light" | "dark";
export type Language = "en" | "hr";

const THEME_KEY = "zf.theme";
const LANGUAGE_KEY = "zf.lang";
const THEME_COLOR = { light: "#0369a1", dark: "#020617" } as const;

export interface SettingsDeps {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  media: { matches: boolean; addEventListener(type: "change", listener: () => void): void };
  root: { classList: { toggle(token: string, force: boolean): void }; lang: string };
}

export interface Settings {
  getTheme(): Theme;
  setTheme(theme: Theme): void;
  effectiveTheme(): "light" | "dark";
  getLanguage(): Language;
  setLanguage(language: Language): void;
  onChange(listener: () => void): () => void;
}

/**
 * Browser APIs come in as dependencies so this stays unit-testable in node, the
 * same way watchLocation() takes a Geolocation.
 */
export function createSettings(deps: SettingsDeps, defaultLanguage: Language): Settings {
  // Falls back to memory when storage throws (private windows, blocked cookies).
  let memoryTheme: Theme | null = null;
  let memoryLanguage: Language | null = null;
  let listeners: Array<() => void> = [];

  function read(key: string): string | null {
    try {
      return deps.storage.getItem(key);
    } catch {
      return null;
    }
  }

  function write(key: string, value: string | null): void {
    try {
      if (value === null) deps.storage.removeItem(key);
      else deps.storage.setItem(key, value);
    } catch {
      // Keeping the choice in memory is better than failing the interaction.
    }
  }

  function getTheme(): Theme {
    const stored = read(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return memoryTheme ?? "system";
  }

  function getLanguage(): Language {
    const stored = read(LANGUAGE_KEY);
    if (stored === "en" || stored === "hr") return stored;
    return memoryLanguage ?? defaultLanguage;
  }

  function effectiveTheme(): "light" | "dark" {
    const theme = getTheme();
    if (theme !== "system") return theme;
    return deps.media.matches ? "dark" : "light";
  }

  function apply(): void {
    const dark = effectiveTheme() === "dark";
    deps.root.classList.toggle("dark", dark);
    deps.root.lang = getLanguage();
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  deps.media.addEventListener("change", () => {
    if (getTheme() !== "system") return;
    apply();
    notify();
  });

  apply();

  return {
    getTheme,
    effectiveTheme,
    getLanguage,
    setTheme(theme) {
      memoryTheme = theme === "system" ? null : theme;
      write(THEME_KEY, theme === "system" ? null : theme);
      apply();
      notify();
    },
    setLanguage(language) {
      memoryLanguage = language;
      write(LANGUAGE_KEY, language);
      apply();
      notify();
    },
    onChange(listener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
  };
}

/** The colour the browser chrome should use for a given effective theme. */
export function themeColor(effective: "light" | "dark"): string {
  return THEME_COLOR[effective];
}
