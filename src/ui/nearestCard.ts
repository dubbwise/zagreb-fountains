import type { Fountain } from "../data/fountains";
import { formatDistance, walkingMinutes } from "../geo/distance";
import { t } from "../i18n";

export type FountainCardState = {
  kind: "fountain";
  fountain: Fountain;
  distanceM: number | null;
  approx: boolean;
  isNearest: boolean;
  directionsUrl: string;
};

export type CardState = { kind: "locating" } | { kind: "locationError" } | { kind: "outside" } | FountainCardState;

const BUTTON_CLASS = "btn-primary mt-3";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const panel = (inner: string): string =>
  `<div class="panel">${inner}</div>`;
const message = (text: string): string => `<p class="text-body">${escapeHtml(text)}</p>`;
const badge = (text: string): string =>
  `<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${escapeHtml(text)}</span>`;

function fountainHtml({ fountain, distanceM, approx, isNearest, directionsUrl }: FountainCardState): string {
  const label = isNearest ? t().nearestFountain : t().selectedFountain;
  const parts = [
    `<p class="label-caps text-xs text-accent-ink">${escapeHtml(label)}</p>`,
    `<h2 class="mt-1 text-lg font-semibold leading-snug">${escapeHtml(fountain.location)}</h2>`,
  ];
  if (fountain.hint) {
    parts.push(`<p class="mt-0.5 text-sm text-body-subtle">${escapeHtml(fountain.hint)}</p>`);
  }
  if (distanceM !== null) {
    const distance = `${approx ? `${t().approx} ` : ""}${formatDistance(distanceM)}`;
    const line = `${distance} · ${t().walk(walkingMinutes(distanceM))}`;
    parts.push(`<p class="mt-2 font-medium text-body-strong">${escapeHtml(line)}</p>`);
  }
  const badges: string[] = [];
  if (fountain.status === "unverified") badges.push(badge(t().unverified));
  if (fountain.cemetery) badges.push(badge(t().cemetery));
  if (badges.length > 0) {
    parts.push(`<div class="mt-2 flex flex-wrap gap-2">${badges.join("")}</div>`);
  }
  parts.push(
    `<a href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener" class="${BUTTON_CLASS}">${escapeHtml(t().directions)}</a>`,
  );
  return parts.join("");
}

export function cardHtml(state: CardState): string {
  switch (state.kind) {
    case "locating":
      return panel(message(t().locating));
    case "locationError":
      return panel(
        `${message(t().enableLocation)}<button type="button" data-action="retry" class="${BUTTON_CLASS}">${escapeHtml(t().retry)}</button>`,
      );
    case "outside":
      return panel(message(t().outsideZagreb));
    case "fountain":
      return panel(fountainHtml(state));
  }
}

export function renderCard(container: HTMLElement, state: CardState, handlers: { onRetry: () => void }): void {
  container.innerHTML = cardHtml(state);
  container.querySelector<HTMLButtonElement>('[data-action="retry"]')?.addEventListener("click", handlers.onRetry);
}
