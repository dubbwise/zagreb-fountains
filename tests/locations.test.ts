import { describe, expect, it, vi } from "vitest";
import { loadLocations, loadSnapshot, type Location, type Snapshot } from "../src/data/locations";

const location: Location = {
  id: "8596b290-ea0d-4caa-8890-047804249320",
  lat: 45.812749,
  lon: 15.964876,
  name: "Britanski trg",
  hint: "sjeverno od javnog WC-a",
  status: "working",
  cemetery: false,
  type: "Viktorija zdenac",
};

function fakeFetch(response: Response) {
  return vi.fn(async () => response);
}

describe("loadLocations", () => {
  it("returns the locations from a snapshot", async () => {
    const snapshot: Snapshot = {
      generatedAt: "2026-09-15T04:00:00.000Z",
      lastCheckedAt: "2026-09-22T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 1,
      locations: [location],
    };
    const fetchFn = fakeFetch(new Response(JSON.stringify(snapshot), { status: 200 }));

    await expect(loadLocations("data/locations.json", fetchFn as unknown as typeof fetch)).resolves.toEqual([location]);
    expect(fetchFn).toHaveBeenCalledWith("data/locations.json");
  });

  it("throws on a non-OK response", async () => {
    const fetchFn = fakeFetch(new Response("not found", { status: 404 }));
    await expect(loadLocations("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("HTTP 404");
  });

  it("throws when the payload has no locations array", async () => {
    const fetchFn = fakeFetch(new Response("{}", { status: 200 }));
    await expect(loadLocations("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("malformed");
  });

  it("throws when lastCheckedAt is missing", async () => {
    const fetchFn = fakeFetch(
      new Response(
        JSON.stringify({
          generatedAt: "2026-09-15T04:00:00.000Z",
          sourceModified: "",
          count: 1,
          locations: [location],
        }),
        { status: 200 },
      ),
    );
    await expect(loadLocations("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("malformed");
  });
});

describe("loadSnapshot", () => {
  it("returns the full snapshot including lastCheckedAt", async () => {
    const snapshot: Snapshot = {
      generatedAt: "2026-09-15T04:00:00.000Z",
      lastCheckedAt: "2026-09-22T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 1,
      locations: [location],
    };
    const fetchFn = fakeFetch(new Response(JSON.stringify(snapshot), { status: 200 }));
    await expect(loadSnapshot("data/locations.json", fetchFn as unknown as typeof fetch)).resolves.toEqual(snapshot);
  });
});
