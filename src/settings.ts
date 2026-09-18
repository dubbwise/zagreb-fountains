export type Theme = "light" | "dark";
export type Language = "en" | "hr";

const THEME_KEY = "zf.theme";
const LANGUAGE_KEY = "zf.lang";
// Palette blue and palette black. Hex rather than oklch: this string goes into
// <meta name="theme-color">, which browsers parse outside the CSS pipeline.
const THEME_COLOR = { light: "#0161b0", dark: "#292929" } as const;

/** Light unless the visitor has chosen otherwise; the OS preference is not consulted. */
const DEFAULT_THEME: Theme = "light";

export interface SettingsDeps {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  root: { classList: { toggle(token: string, force: boolean): void }; lang: string };
}

export interface Settings {
  getTheme(): Theme;
  setTheme(theme: Theme): void;
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

  function write(key: string, value: string): void {
    try {
      deps.storage.setItem(key, value);
    } catch {
      // Keeping the choice in memory is better than failing the interaction.
    }
  }

  function getTheme(): Theme {
    if (memoryTheme !== null) return memoryTheme;
    const stored = read(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return DEFAULT_THEME;
  }

  function getLanguage(): Language {
    if (memoryLanguage !== null) return memoryLanguage;
    const stored = read(LANGUAGE_KEY);
    if (stored === "en" || stored === "hr") return stored;
    return defaultLanguage;
  }

  function apply(): void {
    deps.root.classList.toggle("dark", getTheme() === "dark");
    deps.root.lang = getLanguage();
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  apply();

  return {
    getTheme,
    getLanguage,
    setTheme(theme) {
      memoryTheme = theme;
      write(THEME_KEY, theme);
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

/** The colour the browser chrome should use for a given theme. */
export function themeColor(theme: Theme): string {
  return THEME_COLOR[theme];
}
