# Zagreb Fountains v1.1 — Intro Screen, Theme and Language

**Date:** 2026-09-17
**Status:** Approved in brainstorming, pending spec review
**Builds on:** `docs/superpowers/specs/2026-09-15-zagreb-fountains-design.md` (v1, live at https://dubbwise.github.io/zagreb-fountains/)

## Goal

Give first-time visitors context before the map takes over the screen: what the site is, why it wants their location, who the data and map come from, and where to send feedback. Let them choose theme and language there, and hold the browser's location prompt until they have read why it is asked for.

## Decisions locked in brainstorming

1. The intro appears **on every launch**, not once. It is not a dismissible tip.
2. It carries the explainer, credits, feedback link, **theme** (System / Light / Dark) and **language** (English / Hrvatski).
3. The location prompt fires **after** the visitor continues, never while the intro is up.
4. Vanilla implementation — no UI framework (approach A of three considered).
5. Croatian uses the informal register ("Uključi lokaciju"). Open for correction in review.

## Scope

**In**
- Intro overlay with the content below, in both languages
- Theme setting with persistence, overriding the system preference
- Language setting with persistence, defaulting to the browser language
- Basemap, card, page and Leaflet chrome all follow the chosen theme
- Map attribution compacted to an ⓘ button that reopens the intro
- Croatian translations of all existing UI text

**Out (unchanged from v1)**
- Offline support, filters, user reports, OpenStreetMap merging
- Any server-side component; the app stays a static site
- Remembering that the intro was seen (deliberately: it shows every launch)

## Constraint: attribution must stay on the map

CARTO's basemap terms require their credit to stay on the map, and the OpenStreetMap tile policy says the same. Credits therefore appear in **both** places: in full on the intro screen, and behind an always-visible ⓘ button on the map. The ⓘ button is a Leaflet control in the top-right, where the attribution bar sits today.

## Architecture

```
src/
  settings.ts            # theme + language state, persistence, subscribers
  i18n/
    index.ts             # active table, t(), language detection
    en.ts                # English table (moved from strings.ts)
    hr.ts                # Croatian table
  ui/
    intro.ts             # renders the overlay, wires its controls
    nearestCard.ts       # reads the active table at render time
  map/map.ts             # basemap follows settings; ⓘ control replaces the attribution bar
  main.ts                # boot: settings → intro → (continue) → location
index.html               # #intro element + inline no-flash script
src/style.css            # @custom-variant dark; Leaflet overrides keyed off .dark
```

`src/strings.ts` is deleted; its 12 entries become `i18n/en.ts`.

### Module contracts

| Module | Exports | Notes |
|---|---|---|
| `settings.ts` | `type Theme = "system" \| "light" \| "dark"`, `type Language = "en" \| "hr"`, `getTheme()`, `setTheme()`, `getLanguage()`, `setLanguage()`, `effectiveTheme()`, `onChange(cb)` | Applies `.dark` to `<html>` and `lang` to `<html>`; notifies subscribers |
| `i18n/index.ts` | `type Strings`, `t(): Strings`, `detectLanguage(navigatorLanguage)` | `t()` returns the table for the current language |
| `ui/intro.ts` | `renderIntro(container, { onContinue })`, `showIntro()`, `hideIntro()` | Re-renders itself on settings change |
| `map/map.ts` | unchanged public interface, plus `onInfoTap(cb)` | Basemap switches on `settings.onChange` |

## Settings behaviour

- **Storage keys:** `zf.theme`, `zf.lang`. **Absent means default** — System for theme, browser language for language. Nothing is written for the default, matching Tailwind's documented pattern.
- **Effective theme:** the stored choice, else `matchMedia("(prefers-color-scheme: dark)")`. The result toggles `.dark` on `<html>`.
- **Tailwind:** `src/style.css` declares `@custom-variant dark (&:where(.dark, .dark *));` so every existing `dark:` class follows the class instead of the media query. The Leaflet chrome overrides move from `@media (prefers-color-scheme: dark)` to `.dark` selectors, keeping the extra specificity they need to beat Leaflet's own late-bundled rules.
- **No flash:** an inline script in `<head>` applies the class before first paint. It duplicates a one-line read of `localStorage`; both copies carry a comment pointing at the other.
- **System changes** are followed live only while the theme is System.
- **Blocked storage:** every read and write is wrapped in `try/catch`. A private window that throws falls back to in-memory settings for the session; the app still runs.
- **Language default:** `navigator.language` starting with `hr` selects Croatian, otherwise English. `<html lang>` is updated on every change.
- **Map:** the basemap layer subscribes to settings, so Dark on a light phone still gets CARTO tiles, and switching redraws without a reload. CARTO's credit is listed only while its tiles are on the map.

## Intro screen

A scrollable panel over the map, `role="dialog"`, `aria-modal="true"`, with the continue button pinned at the bottom. Focus moves to that button on open. Escape behaves like continue. Theme and language changes re-render the panel immediately, so the effect is visible before continuing.

### Content

| Element | English | Hrvatski |
|---|---|---|
| Title | Zagreb Fountains | Zagrebački zdenci |
| Lede | Find the nearest public drinking fountain in Zagreb, from the City of Zagreb's open data. | Pronađi najbliži javni zdenac s pitkom vodom u Zagrebu, iz otvorenih podataka Grada Zagreba. |
| Location heading | Why your location? | Zašto lokacija? |
| Location body | It is used in your browser to work out which fountain is closest. It is never sent anywhere. | Koristi se u tvom pregledniku kako bi se izračunalo koji je zdenac najbliži. Nikamo se ne šalje. |
| Theme label | Theme | Tema |
| Theme options | System / Light / Dark | Sustav / Svijetla / Tamna |
| Language label | Language | Jezik |
| Credits heading | Credits | Zasluge |
| Credits body | Map: Leaflet, © OpenStreetMap contributors, dark basemap © CARTO. Data: Grad Zagreb (data.zagreb.hr). | Karta: Leaflet, © OpenStreetMap suradnici, tamna karta © CARTO. Podaci: Grad Zagreb (data.zagreb.hr). |
| Feedback | Feedback: zg@paperbeatsrock.co | Povratne informacije: zg@paperbeatsrock.co |
| Continue button | Find water | Pronađi vodu |

The dataset name links to https://data.zagreb.hr/dataset/geoportal_javni_zdenci; the feedback address is a `mailto:` link.

### Flow

1. Page loads. Settings apply, the map renders behind the overlay, and the intro is shown. **No location prompt yet.**
2. The visitor may switch theme or language; both persist immediately.
3. Continue (or Escape) hides the intro and starts the location watch, so the browser prompt appears now.
4. The ⓘ control reopens the same panel later. Closing it from there does **not** restart the location watch, and does not re-prompt.

## Translated UI text

| Key | English | Hrvatski |
|---|---|---|
| `nearestFountain` | Nearest fountain | Najbliži zdenac |
| `selectedFountain` | Fountain | Zdenac |
| `directions` | Directions | Upute |
| `retry` | Retry | Pokušaj ponovno |
| `locating` | Finding your location… | Tražim tvoju lokaciju… |
| `enableLocation` | Enable location to find the nearest fountain | Uključi lokaciju za pronalazak najbližeg zdenca |
| `outsideZagreb` | No fountains mapped near you. Showing Zagreb. | U tvojoj blizini nema zdenaca. Prikazujem Zagreb. |
| `unverified` | Status not confirmed | Status nije potvrđen |
| `cemetery` | Cemetery — follows cemetery opening hours | Groblje — vrijedi radno vrijeme groblja |
| `loadError` | Couldn't load fountain data. | Učitavanje podataka nije uspjelo. |
| `approx` | approx. | otprilike |
| `walk(n)` | ~{n} min walk | ~{n} min hoda |

Both tables are typed by one `Strings` type, so a missing Croatian key is a compile error. Distance formatting (`240 m`, `1.2 km`) is unchanged and shared.

## Error and edge states

| Situation | Behaviour |
|---|---|
| `localStorage` throws or is blocked | Settings fall back to in-memory for the session; no crash, no console noise beyond one warning |
| Visitor never continues | No location prompt, ever; the map sits behind the intro |
| Language switched while the card shows a fountain | Card re-renders in the new language, same fountain, same distance |
| Theme switched to Dark on a light system | `.dark` applies, basemap swaps to CARTO, Leaflet chrome darkens |
| No CARTO key configured | Dark theme keeps the light basemap; everything else still darkens (unchanged from v1) |
| Fountain data fails to load | The existing full-screen error still applies, after the intro is dismissed |

## Testing

**Unit (Vitest)**
- `settings`: defaults with empty storage; persistence round-trip; `effectiveTheme()` following the system query only when System; explicit choices ignoring system changes; storage that throws on read and on write; `<html>` class and `lang` updates.
- `i18n`: both tables have identical keys; `detectLanguage()` for `hr`, `hr-HR`, `en-GB`, `de`; `walk()` output per language.
- `nearestCard`: renders a fountain in Croatian, including badges and the walk line.

**Browser (Playwright)**
- The intro appears on load and no location prompt fires while it is up.
- Continue hides it, and the nearest-fountain card then appears.
- Dark forces a dark card and CARTO tiles while the emulated system is light.
- Hrvatski switches the card to Croatian and persists across a reload.
- ⓘ reopens the intro, and closing it does not re-prompt for location.
- The five existing scenarios gain a shared helper that continues past the intro first.

**Screenshots to review:** intro in light, intro in dark, map with Croatian text.

## Open questions for review

1. Croatian register: informal "ti" throughout, as drafted. Formal "vi" is a one-file change.
2. Button wording "Find water" / "Pronađi vodu" rather than a plain "Continue".
3. Title in Croatian: "Zagrebački zdenci" — or keep the English name untranslated?

## Risks

- **Duplicate no-flash logic** in `index.html` and `settings.ts`. Mitigated by a comment in both; the alternative is a flash of the wrong theme on every load.
- **Every-launch intro** adds a tap for regulars. That was the explicit decision; the ⓘ button and the fast path (one button, focused on open) keep it cheap.
- **Attribution compliance** depends on the ⓘ control remaining visible. Any future redesign of the map chrome must keep it.
