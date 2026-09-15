import { describe, expect, it } from "vitest";
import { directionsUrl, isAppleMobile } from "../src/ui/directions";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const BRITANSKI_TRG = { lat: 45.8127489060025, lon: 15.9648762099405 };
const APPLE_URL = "https://maps.apple.com/?daddr=45.812749,15.964876&dirflg=w";
const GOOGLE_URL = "https://www.google.com/maps/dir/?api=1&destination=45.812749,15.964876&travelmode=walking";

describe("isAppleMobile", () => {
  it.each([
    ["iPhone", IPHONE, 5, true],
    ["iPad", IPAD, 5, true],
    ["iPadOS desktop mode (Mac UA with touch)", MAC_SAFARI, 5, true],
    ["Mac desktop (no touch)", MAC_SAFARI, 0, false],
    ["Android", ANDROID, 5, false],
    ["Windows desktop", WINDOWS, 0, false],
  ])("%s → %s", (_label, userAgent, touchPoints, expected) => {
    expect(isAppleMobile(userAgent, touchPoints)).toBe(expected);
  });
});

describe("directionsUrl", () => {
  it("uses Apple Maps walking directions on iOS", () => {
    expect(directionsUrl(BRITANSKI_TRG, IPHONE, 5)).toBe(APPLE_URL);
  });

  it("uses Apple Maps on iPadOS desktop mode", () => {
    expect(directionsUrl(BRITANSKI_TRG, MAC_SAFARI, 5)).toBe(APPLE_URL);
  });

  it("uses Google Maps walking directions on Android and desktop", () => {
    expect(directionsUrl(BRITANSKI_TRG, ANDROID, 5)).toBe(GOOGLE_URL);
    expect(directionsUrl(BRITANSKI_TRG, WINDOWS, 0)).toBe(GOOGLE_URL);
    expect(directionsUrl(BRITANSKI_TRG, MAC_SAFARI, 0)).toBe(GOOGLE_URL);
  });
});
