import type { Location } from "../data/locations";
import { formatDistance, walkingMinutes } from "../geo/distance";
import { t } from "../i18n";

export type LocationCardState = {
  kind: "location";
  location: Location;
  distanceM: number | null;
  approx: boolean;
  isNearest: boolean;
  directionsUrl: string;
};

export type CardState = { kind: "locating" } | { kind: "locationError" } | { kind: "outside" } | LocationCardState;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const panel = (inner: string): string => `<div class="panel">${inner}</div>`;
const message = (text: string): string => `<p class="text-body">${escapeHtml(text)}</p>`;
const badge = (text: string): string => `<span class="badge">${escapeHtml(text)}</span>`;

function locationHtml({ location, distanceM, approx, isNearest, directionsUrl }: LocationCardState): string {
  const label = isNearest ? t().nearestLocation : t().selectedLocation;
  const parts = [
    `<p class="label-caps text-xs text-primary-light">${escapeHtml(label)}</p>`,
    `<h2 class="mt-1 text-lg font-semibold leading-snug">${escapeHtml(location.name)}</h2>`,
  ];
  if (location.hint) {
    parts.push(`<p class="mt-0.5 text-sm text-body-subtle">${escapeHtml(location.hint)}</p>`);
  }
  if (distanceM !== null) {
    const distance = `${approx ? `${t().approx} ` : ""}${formatDistance(distanceM)}`;
    const line = `${distance} · ${t().walk(walkingMinutes(distanceM))}`;
    parts.push(`<p class="mt-2 font-medium text-body-strong">${escapeHtml(line)}</p>`);
  }
  const badges: string[] = [];
  if (location.status === "unverified") badges.push(badge(t().unverified));
  if (location.cemetery) badges.push(badge(t().cemetery));
  if (badges.length > 0) {
    parts.push(`<div class="mt-2 flex flex-wrap gap-2">${badges.join("")}</div>`);
  }
  parts.push(
    `<a href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener" class="btn-primary mt-3">${escapeHtml(t().directions)}</a>`,
  );
  return parts.join("");
}

export function cardHtml(state: CardState): string {
  switch (state.kind) {
    case "locating":
      return panel(message(t().locating));
    case "locationError":
      return panel(
        `${message(t().enableLocation)}<button type="button" data-action="retry" class="btn-primary mt-3">${escapeHtml(t().retry)}</button>`,
      );
    case "outside":
      return panel(message(t().outsideZagreb));
    case "location":
      return panel(locationHtml(state));
  }
}

export function renderCard(container: HTMLElement, state: CardState, handlers: { onRetry: () => void }): void {
  container.innerHTML = cardHtml(state);
  container.querySelector<HTMLButtonElement>('[data-action="retry"]')?.addEventListener("click", handlers.onRetry);
}
