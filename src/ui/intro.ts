import { CARTO_ATTRIBUTIONS_URL, OSM_COPYRIGHT_URL } from "../config";
import { t, type Strings } from "../i18n";
import type { Language, Theme } from "../settings";
import { FLAG_EN, FLAG_HR } from "./flags";
import { ICON_DARK, ICON_LIGHT, ICON_SYSTEM } from "./icons";
import { escapeHtml } from "./nearestCard";

const FEEDBACK_EMAIL = "zg@paperbeatsrock.co";
const DATASET_URL = "https://data.zagreb.hr/dataset/geoportal_javni_zdenci";
const LINK_CLASS = "underline";

const CHOICE_CLASS = "btn-choice";

export interface IntroState {
  theme: Theme;
  language: Language;
}

/**
 * `icon` is trusted markup (a flag from ./flags), so it is not escaped. The
 * visible label is escaped; when it is empty, an explicit `ariaLabel` carries
 * the accessible name (used for the icon-only language toggles).
 */
function choice(
  attribute: string,
  value: string,
  label: string,
  active: boolean,
  icon = "",
  buttonClass = CHOICE_CLASS,
  ariaLabel?: string,
): string {
  const labelAttr = ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : "";
  return `<button type="button" ${attribute}="${value}" aria-pressed="${active ? "true" : "false"}" class="${buttonClass}" ${labelAttr}>${icon}${escapeHtml(label)}</button>`;
}

/**
 * OpenStreetMap's attribution guidance and CARTO's basemap terms both require
 * the credit to link to their respective attribution page. "Leaflet" and the
 * two proper nouns are literal, untranslated text; only the surrounding
 * fragments come from the i18n tables, and those are still escaped before
 * they reach innerHTML — the URLs come from src/config.ts, not from
 * translated (and therefore untrusted) strings.
 */
function creditsMapHtml(strings: Strings): string {
  const osmLink = `<a class="${LINK_CLASS}" href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noopener">OpenStreetMap</a>`;
  const cartoLink = `<a class="${LINK_CLASS}" href="${CARTO_ATTRIBUTIONS_URL}" target="_blank" rel="noopener">CARTO</a>`;
  return (
    `${escapeHtml(strings.introCreditsMapPrefix)} Leaflet, © ${osmLink} ${escapeHtml(strings.introCreditsContributors)}, ` +
    `${escapeHtml(strings.introCreditsDarkBasemap)} © ${cartoLink}.`
  );
}

export function introHtml({ theme, language }: IntroState): string {
  const strings = t();
  const themeChoices = [
    choice("data-theme", "system", "", theme === "system", ICON_SYSTEM, "btn-choice-subtle", strings.introThemeSystem),
    choice("data-theme", "light", "", theme === "light", ICON_LIGHT, "btn-choice-subtle", strings.introThemeLight),
    choice("data-theme", "dark", "", theme === "dark", ICON_DARK, "btn-choice-subtle", strings.introThemeDark),
  ].join("");
  const languageChoices = [
    choice("data-language", "hr", "", language === "hr", FLAG_HR, "btn-choice-subtle", "Hrvatski"),
    choice("data-language", "en", "", language === "en", FLAG_EN, "btn-choice-subtle", "English"),
  ].join("");

  // No background here: #intro already paints the surface behind this panel.
  return `<div class="flex min-h-full flex-col md:p-8">
  <div class="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 bg-surface p-6 md:p-12 rounded-lg ring-1 md:ring-12 ring-edge">
    <section>
      <div class="flex items-center justify-between gap-2">
        <div class="flex gap-2" role="group" aria-label="${escapeHtml(strings.introLanguageLabel)}">${languageChoices}</div>
        <div class="flex gap-2" role="group" aria-label="${escapeHtml(strings.introThemeLabel)}">${themeChoices}</div>
      </div>
    </section>

    <header class="mt-4">
      <h1 id="intro-title" class="text-5xl font-semibold">${escapeHtml(strings.introTitle)}</h1>
    </header>

    <button type="button" data-action="continue" class="btn-primary mt-4">${escapeHtml(strings.introContinue)}</button>
    
    <section class="mb-auto">
      <h2 class="label-caps text-sm text-accent-ink hidden">${escapeHtml(strings.introLocationHeading)}</h2>
      <p class="mt-1 text-body">${escapeHtml(strings.introLocationBody)}</p>
    </section>
    

    <section class="text-xs text-body-subtle">
      <h2 class="label-caps text-sm text-body-subtle">${escapeHtml(strings.introCreditsHeading)}</h2>
      <p class="mt-1">${creditsMapHtml(strings)}</p>
      <p class="mt-1">${escapeHtml(strings.introCreditsData)} (<a class="${LINK_CLASS}" href="${DATASET_URL}" target="_blank" rel="noopener">data.zagreb.hr</a>)</p>
      <p class="mt-1">${escapeHtml(strings.introFeedback)}: <a class="${LINK_CLASS}" href="mailto:${FEEDBACK_EMAIL}">${FEEDBACK_EMAIL}</a></p>
    </section>
  </div>
</div>`;
}

export function renderIntro(
  container: HTMLElement,
  state: IntroState,
  handlers: { onTheme(theme: Theme): void; onLanguage(language: Language): void; onContinue(): void },
): void {
  // Before re-rendering, remember which control has focus so we can restore it after.
  // This prevents focus theft when a settings change (theme or language selection) re-renders the panel.
  let focusSelector: string | null = null;
  const active = document.activeElement;
  if (active && container.contains(active)) {
    const elem = active as HTMLElement;
    const theme = elem.getAttribute("data-theme");
    const language = elem.getAttribute("data-language");
    const action = elem.getAttribute("data-action");
    if (theme !== null) focusSelector = `[data-theme="${theme}"]`;
    else if (language !== null) focusSelector = `[data-language="${language}"]`;
    else if (action !== null) focusSelector = `[data-action="${action}"]`;
  }

  container.innerHTML = introHtml(state);
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-theme]")) {
    // Safari does not focus a <button> on click, so document.activeElement
    // would otherwise stay <body> and the restore logic above would have
    // nothing to go on. Focusing explicitly records the intent regardless of
    // browser click-focus behaviour, before the settings change re-renders.
    button.addEventListener("click", () => {
      button.focus();
      handlers.onTheme(button.dataset.theme as Theme);
    });
  }
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-language]")) {
    button.addEventListener("click", () => {
      button.focus();
      handlers.onLanguage(button.dataset.language as Language);
    });
  }
  const continueButton = container.querySelector<HTMLButtonElement>('[data-action="continue"]');
  continueButton?.addEventListener("click", handlers.onContinue);

  // Restore focus to the control the user was interacting with, or focus Continue if this is the first open.
  if (focusSelector) {
    const toFocus = container.querySelector<HTMLButtonElement>(focusSelector);
    toFocus?.focus();
  } else {
    continueButton?.focus();
  }
}
