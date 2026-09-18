import { describe, expect, it } from "vitest";
import { DEFAULT_CENTER } from "../src/config";
import type { Location } from "../src/data/locations";
import { findNearest, formatDistance, haversineMeters, isNearZagreb, walkingMinutes } from "../src/geo/distance";

const METERS_PER_DEGREE_LAT = (6_371_008.8 * Math.PI) / 180;

/** A point the given number of meters due north of the default center. */
function north(meters: number) {
  return { lat: DEFAULT_CENTER.lat + meters / METERS_PER_DEGREE_LAT, lon: DEFAULT_CENTER.lon };
}

function location(id: string, metersNorth: number, status: Location["status"] = "working"): Location {
  return { id, ...north(metersNorth), name: `Location ${id}`, status, cemetery: false };
}

function expectWithinOnePercent(actual: number, expected: number): void {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01);
}

describe("haversineMeters", () => {
  it("measures Ban Jelačić Square to Zagreb Cathedral", () => {
    expectWithinOnePercent(haversineMeters({ lat: 45.8131, lon: 15.9772 }, { lat: 45.8144, lon: 15.9798 }), 248);
  });

  it("measures Ban Jelačić Square to Split", () => {
    expectWithinOnePercent(haversineMeters(DEFAULT_CENTER, { lat: 43.5081, lon: 16.4402 }), 258_906);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters(DEFAULT_CENTER, DEFAULT_CENTER)).toBe(0);
  });
});

describe("findNearest", () => {
  it("returns null for an empty list", () => {
    expect(findNearest(DEFAULT_CENTER, [])).toBeNull();
  });

  it("returns the closest working location with its distance", () => {
    const result = findNearest(DEFAULT_CENTER, [location("far", 900), location("near", 300), location("mid", 600)]);
    expect(result?.location.id).toBe("near");
    expect(result?.distanceM).toBeCloseTo(300, 3);
  });

  it("breaks exact ties by lowest id", () => {
    expect(findNearest(DEFAULT_CENTER, [location("b", 300), location("a", 300)])?.location.id).toBe("a");
  });

  it("keeps a working location when an unverified one is at most 150 m closer", () => {
    const result = findNearest(DEFAULT_CENTER, [location("w", 300), location("u", 200, "unverified")]);
    expect(result?.location.id).toBe("w");
  });

  it("picks an unverified location when it is more than 150 m closer", () => {
    const result = findNearest(DEFAULT_CENTER, [location("w", 400), location("u", 200, "unverified")]);
    expect(result?.location.id).toBe("u");
  });

  it("keeps a working location when an unverified one is 149 m closer (inside threshold)", () => {
    const result = findNearest(DEFAULT_CENTER, [location("w", 349), location("u", 200, "unverified")]);
    expect(result?.location.id).toBe("w");
  });

  it("picks an unverified location when it is 151 m closer (outside threshold)", () => {
    const result = findNearest(DEFAULT_CENTER, [location("w", 351), location("u", 200, "unverified")]);
    expect(result?.location.id).toBe("u");
  });

  it("falls back to an unverified location when none are working", () => {
    expect(findNearest(DEFAULT_CENTER, [location("u", 500, "unverified")])?.location.id).toBe("u");
  });
});

describe("walkingMinutes", () => {
  it.each([
    [240, 4],
    [100, 2],
    [1000, 16],
    [0, 1],
  ])("%d m takes ~%d min", (meters, minutes) => {
    expect(walkingMinutes(meters)).toBe(minutes);
  });
});

describe("formatDistance", () => {
  it.each([
    [244, "240 m"],
    [245, "250 m"],
    [994, "990 m"],
    [995, "1.0 km"],
    [2345, "2.3 km"],
    [12_340, "12.3 km"],
  ])("%d m is shown as %s", (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });
});

describe("isNearZagreb", () => {
  it("accepts points within 30 km of the center", () => {
    expect(isNearZagreb(north(28_900))).toBe(true);
  });

  it("rejects points beyond 30 km", () => {
    expect(isNearZagreb(north(31_100))).toBe(false);
    expect(isNearZagreb({ lat: 43.5081, lon: 16.4402 })).toBe(false);
  });

  it("accepts points just inside the 30 km radius boundary", () => {
    expect(isNearZagreb(north(29_999))).toBe(true);
  });

  it("rejects points just outside the 30 km radius boundary", () => {
    expect(isNearZagreb(north(30_001))).toBe(false);
  });
});
