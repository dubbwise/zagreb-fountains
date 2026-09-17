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
