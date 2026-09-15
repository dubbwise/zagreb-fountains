import { expect, test, type Page } from "@playwright/test";

const SCREENSHOTS = "e2e/screenshots";
const WALK_LINE = /(\d+ m|\d+\.\d km) · ~\d+ min walk/;

async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("path.leaflet-interactive")).not.toHaveCount(0);
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
