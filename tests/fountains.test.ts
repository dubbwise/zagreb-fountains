import { describe, expect, it, vi } from "vitest";
import { loadFountains, type Fountain, type Snapshot } from "../src/data/fountains";

const fountain: Fountain = {
  id: "8596b290-ea0d-4caa-8890-047804249320",
  lat: 45.812749,
  lon: 15.964876,
  location: "Britanski trg",
  hint: "sjeverno od javnog WC-a",
  status: "working",
  cemetery: false,
  type: "Viktorija zdenac",
};

function fakeFetch(response: Response) {
  return vi.fn(async () => response);
}

describe("loadFountains", () => {
  it("returns the fountains from a snapshot", async () => {
    const snapshot: Snapshot = {
      generatedAt: "2026-09-15T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 1,
      fountains: [fountain],
    };
    const fetchFn = fakeFetch(new Response(JSON.stringify(snapshot), { status: 200 }));

    await expect(loadFountains("data/fountains.json", fetchFn as unknown as typeof fetch)).resolves.toEqual([
      fountain,
    ]);
    expect(fetchFn).toHaveBeenCalledWith("data/fountains.json");
  });

  it("throws on a non-OK response", async () => {
    const fetchFn = fakeFetch(new Response("not found", { status: 404 }));
    await expect(loadFountains("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("HTTP 404");
  });

  it("throws when the payload has no fountains array", async () => {
    const fetchFn = fakeFetch(new Response("{}", { status: 200 }));
    await expect(loadFountains("x", fetchFn as unknown as typeof fetch)).rejects.toThrow("malformed");
  });
});
