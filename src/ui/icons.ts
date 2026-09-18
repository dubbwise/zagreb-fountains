/**
 * Theme icons for the intro controls, in the same shape as ./flags: trusted
 * SVG strings that go straight to innerHTML without escaping.
 *
 * The path data is Lucide's (ISC licensed), copied in rather than imported.
 * Three static icons did not justify a runtime dependency, and flags.ts
 * already established inline SVG as this project's approach.
 *
 * `stroke="currentColor"` lets the icons follow the button's text colour,
 * including the pressed state.
 */

const ICON_CLASS = "h-5 w-5 shrink-0";
const SVG_OPEN =
  `<svg class="${ICON_CLASS}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
  `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
  `aria-hidden="true" focusable="false">`;

/** Monitor — the "System" theme choice. */
export const ICON_SYSTEM =
  `${SVG_OPEN}<rect width="20" height="14" x="2" y="3" rx="2"></rect>` +
  `<line x1="8" x2="16" y1="21" y2="21"></line>` +
  `<line x1="12" x2="12" y1="17" y2="21"></line></svg>`;

/** Sun — the "Light" theme choice. */
export const ICON_LIGHT =
  `${SVG_OPEN}<circle cx="12" cy="12" r="4"></circle>` +
  `<path d="M12 2v2"></path><path d="M12 20v2"></path>` +
  `<path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>` +
  `<path d="M2 12h2"></path><path d="M20 12h2"></path>` +
  `<path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`;

/** Moon — the "Dark" theme choice. */
export const ICON_DARK =
  `${SVG_OPEN}<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 ` +
  `8.268 8.268c.344-.215.825-.004.803.401"></path></svg>`;

/*
 * Map controls. These replace Leaflet's own text glyphs ("ⓘ", "+", "−") so the
 * map chrome uses the same icon set as the intro. They inherit currentColor,
 * which the .dark Leaflet overrides in style.css already set.
 */

/** House — opens the intro. The intro is this app's home screen. */
export const ICON_HOME =
  `${SVG_OPEN}<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>` +
  `<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`;

/** Plus — zoom in. */
export const ICON_PLUS = `${SVG_OPEN}<path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;

/** Minus — zoom out. */
export const ICON_MINUS = `${SVG_OPEN}<path d="M5 12h14"></path></svg>`;
