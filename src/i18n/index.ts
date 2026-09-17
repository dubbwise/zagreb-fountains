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
