import { CARTO_ATTRIBUTIONS_URL, OSM_COPYRIGHT_URL } from "../config";
import { t, type Strings } from "../i18n";
import type { Language, Theme } from "../settings";
import { escapeHtml } from "./nearestCard";

const FEEDBACK_EMAIL = "zg@paperbeatsrock.co";
const DATASET_URL = "https://data.zagreb.hr/dataset/geoportal_javni_zdenci";
const LINK_CLASS = "underline";

const CHOICE_CLASS =
  "flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium aria-pressed:border-sky-700 aria-pressed:bg-sky-700 aria-pressed:text-white dark:border-slate-600 dark:aria-pressed:border-sky-500 dark:aria-pressed:bg-sky-600";

export interface IntroState {
  theme: Theme;
  language: Language;
}

function choice(attribute: string, value: string, label: string, active: boolean): string {
  return `<button type="button" ${attribute}="${value}" aria-pressed="${active ? "true" : "false"}" class="${CHOICE_CLASS}">${escapeHtml(label)}</button>`;
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
      <h1 id="intro-title" class="text-2xl font-semibold">${escapeHtml(strings.introTitle)}</h1>
      <p class="mt-1 text-slate-700 dark:text-slate-300">${escapeHtml(strings.introLede)}</p>
    </header>

    <section>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">${escapeHtml(strings.introLocationHeading)}</h2>
      <p class="mt-1 text-slate-700 dark:text-slate-300">${escapeHtml(strings.introLocationBody)}</p>
    </section>

    <section>
      <h2 id="intro-theme-heading" class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(strings.introThemeLabel)}</h2>
      <div class="flex gap-2" role="group" aria-labelledby="intro-theme-heading">${themeChoices}</div>
    </section>

    <section>
      <h2 id="intro-language-heading" class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(strings.introLanguageLabel)}</h2>
      <div class="flex gap-2" role="group" aria-labelledby="intro-language-heading">${languageChoices}</div>
    </section>

    <section class="text-sm text-slate-600 dark:text-slate-400">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(strings.introCreditsHeading)}</h2>
      <p class="mt-1">${creditsMapHtml(strings)}</p>
      <p class="mt-1">${escapeHtml(strings.introCreditsData)} (<a class="${LINK_CLASS}" href="${DATASET_URL}" target="_blank" rel="noopener">data.zagreb.hr</a>)</p>
      <p class="mt-1">${escapeHtml(strings.introFeedback)}: <a class="${LINK_CLASS}" href="mailto:${FEEDBACK_EMAIL}">${FEEDBACK_EMAIL}</a></p>
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
    button.addEventListener("click", () => handlers.onTheme(button.dataset.theme as Theme));
  }
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-language]")) {
    button.addEventListener("click", () => handlers.onLanguage(button.dataset.language as Language));
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
