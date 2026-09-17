# Zagreb Fountains v1.1 Implementation Plan — Intro Screen, Theme and Language

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an intro screen over the map on every launch that explains the app, says why location is needed, carries the credits and a feedback link, and lets the visitor pick theme (System/Light/Dark) and language (English/Hrvatski) — holding the browser's location prompt until they continue.

**Architecture:** Three new vanilla modules. `settings.ts` owns theme and language with injected browser dependencies (the same pattern `watchLocation` already uses), `i18n/` holds the two string tables behind a module-level active language, and `ui/intro.ts` renders the overlay. `main.ts` changes boot order to settings → intro → (continue) → location. The map stops reading `matchMedia` itself and is told which theme to use.

**Tech Stack:** Unchanged — Vite 8, TypeScript 7 strict, Tailwind 4, Leaflet 1.9, Vitest 5, Playwright 1.63. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-17-zagreb-fountains-intro-design.md`

## Global Constraints

- Project root `/Users/bb/Sandbox/zagreb-fountains`, branch for this work: `feat/v1.1`. Base: `main` at the v1.1 spec commit.
- Node `>=22.12`. TypeScript `strict: true`, **no `any` in `src/`**.
- Every commit message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Browser APIs are injected, never imported directly into testable modules (`localStorage`, `matchMedia`, `document` for settings), so Vitest keeps running in the default node environment. **Do not add jsdom/happy-dom.**
- Storage keys: `zf.theme` (`"light"` | `"dark"`; absent = System), `zf.lang` (`"en"` | `"hr"`; absent = browser default).
- Every `localStorage` read and write is wrapped in try/catch; a throwing storage degrades to in-memory for the session.
- Attribution stays reachable from the map: the ⓘ control replaces the attribution bar and reopens the intro, which carries the full credits. CARTO's credit is listed only while its tiles are shown.
- Feedback address: `zg@paperbeatsrock.co`. Dataset link: `https://data.zagreb.hr/dataset/geoportal_javni_zdenci`.
- Croatian uses the informal register. Copy comes verbatim from the spec's two tables.
- All user-visible text lives in `src/i18n/en.ts` and `src/i18n/hr.ts`. `src/strings.ts` is deleted.
- The dark basemap still requires `VITE_CARTO_API_KEY` at build time; without it the light basemap serves both themes.

## Clarifications to the Spec

1. **Dependency injection over a DOM test environment.** The spec says `settings.ts` is unit-testable; this plan achieves that with `createSettings({ storage, media, root })` rather than adding a jsdom dependency, matching `watchLocation(geolocation, cb)` from v1.
2. **`theme-color` becomes one tag, updated by script.** Today there are two `<meta name="theme-color">` tags keyed to `prefers-color-scheme`. With a manual override those would contradict the chosen theme, so they collapse into one tag whose `content` is set whenever the theme is applied.
3. **The existing dark e2e scenario keeps passing unchanged**, because the default theme is System and `effectiveTheme()` then follows the emulated `colorScheme`.

## File Structure

```
src/
  settings.ts              # NEW: createSettings(deps) -> Settings
  i18n/
    index.ts               # NEW: Strings type, t(), setActiveLanguage(), detectLanguage()
    en.ts                  # NEW: English table (from strings.ts)
    hr.ts                  # NEW: Croatian table
  ui/
    intro.ts               # NEW: introHtml() + renderIntro()
    nearestCard.ts         # CHANGED: reads t() at render time
  map/map.ts               # CHANGED: setDark()/onInfoTap(), no matchMedia
  main.ts                  # CHANGED: boot order, subscriptions
  strings.ts               # DELETED
  style.css                # CHANGED: @custom-variant dark; .dark selectors
index.html                 # CHANGED: #intro, inline no-flash script, single theme-color
tests/
  settings.test.ts         # NEW
  i18n.test.ts             # NEW
  intro.test.ts            # NEW
  nearestCard.test.ts      # CHANGED: Croatian rendering case
e2e/verify.spec.ts         # CHANGED: intro helper + 4 new scenarios
```

---

### Task 1: Settings module

**Files:**
- Create: `src/settings.ts`
- Test: `tests/settings.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Theme = "system" | "light" | "dark"`, `type Language = "en" | "hr"`
  - `interface SettingsDeps { storage: Pick<Storage, "getItem" | "setItem" | "removeItem">; media: { matches: boolean; addEventListener(type: "change", listener: () => void): void }; root: { classList: { toggle(token: string, force: boolean): void }; lang: string } }`
  - `interface Settings { getTheme(): Theme; setTheme(theme: Theme): void; effectiveTheme(): "light" | "dark"; getLanguage(): Language; setLanguage(language: Language): void; onChange(listener: () => void): () => void }`
  - `createSettings(deps: SettingsDeps, defaultLanguage: Language): Settings`
  - `themeColor(effective: "light" | "dark"): string` — the `<meta name="theme-color">` value, used by `main.ts` in Task 5

- [ ] **Step 1: Write the failing test `tests/settings.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL — `../src/settings` cannot be resolved.

- [ ] **Step 3: Implement `src/settings.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: settings tests pass, existing 73 still pass, `tsc` silent.

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts tests/settings.test.ts
git commit -m "feat: add theme and language settings with injected browser deps

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Translations

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/hr.ts`
- Delete: `src/strings.ts`
- Modify: `src/ui/nearestCard.ts` (import `t()` instead of `strings`), `src/main.ts` (same)
- Test: `tests/i18n.test.ts`; update `tests/nearestCard.test.ts`

**Interfaces:**
- Consumes: `Language` from Task 1
- Produces:
  - `interface Strings` — the 12 card keys plus the intro keys listed below
  - `t(): Strings`, `setActiveLanguage(language: Language): void`, `detectLanguage(navigatorLanguage: string): Language`
  - `en`, `hr` tables

- [ ] **Step 1: Write the failing test `tests/i18n.test.ts`**

```ts
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
    setActiveLanguage("en");
    expect(t().nearestFountain).toBe("Nearest fountain");
    expect(t().walk(4)).toBe("~4 min walk");
    setActiveLanguage("hr");
    expect(t().nearestFountain).toBe("Najbliži zdenac");
    expect(t().walk(4)).toBe("~4 min hoda");
    setActiveLanguage("en");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/i18n.test.ts`
Expected: FAIL — `../src/i18n/en` cannot be resolved.

- [ ] **Step 3: Create `src/i18n/en.ts`**

```ts
export interface Strings {
  nearestFountain: string;
  selectedFountain: string;
  directions: string;
  retry: string;
  locating: string;
  enableLocation: string;
  outsideZagreb: string;
  unverified: string;
  cemetery: string;
  loadError: string;
  approx: string;
  walk: (minutes: number) => string;
  introTitle: string;
  introLede: string;
  introLocationHeading: string;
  introLocationBody: string;
  introThemeLabel: string;
  introThemeSystem: string;
  introThemeLight: string;
  introThemeDark: string;
  introLanguageLabel: string;
  introCreditsHeading: string;
  introCreditsMap: string;
  introCreditsData: string;
  introFeedback: string;
  introContinue: string;
  introOpen: string;
}

export const en: Strings = {
  nearestFountain: "Nearest fountain",
  selectedFountain: "Fountain",
  directions: "Directions",
  retry: "Retry",
  locating: "Finding your location…",
  enableLocation: "Enable location to find the nearest fountain",
  outsideZagreb: "No fountains mapped near you. Showing Zagreb.",
  unverified: "Status not confirmed",
  cemetery: "Cemetery — follows cemetery opening hours",
  loadError: "Couldn't load fountain data.",
  approx: "approx.",
  walk: (minutes) => `~${minutes} min walk`,
  introTitle: "Zagreb Fountains",
  introLede: "Find the nearest public drinking fountain in Zagreb, from the City of Zagreb's open data.",
  introLocationHeading: "Why your location?",
  introLocationBody: "It is used in your browser to work out which fountain is closest. It is never sent anywhere.",
  introThemeLabel: "Theme",
  introThemeSystem: "System",
  introThemeLight: "Light",
  introThemeDark: "Dark",
  introLanguageLabel: "Language",
  introCreditsHeading: "Credits",
  introCreditsMap: "Map: Leaflet, © OpenStreetMap contributors, dark basemap © CARTO.",
  introCreditsData: "Data: Grad Zagreb",
  introFeedback: "Feedback",
  introContinue: "Find water",
  introOpen: "About this map",
};
```

- [ ] **Step 4: Create `src/i18n/hr.ts`**

```ts
import type { Strings } from "./en";

export const hr: Strings = {
  nearestFountain: "Najbliži zdenac",
  selectedFountain: "Zdenac",
  directions: "Upute",
  retry: "Pokušaj ponovno",
  locating: "Tražim tvoju lokaciju…",
  enableLocation: "Uključi lokaciju za pronalazak najbližeg zdenca",
  outsideZagreb: "U tvojoj blizini nema zdenaca. Prikazujem Zagreb.",
  unverified: "Status nije potvrđen",
  cemetery: "Groblje — vrijedi radno vrijeme groblja",
  loadError: "Učitavanje podataka nije uspjelo.",
  approx: "otprilike",
  walk: (minutes) => `~${minutes} min hoda`,
  introTitle: "Zagrebački zdenci",
  introLede: "Pronađi najbliži javni zdenac s pitkom vodom u Zagrebu, iz otvorenih podataka Grada Zagreba.",
  introLocationHeading: "Zašto lokacija?",
  introLocationBody:
    "Koristi se u tvom pregledniku kako bi se izračunalo koji je zdenac najbliži. Nikamo se ne šalje.",
  introThemeLabel: "Tema",
  introThemeSystem: "Sustav",
  introThemeLight: "Svijetla",
  introThemeDark: "Tamna",
  introLanguageLabel: "Jezik",
  introCreditsHeading: "Zasluge",
  introCreditsMap: "Karta: Leaflet, © OpenStreetMap suradnici, tamna karta © CARTO.",
  introCreditsData: "Podaci: Grad Zagreb",
  introFeedback: "Povratne informacije",
  introContinue: "Pronađi vodu",
  introOpen: "O ovoj karti",
};
```

- [ ] **Step 5: Create `src/i18n/index.ts`**

```ts
import type { Language } from "../settings";
import { en, type Strings } from "./en";
import { hr } from "./hr";

export type { Strings };

const TABLES: Record<Language, Strings> = { en, hr };
let active: Language = "en";

export function setActiveLanguage(language: Language): void {
  active = language;
}

/** The active table. Call at render time so a language switch redraws. */
export function t(): Strings {
  return TABLES[active];
}

export function detectLanguage(navigatorLanguage: string): Language {
  return navigatorLanguage.toLowerCase().startsWith("hr") ? "hr" : "en";
}
```

- [ ] **Step 6: Point the card and main at `t()`**

In `src/ui/nearestCard.ts`, replace `import { strings } from "../strings";` with `import { t } from "../i18n";`, then replace every `strings.` with `t().` (there are 9 uses: `nearestFountain`, `selectedFountain`, `approx`, `walk`, `unverified`, `cemetery`, `directions`, `locating`, `enableLocation`, `outsideZagreb`, `retry`).

In `src/main.ts`, replace `import { strings } from "./strings";` with `import { t } from "./i18n";`, and use `t().loadError` and `t().retry` inside `showFatal`.

Then delete the old file: `git rm src/strings.ts`.

- [ ] **Step 7: Add a Croatian case to `tests/nearestCard.test.ts`**

Append inside the existing `describe("cardHtml")`, and import `setActiveLanguage` at the top of the file:

```ts
  it("renders in Croatian when that language is active", () => {
    setActiveLanguage("hr");
    try {
      const html = cardHtml(fountainState({ fountain: { ...BRITANSKI_TRG, status: "unverified" } }));
      expect(html).toContain("Najbliži zdenac");
      expect(html).toContain("240 m · ~4 min hoda");
      expect(html).toContain("Status nije potvrđen");
      expect(html).toContain("Upute");
    } finally {
      setActiveLanguage("en");
    }
  });
```

- [ ] **Step 8: Run tests, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green, and no file still imports `../strings`. Check with `grep -rn "from \"\.\./strings\"\|from \"\./strings\"" src` — expect no matches.

- [ ] **Step 9: Commit**

`src/strings.ts` was already removed with `git rm` in Step 6, so it is staged for deletion.

```bash
git add src/i18n tests/i18n.test.ts tests/nearestCard.test.ts src/ui/nearestCard.ts src/main.ts
git commit -m "feat: move UI text into English and Croatian tables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Class-based theme plumbing

**Files:**
- Modify: `src/style.css`, `index.html`, `src/map/map.ts`

**Interfaces:**
- Consumes: `Settings` (Task 1)
- Produces:
  - `FountainMap` gains `setDark(dark: boolean): void` and `onInfoTap(callback: () => void): void`
  - `createFountainMap(container, options: { dark: boolean })`
  - `.dark` on `<html>` drives every `dark:` utility and the Leaflet overrides

- [ ] **Step 1: Switch Tailwind's dark variant in `src/style.css`**

Add directly under the existing `@import "tailwindcss";`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Then change the Leaflet override block's opening line from `@media (prefers-color-scheme: dark) {` to `.dark {` — keeping every selector inside it exactly as-is, including the doubled classes that beat Leaflet's late-bundled rules. The comment above it should now read that Leaflet is bundled after this file and the theme comes from the `.dark` class.

- [ ] **Step 2: Update `index.html`**

Replace the two `theme-color` tags with one, add the no-flash script as the last element in `<head>`, and add the intro container to `<body>` before `#card`:

```html
    <meta name="theme-color" content="#0369a1" />
```

```html
    <script>
      // Mirrors apply() in src/settings.ts — keep the two in step. Runs before
      // first paint so dark-mode visitors never see a white flash.
      try {
        var storedTheme = localStorage.getItem("zf.theme");
        var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        var dark = storedTheme === "dark" || (storedTheme !== "light" && prefersDark);
        document.documentElement.classList.toggle("dark", dark);
        document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#020617" : "#0369a1");
        var storedLanguage = localStorage.getItem("zf.lang");
        if (storedLanguage === "hr" || storedLanguage === "en") document.documentElement.lang = storedLanguage;
      } catch (error) {
        /* storage blocked: fall through to the system theme */
      }
    </script>
```

```html
    <div id="intro" class="absolute inset-0 z-[1500] overflow-y-auto" role="dialog" aria-modal="true"></div>
```

- [ ] **Step 3: Make the map take its theme from outside**

In `src/map/map.ts`:
- Add `setDark(dark: boolean): void;` and `onInfoTap(callback: () => void): void;` to the `FountainMap` interface.
- Change the signature to `export function createFountainMap(container: HTMLElement, options: { dark: boolean }): FountainMap`.
- Delete the `darkQuery` constant, the `darkQuery.addEventListener("change", applyTheme)` line, and `useDarkTiles()`; replace with a mutable `let dark = options.dark && darkTiles !== null;` and a `useDarkTiles = (): boolean => dark`.
- Replace the attribution control with an ⓘ button control that calls the info callback, keeping the zoom control where it is:

```ts
  let onInfo: () => void = () => {};
  const InfoControl = L.Control.extend({
    onAdd(): HTMLElement {
      const container = L.DomUtil.create("div", "leaflet-bar");
      const link = L.DomUtil.create("a", "", container);
      link.href = "#";
      link.textContent = "ⓘ";
      link.setAttribute("role", "button");
      link.setAttribute("aria-label", "About this map");
      link.style.fontSize = "18px";
      L.DomEvent.on(link, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        onInfo();
      });
      return container;
    },
  });
  new InfoControl({ position: "topright" }).addTo(map);
```

- Delete `attribution.addAttribution(DATA_ATTRIBUTION)` and the two `attribution.*Attribution(...)` calls inside `applyTheme`, along with the now-unused `DATA_ATTRIBUTION`, `TILE_ATTRIBUTION` and `DARK_TILE_ATTRIBUTION` imports. The credits now live on the intro screen, reachable from this control.
- Export the two new methods from the returned object:

```ts
    setDark(next) {
      dark = next && darkTiles !== null;
      applyTheme();
    },
    onInfoTap(callback) {
      onInfo = callback;
    },
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: `tsc` fails first with `main.ts` not passing `options` to `createFountainMap` — that is fixed in Task 5. To keep this task self-contained, pass `{ dark: document.documentElement.classList.contains("dark") }` at the single call site in `main.ts` now, and leave the rest of `main.ts` for Task 5.

Then: `npm test` — expect the existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/style.css index.html src/map/map.ts src/main.ts
git commit -m "feat: drive dark mode from a class and let the map take its theme

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Intro screen

**Files:**
- Create: `src/ui/intro.ts`
- Test: `tests/intro.test.ts`

**Interfaces:**
- Consumes: `t()` (Task 2), `Theme`/`Language` (Task 1)
- Produces:
  - `introHtml(state: { theme: Theme; language: Language }): string`
  - `renderIntro(container: HTMLElement, state, handlers: { onTheme(theme: Theme): void; onLanguage(language: Language): void; onContinue(): void }): void`

- [ ] **Step 1: Write the failing test `tests/intro.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/intro.test.ts`
Expected: FAIL — `../src/ui/intro` cannot be resolved.

- [ ] **Step 3: Implement `src/ui/intro.ts`**

```ts
import { t } from "../i18n";
import type { Language, Theme } from "../settings";
import { escapeHtml } from "./nearestCard";

const FEEDBACK_EMAIL = "zg@paperbeatsrock.co";
const DATASET_URL = "https://data.zagreb.hr/dataset/geoportal_javni_zdenci";

const CHOICE_CLASS =
  "flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium aria-pressed:border-sky-700 aria-pressed:bg-sky-700 aria-pressed:text-white dark:border-slate-600 dark:aria-pressed:border-sky-500 dark:aria-pressed:bg-sky-600";

export interface IntroState {
  theme: Theme;
  language: Language;
}

function choice(attribute: string, value: string, label: string, active: boolean): string {
  return `<button type="button" ${attribute}="${value}" aria-pressed="${active ? "true" : "false"}" class="${CHOICE_CLASS}">${escapeHtml(label)}</button>`;
}

export function introHtml({ theme, language }: IntroState): string {
  const strings = t();
  const themeChoices = [
    choice("data-theme", "system", strings.introThemeSystem, theme === "system"),
    choice("data-theme", "light", strings.introThemeLight, theme === "light"),
    choice("data-theme", "dark", strings.introThemeDark, theme === "dark"),
  ].join("");
  const languageChoices = [
    choice("data-language", "en", "English", language === "en"),
    choice("data-language", "hr", "Hrvatski", language === "hr"),
  ].join("");

  return `<div class="min-h-full bg-slate-100 px-4 py-6 dark:bg-slate-950">
  <div class="mx-auto flex max-w-md flex-col gap-5">
    <header>
      <h1 class="text-2xl font-semibold">${escapeHtml(strings.introTitle)}</h1>
      <p class="mt-1 text-slate-700 dark:text-slate-300">${escapeHtml(strings.introLede)}</p>
    </header>

    <section>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">${escapeHtml(strings.introLocationHeading)}</h2>
      <p class="mt-1 text-slate-700 dark:text-slate-300">${escapeHtml(strings.introLocationBody)}</p>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(strings.introThemeLabel)}</h2>
      <div class="flex gap-2">${themeChoices}</div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(strings.introLanguageLabel)}</h2>
      <div class="flex gap-2">${languageChoices}</div>
    </section>

    <section class="text-sm text-slate-600 dark:text-slate-400">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(strings.introCreditsHeading)}</h2>
      <p class="mt-1">${escapeHtml(strings.introCreditsMap)}</p>
      <p class="mt-1">${escapeHtml(strings.introCreditsData)} (<a class="underline" href="${DATASET_URL}" target="_blank" rel="noopener">data.zagreb.hr</a>)</p>
      <p class="mt-1">${escapeHtml(strings.introFeedback)}: <a class="underline" href="mailto:${FEEDBACK_EMAIL}">${FEEDBACK_EMAIL}</a></p>
    </section>

    <button type="button" data-action="continue" class="sticky bottom-0 block w-full rounded-xl bg-sky-700 px-4 py-3 text-center font-semibold text-white active:bg-sky-800 dark:bg-sky-600 dark:active:bg-sky-500">${escapeHtml(strings.introContinue)}</button>
  </div>
</div>`;
}

export function renderIntro(
  container: HTMLElement,
  state: IntroState,
  handlers: { onTheme(theme: Theme): void; onLanguage(language: Language): void; onContinue(): void },
): void {
  container.innerHTML = introHtml(state);
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-theme]")) {
    button.addEventListener("click", () => handlers.onTheme(button.dataset.theme as Theme));
  }
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-language]")) {
    button.addEventListener("click", () => handlers.onLanguage(button.dataset.language as Language));
  }
  const continueButton = container.querySelector<HTMLButtonElement>('[data-action="continue"]');
  continueButton?.addEventListener("click", handlers.onContinue);
  continueButton?.focus();
}
```

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/intro.ts tests/intro.test.ts
git commit -m "feat: add the intro screen with theme, language and credits

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the boot sequence

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4
- Produces: the running app — intro first, location only after continuing, ⓘ reopens the intro, theme and language changes redraw both surfaces

- [ ] **Step 1: Rewrite the top of `src/main.ts`**

Replace the import block and the three element lookups with:

```ts
import "./style.css";
import { LOW_ACCURACY_M, RECOMPUTE_DISTANCE_M } from "./config";
import { loadFountains, type Fountain } from "./data/fountains";
import { detectLanguage, setActiveLanguage, t } from "./i18n";
import { findNearest, haversineMeters, isNearZagreb, type LatLon, type NearestResult } from "./geo/distance";
import { watchLocation, type LocationEvent } from "./geo/location";
import { createFountainMap, type UserPosition } from "./map/map";
import { createSettings, themeColor } from "./settings";
import { directionsUrl } from "./ui/directions";
import { renderIntro } from "./ui/intro";
import { escapeHtml, renderCard, type CardState } from "./ui/nearestCard";

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

const settings = createSettings(
  {
    storage: localStorage,
    media: window.matchMedia("(prefers-color-scheme: dark)"),
    root: document.documentElement,
  },
  detectLanguage(navigator.language),
);
setActiveLanguage(settings.getLanguage());

const map = createFountainMap(byId("map"), { dark: settings.effectiveTheme() === "dark" });
const cardElement = byId("card");
const fatalElement = byId("fatal");
const introElement = byId("intro");
let locationStarted = false;
```

- [ ] **Step 2: Add the intro control functions**

Insert above `boot()`:

```ts
function drawIntro(): void {
  renderIntro(
    introElement,
    { theme: settings.getTheme(), language: settings.getLanguage() },
    {
      onTheme: (theme) => settings.setTheme(theme),
      onLanguage: (language) => settings.setLanguage(language),
      onContinue: closeIntro,
    },
  );
}

function openIntro(): void {
  introElement.classList.remove("hidden");
  drawIntro();
}

/** Continuing starts the location watch once; reopening later must not re-prompt. */
function closeIntro(): void {
  introElement.classList.add("hidden");
  if (locationStarted) return;
  locationStarted = true;
  startLocation();
}

settings.onChange(() => {
  setActiveLanguage(settings.getLanguage());
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor(settings.effectiveTheme()));
  map.setDark(settings.effectiveTheme() === "dark");
  if (!introElement.classList.contains("hidden")) drawIntro();
  update();
});

map.onInfoTap(openIntro);

// The spec treats Escape as "continue": same effect, including starting the
// location watch the first time.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !introElement.classList.contains("hidden")) closeIntro();
});
```

- [ ] **Step 3: Swap `strings` for `t()` and change `boot()`**

In `showFatal`, use `t().loadError` and `t().retry`. Replace `boot()` with:

```ts
async function boot(): Promise<void> {
  fatalElement.classList.add("hidden");
  try {
    fountains = await loadFountains(`${import.meta.env.BASE_URL}data/fountains.json`);
  } catch (error) {
    console.error(error);
    showFatal();
    return;
  }
  map.setFountains(fountains);
  update();
}

openIntro();
void boot();
```

Delete the old trailing `void boot();` so it appears once. The map renders behind the intro while the visitor reads, and `startLocation()` now runs only from `closeIntro`.

- [ ] **Step 4: Verify by hand**

Run: `npm run typecheck && npm test && npm run build && npx vite preview --port 4173 --strictPort > /tmp/zf-preview.log 2>&1 &`
Then: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/` → expect `200`; `curl -s http://localhost:4173/ | grep -c 'id="intro"'` → expect `1`.
Stop the server: `lsof -ti tcp:4173 | xargs kill`, and confirm the port is free.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: show the intro before the map and defer the location prompt

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Browser tests

**Files:**
- Modify: `e2e/verify.spec.ts`

**Interfaces:**
- Consumes: the running app (Task 5)
- Produces: 10 passing scenarios and three screenshots to review

- [ ] **Step 1: Replace `openApp` and add a geolocation spy**

```ts
/** Records watchPosition calls so a test can prove the prompt was not fired. */
async function spyOnGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = navigator.geolocation;
    const original = target.watchPosition.bind(target);
    (window as unknown as { __watchCalls: number }).__watchCalls = 0;
    target.watchPosition = ((...args: Parameters<Geolocation["watchPosition"]>) => {
      (window as unknown as { __watchCalls: number }).__watchCalls += 1;
      return original(...args);
    }) as Geolocation["watchPosition"];
  });
}

async function openApp(page: Page, options: { skipIntro?: boolean } = {}): Promise<void> {
  await spyOnGeolocation(page);
  await page.goto("/");
  await expect(page.locator("#intro")).toBeVisible();
  if (options.skipIntro === false) return;
  await page.getByRole("button", { name: /Find water|Pronađi vodu/ }).click();
  await expect(page.locator("#intro")).toBeHidden();
  await expect(page.locator("path.leaflet-interactive")).not.toHaveCount(0);
}
```

Every existing scenario keeps calling `openApp(page)` unchanged.

- [ ] **Step 2: Add the four new scenarios**

```ts
test.describe("the intro screen", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 }, permissions: ["geolocation"] });

  test("explains the app and holds the location prompt until you continue", async ({ page }) => {
    await openApp(page, { skipIntro: false });
    const intro = page.locator("#intro");
    await expect(intro).toContainText("Why your location?");
    await expect(intro).toContainText("© OpenStreetMap contributors");
    await expect(intro.getByRole("link", { name: "zg@paperbeatsrock.co" })).toHaveAttribute(
      "href",
      "mailto:zg@paperbeatsrock.co",
    );
    expect(await page.evaluate(() => (window as unknown as { __watchCalls: number }).__watchCalls)).toBe(0);
    await page.screenshot({ path: `${SCREENSHOTS}/6-intro-light.png` });

    await page.getByRole("button", { name: "Find water" }).click();
    await expect(intro).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __watchCalls: number }).__watchCalls))
      .toBeGreaterThan(0);
    await expect(page.locator("#card")).toContainText("Nearest fountain");
  });

  test("reopens from the map without asking for location again", async ({ page }) => {
    await openApp(page);
    const callsAfterContinue = await page.evaluate(
      () => (window as unknown as { __watchCalls: number }).__watchCalls,
    );
    await page.getByRole("button", { name: "About this map" }).click();
    await expect(page.locator("#intro")).toBeVisible();
    await page.getByRole("button", { name: "Find water" }).click();
    await expect(page.locator("#intro")).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __watchCalls: number }).__watchCalls)).toBe(
      callsAfterContinue,
    );
  });
});

test.describe("theme override", () => {
  test.use({
    colorScheme: "light",
    geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 },
    permissions: ["geolocation"],
  });

  test("Dark wins over a light system setting", async ({ page }) => {
    await openApp(page, { skipIntro: false });
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: `${SCREENSHOTS}/7-intro-dark.png` });

    await page.getByRole("button", { name: "Find water" }).click();
    await expect(page.locator(".leaflet-tile").first()).toHaveAttribute("src", /cartocdn\.com\/dark_all/);
  });
});

test.describe("language", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 }, permissions: ["geolocation"] });

  test("Hrvatski translates the card and survives a reload", async ({ page }) => {
    await openApp(page, { skipIntro: false });
    await page.getByRole("button", { name: "Hrvatski" }).click();
    await expect(page.locator("#intro")).toContainText("Zašto lokacija?");
    await page.getByRole("button", { name: "Pronađi vodu" }).click();

    const card = page.locator("#card");
    await expect(card).toContainText("Najbliži zdenac");
    await expect(card).toContainText(/\d+ m · ~\d+ min hoda/);
    await waitForTiles(page);
    await page.screenshot({ path: `${SCREENSHOTS}/8-croatian.png` });

    await page.reload();
    await expect(page.locator("#intro")).toContainText("Pronađi vodu");
    await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  });
});
```

- [ ] **Step 3: Run the suite**

Run: `npm run verify`
Expected: `10 passed`. If the denied-permission scenario times out, check that `openApp` still continues past the intro before the card is asserted.
Afterwards: `lsof -ti tcp:4173` prints nothing.

- [ ] **Step 4: Inspect the screenshots**

Open `e2e/screenshots/6-intro-light.png`, `7-intro-dark.png` and `8-croatian.png` and confirm:
1. The intro fits a phone screen, the continue button is reachable, and the credits and feedback link are legible.
2. In dark, the intro, its buttons and the selected-choice highlight all read correctly.
3. The Croatian card shows "Najbliži zdenac" and "min hoda", with no English left on screen.

- [ ] **Step 5: Commit**

```bash
git add e2e/verify.spec.ts
git commit -m "test: cover the intro, theme override and Croatian in the browser

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-09-16-remaining-work.md`

**Interfaces:**
- Consumes: the finished feature
- Produces: docs that match the shipped behaviour

- [ ] **Step 1: Update the README's "Appearance" section**

Replace it with a section covering: the intro screen on every launch and the ⓘ button that reopens it; theme System/Light/Dark stored under `zf.theme` with absent meaning System; language English/Hrvatski stored under `zf.lang`, defaulting to the browser; that attribution lives on the intro screen and behind the ⓘ control; and that adding a language means a new table in `src/i18n/` plus a `Strings` implementation.

- [ ] **Step 2: Note the shipped items in the remaining-work plan**

Under section 5 ("Later versions"), mark Croatian localization done, with the date and a pointer to the v1.1 spec.

- [ ] **Step 3: Full verification before handing over**

Run: `npm run typecheck && npm test && npm run build && npm run verify`
Expected: unit suite green (73 existing plus the new settings, i18n, intro and Croatian card cases), build clean, `10 passed` in the browser suite.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/plans/2026-09-16-remaining-work.md
git commit -m "docs: describe the intro screen, theme and language settings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Pre-merge checklist

- [ ] `.env.local` still ignored; no key committed.
- [ ] The ⓘ control is visible on the map at phone width, and the intro carries the OpenStreetMap, CARTO and Grad Zagreb credits.
- [ ] Croatian reviewed by the user (register, "Pronađi vodu", "Zagrebački zdenci").
- [ ] Deploy and check on a phone: intro readable, prompt only after continuing, theme and language stick across a reload.
