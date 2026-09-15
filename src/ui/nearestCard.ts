import type { Fountain } from "../data/fountains";
import { formatDistance, walkingMinutes } from "../geo/distance";
import { strings } from "../strings";

export type FountainCardState = {
  kind: "fountain";
  fountain: Fountain;
  distanceM: number | null;
  approx: boolean;
  isNearest: boolean;
  directionsUrl: string;
};

export type CardState = { kind: "locating" } | { kind: "locationError" } | { kind: "outside" } | FountainCardState;

const BUTTON_CLASS =
  "mt-3 block w-full rounded-xl bg-sky-700 px-4 py-3 text-center font-semibold text-white active:bg-sky-800";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const panel = (inner: string): string =>
  `<div class="mx-auto max-w-md rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-900/5">${inner}</div>`;
const message = (text: string): string => `<p class="text-slate-700">${escapeHtml(text)}</p>`;
const badge = (text: string): string =>
  `<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">${escapeHtml(text)}</span>`;

function fountainHtml({ fountain, distanceM, approx, isNearest, directionsUrl }: FountainCardState): string {
  const label = isNearest ? strings.nearestFountain : strings.selectedFountain;
  const parts = [
    `<p class="text-xs font-semibold uppercase tracking-wide text-sky-700">${escapeHtml(label)}</p>`,
    `<h2 class="mt-1 text-lg font-semibold leading-snug">${escapeHtml(fountain.location)}</h2>`,
  ];
  if (fountain.hint) {
    parts.push(`<p class="mt-0.5 text-sm text-slate-500">${escapeHtml(fountain.hint)}</p>`);
  }
  if (distanceM !== null) {
    const distance = `${approx ? `${strings.approx} ` : ""}${formatDistance(distanceM)}`;
    const line = `${distance} · ${strings.walk(walkingMinutes(distanceM))}`;
    parts.push(`<p class="mt-2 font-medium text-slate-800">${escapeHtml(line)}</p>`);
  }
  const badges: string[] = [];
  if (fountain.status === "unverified") badges.push(badge(strings.unverified));
  if (fountain.cemetery) badges.push(badge(strings.cemetery));
  if (badges.length > 0) {
    parts.push(`<div class="mt-2 flex flex-wrap gap-2">${badges.join("")}</div>`);
  }
  parts.push(
    `<a href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener" class="${BUTTON_CLASS}">${escapeHtml(strings.directions)}</a>`,
  );
  return parts.join("");
}

export function cardHtml(state: CardState): string {
  switch (state.kind) {
    case "locating":
      return panel(message(strings.locating));
    case "locationError":
      return panel(
        `${message(strings.enableLocation)}<button type="button" data-action="retry" class="${BUTTON_CLASS}">${escapeHtml(strings.retry)}</button>`,
      );
    case "outside":
      return panel(message(strings.outsideZagreb));
    case "fountain":
      return panel(fountainHtml(state));
  }
}

export function renderCard(container: HTMLElement, state: CardState, handlers: { onRetry: () => void }): void {
  container.innerHTML = cardHtml(state);
  container.querySelector<HTMLButtonElement>('[data-action="retry"]')?.addEventListener("click", handlers.onRetry);
}
