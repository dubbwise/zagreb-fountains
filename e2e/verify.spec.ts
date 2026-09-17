import { expect, test, type Page } from "@playwright/test";

const SCREENSHOTS = "e2e/screenshots";
const WALK_LINE = /(\d+ m|\d+\.\d km) · ~\d+ min walk/;

/** Records watchPosition calls so a test can prove the prompt was not fired. */
async function spyOnGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = navigator.geolocation;
    const original = target.watchPosition.bind(target);
    (window as unknown as { __watchCalls: number }).__watchCalls = 0;
    target.watchPosition = ((...args: Parameters<Geolocation["watchPosition"]>) => {
      (window as unknown as { __watchCalls: number }).__watchCalls += 1;
      return original(...args);
    }) as Geolocation["watchPosition"];
  });
}

async function openApp(page: Page, options: { skipIntro?: boolean } = {}): Promise<void> {
  await spyOnGeolocation(page);
  await page.goto("/");
  await expect(page.locator("#intro")).toBeVisible();
  if (options.skipIntro === false) return;
  await page.getByRole("button", { name: /Find water|Pronađi vodu/ }).click();
  await expect(page.locator("#intro")).toBeHidden();
  await expect(page.locator("path.leaflet-interactive")).not.toHaveCount(0);
}

/** Screenshots taken mid-fade show a patchwork of half-loaded tiles. */
async function waitForTiles(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const tiles = Array.from(document.querySelectorAll(".leaflet-tile"));
        return tiles.length > 0 && tiles.every((tile) => tile.classList.contains("leaflet-tile-loaded"));
      },
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
}

test.describe("at Ban Jelačić Square", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 }, permissions: ["geolocation"] });

  test("highlights the nearest fountain with directions", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Nearest fountain");
    await expect(card).toContainText(WALK_LINE);
    await expect(card.getByRole("link", { name: "Directions" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=45\.\d{6},15\.\d{6}&travelmode=walking$/,
    );
    await waitForTiles(page);
    await page.screenshot({ path: `${SCREENSHOTS}/1-ban-jelacic.png` });
  });
});

test.describe("in Maksimir Park", () => {
  test.use({ geolocation: { latitude: 45.8229, longitude: 16.0176, accuracy: 20 }, permissions: ["geolocation"] });

  test("highlights the nearest fountain", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Nearest fountain");
    await expect(card).toContainText(WALK_LINE);
    await page.screenshot({ path: `${SCREENSHOTS}/2-maksimir.png` });
  });
});

test.describe("in Split (outside Zagreb)", () => {
  test.use({ geolocation: { latitude: 43.5081, longitude: 16.4402, accuracy: 20 }, permissions: ["geolocation"] });

  test("explains there are no fountains nearby", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#card")).toContainText("No fountains mapped near you. Showing Zagreb.");
    await page.screenshot({ path: `${SCREENSHOTS}/3-split.png` });
  });
});

test.describe("with location permission denied", () => {
  test.use({ permissions: [] });

  test("offers to enable location and retry", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Enable location to find the nearest fountain", { timeout: 20_000 });
    const retryButton = card.getByRole("button", { name: "Retry" });
    await expect(retryButton).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/4-denied.png` });

    // Clicking Retry restarts the watch without crashing: the card falls back
    // to the same "enable location" state instead of erroring out.
    await retryButton.click();
    await expect(card).toContainText("Enable location to find the nearest fountain", { timeout: 20_000 });
  });
});

test.describe("clears approx. when GPS accuracy improves", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 1500 }, permissions: ["geolocation"] });

  test("drops the approx. prefix once a precise fix arrives", async ({ page, context }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("approx.");

    // Chromium may not deliver a fresh watchPosition fix on an accuracy-only
    // change with no movement, so nudge latitude by ~5 m alongside it. That's
    // still under RECOMPUTE_DISTANCE_M (25 m), so this exercises FIX 8's
    // "recompute skipped, but re-render on an accuracy-class change" path
    // rather than a full nearest recompute.
    await context.setGeolocation({ latitude: 45.81315, longitude: 15.9772, accuracy: 15 });

    await expect(card).not.toContainText("approx.", { timeout: 15_000 });
  });
});

test.describe("with the system set to dark", () => {
  test.use({
    colorScheme: "dark",
    geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 },
    permissions: ["geolocation"],
  });

  // The dark basemap needs VITE_CARTO_API_KEY at build time (.env.local locally,
  // a repository secret in CI), otherwise the map stays on the light tiles.
  test("renders a dark card over the dark basemap", async ({ page }) => {
    await openApp(page);
    const card = page.locator("#card");
    await expect(card).toContainText("Nearest fountain");

    // Assert the surface is dark rather than matching an exact colour string:
    // Tailwind 4 emits oklch(), so the computed value is palette-version specific.
    const panelLightness = await card
      .locator("div")
      .first()
      .evaluate((element) => {
        const background = getComputedStyle(element).backgroundColor;
        const oklch = /^oklch\(\s*([\d.]+)/.exec(background);
        if (oklch) return Number(oklch[1]);
        const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(background);
        if (!rgb) return null;
        const [red, green, blue] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
        return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      });
    expect(panelLightness, `card background should be dark, got ${String(panelLightness)}`).toBeLessThan(0.4);

    // The key must be present and non-empty: CARTO answers 200 either way, but
    // keyless (or wrongly-named parameter) tiles come back stamped "API KEY
    // REQUIRED", which only the screenshot review catches.
    await expect(page.locator(".leaflet-tile").first()).toHaveAttribute(
      "src",
      /cartocdn\.com\/dark_all\/.+\.png\?key=.+/,
    );
    // The attribution bar no longer exists: Task 5 replaced it with the ⓘ
    // control, whose intro carries the full credits (global constraints).
    // Re-open it here to confirm CARTO's credit is still reachable, then
    // close it again before the screenshot below.
    await page.getByRole("button", { name: /About this map|O ovoj karti/ }).click();
    await expect(page.locator("#intro")).toContainText("CARTO");
    await page.getByRole("button", { name: "Find water" }).click();
    await expect(page.locator("#intro")).toBeHidden();

    await waitForTiles(page);
    await page.screenshot({ path: `${SCREENSHOTS}/5-dark.png` });
  });
});

test.describe("the intro screen", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 }, permissions: ["geolocation"] });

  test("explains the app and holds the location prompt until you continue", async ({ page }) => {
    await openApp(page, { skipIntro: false });
    const intro = page.locator("#intro");
    await expect(intro).toContainText("Why your location?");
    await expect(intro).toContainText("© OpenStreetMap contributors");
    await expect(intro.getByRole("link", { name: "zg@paperbeatsrock.co" })).toHaveAttribute(
      "href",
      "mailto:zg@paperbeatsrock.co",
    );
    expect(await page.evaluate(() => (window as unknown as { __watchCalls: number }).__watchCalls)).toBe(0);
    await page.screenshot({ path: `${SCREENSHOTS}/6-intro-light.png` });

    await page.getByRole("button", { name: "Find water" }).click();
    await expect(intro).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __watchCalls: number }).__watchCalls))
      .toBeGreaterThan(0);
    await expect(page.locator("#card")).toContainText("Nearest fountain");
  });

  test("reopens from the map without asking for location again", async ({ page }) => {
    await openApp(page);
    const callsAfterContinue = await page.evaluate(
      () => (window as unknown as { __watchCalls: number }).__watchCalls,
    );
    await page.getByRole("button", { name: /About this map|O ovoj karti/ }).click();
    await expect(page.locator("#intro")).toBeVisible();
    await page.getByRole("button", { name: "Find water" }).click();
    await expect(page.locator("#intro")).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __watchCalls: number }).__watchCalls)).toBe(
      callsAfterContinue,
    );
  });
});

test.describe("theme override", () => {
  test.use({
    colorScheme: "light",
    geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 },
    permissions: ["geolocation"],
  });

  test("Dark wins over a light system setting", async ({ page }) => {
    await openApp(page, { skipIntro: false });
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    // renderIntro re-renders the panel on every settings change, so focus must
    // be restored to the control the user just used rather than jumping to Continue.
    await expect(page.getByRole("button", { name: "Dark" })).toBeFocused();
    await page.screenshot({ path: `${SCREENSHOTS}/7-intro-dark.png` });

    await page.getByRole("button", { name: "Find water" }).click();
    await expect(page.locator(".leaflet-tile").first()).toHaveAttribute("src", /cartocdn\.com\/dark_all/);
  });
});

test.describe("language", () => {
  test.use({ geolocation: { latitude: 45.8131, longitude: 15.9772, accuracy: 20 }, permissions: ["geolocation"] });

  test("Hrvatski translates the card and survives a reload", async ({ page }) => {
    await openApp(page, { skipIntro: false });
    await page.getByRole("button", { name: "Hrvatski" }).click();
    await expect(page.locator("#intro")).toContainText("Zašto lokacija?");
    await page.getByRole("button", { name: "Pronađi vodu" }).click();

    const card = page.locator("#card");
    await expect(card).toContainText("Najbliži zdenac");
    await expect(card).toContainText(/\d+ m · ~\d+ min hoda/);
    await waitForTiles(page);
    await page.screenshot({ path: `${SCREENSHOTS}/8-croatian.png` });

    await page.reload();
    await expect(page.locator("#intro")).toContainText("Pronađi vodu");
    await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  });
});
