import { t } from "../i18n";
import type { Language, Theme } from "../settings";
import { FLAG_EN, FLAG_HR } from "./flags";
import { ICON_DARK, ICON_LIGHT } from "./icons";
import { escapeHtml } from "./nearestCard";

// Attributions
const DATASET_URL = "https://data.zagreb.hr/dataset/geoportal_javni_zdenci";
const LEAFLET_ATTRIBUTIONS_URL = "https://leafletjs.com";
const OSM_ATTRIBUTIONS_URL = "https://www.openstreetmap.org/";
const CARTO_ATTRIBUTIONS_URL = "https://carto.com/";
const FEEDBACK_EMAIL = "zg@paperbeatsrock.co";
const LEAFLET_LINK = `<a class="underline underline-offset-2" href="${LEAFLET_ATTRIBUTIONS_URL}" target="_blank" rel="noopener">Leaflet</a>`;
const OSM_LINK = `<a class="underline underline-offset-2" href="${OSM_ATTRIBUTIONS_URL}" target="_blank" rel="noopener">OpenStreetMap</a>`;
const CARTO_LINK = `<a class="underline underline-offset-2" href="${CARTO_ATTRIBUTIONS_URL}" target="_blank" rel="noopener">CARTO</a>`;
const DATASET_LINK = `<a class="underline underline-offset-2" href="${DATASET_URL}" target="_blank" rel="noopener">data.zagreb.hr</a>`;
const FEEDBACK_LINK = `<a class="underline underline-offset-2" href="mailto:${FEEDBACK_EMAIL}" target="_blank" rel="noopener">${FEEDBACK_EMAIL}</a>`;

const CHOICE_CLASS = "btn-choice";
const FAVICON = `${import.meta.env.BASE_URL}favicon.svg`;

export interface IntroState {
  theme: Theme;
  language: Language;
  lastCheckedAt?: string | null;
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

function formatCheckedAt(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "hr" ? "hr-HR" : "en-GB", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function introHtml({ theme, language, lastCheckedAt }: IntroState): string {
  const strings = t();
  // A single toggle rather than a choice set. Pressed reports whether dark is
  // on, and the icon shows the theme in effect. It deliberately carries no
  // data-theme: renderIntro restores focus by selector after every re-render,
  // so an attribute whose value flipped with each press would stop matching the
  // button the user just clicked. The target theme is derived from state at
  // click time instead, which keeps the selector stable.
  const themeToggle = choice(
    "data-action",
    "toggle-theme",
    "",
    theme === "dark",
    theme === "dark" ? ICON_DARK : ICON_LIGHT,
    "btn-choice-subtle",
    "Dark theme",
  );
  const languageChoices = [
    choice("data-language", "hr", "", language === "hr", FLAG_HR, "btn-choice-subtle", "Hrvatski"),
    choice("data-language", "en", "", language === "en", FLAG_EN, "btn-choice-subtle", "English"),
  ].join("");
  const updated =
    lastCheckedAt != null && lastCheckedAt !== ""
      ? `<span>${escapeHtml(strings.introLastUpdated(formatCheckedAt(lastCheckedAt, language)))}</span>`
      : "";

  return `<div class="flex min-h-full flex-col md:p-8">
  <div class="mx-auto flex w-full max-w-md flex-1 flex-col bg-surface p-6 md:p-12 md:ring-2 ring-edge">
    
    <header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <img src="${FAVICON}" alt="" width="32" height="32" class="size-12 bg-accent color-white p-1 rounded-xl" />
          <span class="text-lg font-medium">Francek</span>
        </div>
        <div class="flex gap-2 ml-auto" role="group" aria-label="${escapeHtml(strings.introLanguage)}">${languageChoices}</div>
      </div>
    </header>

    <section class="my-[6vh] space-y-6">
      <h1 id="intro-title" class="text-accent text-[3.85rem] md:text-7xl font-extrabold leading-[0.9] tracking-tight pb-4">${escapeHtml(strings.introTitle)}</h1>
      <p class="text-base text-body-subtle leading-snug">${escapeHtml(strings.introLocationBody)}</p>
      <button type="button" data-action="continue" class="btn-primary">${escapeHtml(strings.introContinue)}</button>
    </section>

    <footer class="text-xs text-body-subtle leading-none flex justify-between gap-2 -mb-1 mt-auto">
      <div class="flex flex-wrap gap-2">
        ${LEAFLET_LINK}
        ${OSM_LINK}
        ${CARTO_LINK}
        ${DATASET_LINK}
        ${updated}
      </div>
      <div class="flex gap-2">${themeToggle}</div>
    </footer>
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
    const language = elem.getAttribute("data-language");
    const action = elem.getAttribute("data-action");
    if (language !== null) focusSelector = `[data-language="${language}"]`;
    else if (action !== null) focusSelector = `[data-action="${action}"]`;
  }

  container.innerHTML = introHtml(state);
  const themeToggle = container.querySelector<HTMLButtonElement>('[data-action="toggle-theme"]');
  // Safari does not focus a <button> on click, so document.activeElement
  // would otherwise stay <body> and the restore logic above would have
  // nothing to go on. Focusing explicitly records the intent regardless of
  // browser click-focus behaviour, before the settings change re-renders.
  themeToggle?.addEventListener("click", () => {
    themeToggle.focus();
    handlers.onTheme(state.theme === "dark" ? "light" : "dark");
  });
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
