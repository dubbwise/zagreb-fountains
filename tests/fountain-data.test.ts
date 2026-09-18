import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Fountain } from "../src/data/fountains";
import {
  assertCountPlausible,
  buildSnapshot,
  DataValidationError,
  normalizeFeatures,
  sameFountains,
  selectGeoJsonResource,
  type ZdenciCollection,
} from "../scripts/lib/fountain-data";

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

const zdenci = (): ZdenciCollection => readFixture("zdenci-sample.geojson") as ZdenciCollection;

const EXPECTED: Fountain[] = [
  {
    id: "3be68cf0-1f79-4c8d-ac2b-285a8da09842",
    lat: 45.774951,
    lon: 15.962897,
    location: "Školsko igralište OŠ Trnsko",
    hint: "(potreban popravak!, curi) sjeveroistocno od igralista",
    status: "unverified",
    cemetery: false,
    type: "Viktorija zdenac",
  },
  {
    id: "3c30aa94-0f69-4509-9a8d-c26c71107a14",
    lat: 45.840841,
    lon: 16.020745,
    location: "Čret, Melinišće",
    status: "unverified",
    cemetery: false,
    type: "Viktorija zdenac",
  },
  {
    id: "723802ff-5fce-40c0-889d-fabbd29f4f79",
    lat: 45.83316,
    lon: 15.989409,
    location: "Groblje Mirogoj - jug",
    hint: "izvorno SKI lokacija",
    status: "working",
    cemetery: true,
    type: "Viktorija zdenac",
  },
  {
    id: "8596b290-ea0d-4caa-8890-047804249320",
    lat: 45.812749,
    lon: 15.964876,
    location: "Britanski trg",
    hint: "sjeverno od javnog WC-a",
    status: "working",
    cemetery: false,
    type: "Viktorija zdenac",
  },
  {
    id: "94ad52d5-a065-4d7d-999d-5e6be333fb9d",
    lat: 45.811811,
    lon: 15.997006,
    location: "Park Bartula Kašića - uz ogradu dječjeg parka",
    status: "working",
    cemetery: false,
    type: "Viktorija zdenac",
  },
];

describe("normalizeFeatures", () => {
  it("keeps working and unverified fountains, sorted by id", () => {
    expect(normalizeFeatures(zdenci()).fountains).toEqual(EXPECTED);
  });

  it("excludes fountains marked as not working, with a reason", () => {
    expect(normalizeFeatures(zdenci()).excluded).toEqual([
      {
        id: "a3c6b83f-56ab-4f27-94d7-00846fc73ed2",
        location: "Brezovička cesta 100",
        reason: "not working (nije u funkciji)",
      },
    ]);
  });

  it("has no unrecognized status values in the fixture", () => {
    expect(normalizeFeatures(zdenci()).unrecognizedStatuses).toEqual([]);
  });

  it("surfaces an unrecognized status value and still treats it as unverified", () => {
    const collection = zdenci();
    // features[2] is the null-status feature ("Čret, Melinišće").
    collection.features[2]!.properties!.status_odrz = "Nije u funkciji";
    const result = normalizeFeatures(collection);
    expect(result.unrecognizedStatuses).toEqual(["Nije u funkciji"]);
    const changed = result.fountains.find((fountain) => fountain.id === "3c30aa94-0f69-4509-9a8d-c26c71107a14");
    expect(changed?.status).toBe("unverified");
  });

  it("rejects a duplicate globalid", () => {
    const collection = zdenci();
    // features[2] ("Čret, Melinišće") reuses features[0]'s ("Britanski trg") globalid.
    collection.features[2]!.properties!.globalid = collection.features[0]!.properties!.globalid;
    expect(() => normalizeFeatures(collection)).toThrow(/duplicate globalid/);
  });

  it("rejects input that is not a feature collection", () => {
    expect(() => normalizeFeatures({})).toThrow(DataValidationError);
  });

  it("rejects a feature without globalid", () => {
    const collection = zdenci();
    collection.features[0]!.properties!.globalid = null;
    expect(() => normalizeFeatures(collection)).toThrow(/missing globalid/);
  });

  it("rejects a feature with a blank lokacija", () => {
    const collection = zdenci();
    collection.features[0]!.properties!.lokacija = "   ";
    expect(() => normalizeFeatures(collection)).toThrow(/missing lokacija/);
  });

  it("rejects non-point geometry", () => {
    const collection = zdenci();
    collection.features[0]!.geometry = {
      type: "LineString",
      coordinates: [
        [15.9, 45.8],
        [15.91, 45.81],
      ],
    };
    expect(() => normalizeFeatures(collection)).toThrow(/Point geometry/);
  });

  it("rejects projected (non-WGS84) coordinates", () => {
    const collection = zdenci();
    collection.features[0]!.geometry = { type: "Point", coordinates: [458412.11, 5074904.8] };
    expect(() => normalizeFeatures(collection)).toThrow(/outside Zagreb/);
  });
});

describe("selectGeoJsonResource", () => {
  it("picks the GeoJSON resource", () => {
    const resource = selectGeoJsonResource(readFixture("package-show-sample.json"));
    expect(resource.url).toMatch(/data\.geojson$/);
    expect(resource.last_modified).toBe("2026-09-14T11:08:23.379555");
  });

  it("rejects an unsuccessful response", () => {
    expect(() => selectGeoJsonResource({ success: false })).toThrow(DataValidationError);
  });

  it("rejects a dataset without GeoJSON", () => {
    const response = { success: true, result: { resources: [{ format: "CSV", url: "https://example.com/a.csv" }] } };
    expect(() => selectGeoJsonResource(response)).toThrow(/no GeoJSON/);
  });
});

describe("assertCountPlausible", () => {
  it("accepts a first run and small changes", () => {
    expect(() => assertCountPlausible(199, null)).not.toThrow();
    expect(() => assertCountPlausible(193, 199)).not.toThrow();
    expect(() => assertCountPlausible(100, 199)).not.toThrow();
  });

  it("rejects a drop below 50% of the previous count", () => {
    expect(() => assertCountPlausible(99, 199)).toThrow(DataValidationError);
  });

  it("rejects an empty result", () => {
    expect(() => assertCountPlausible(0, null)).toThrow(/no usable fountains/);
  });
});

describe("sameFountains", () => {
  it("is true for identical lists", () => {
    expect(sameFountains(EXPECTED, structuredClone(EXPECTED))).toBe(true);
  });

  it("is false when any field differs", () => {
    const changed = structuredClone(EXPECTED);
    changed[0]!.hint = "changed";
    expect(sameFountains(EXPECTED, changed)).toBe(false);
    expect(sameFountains(EXPECTED, EXPECTED.slice(1))).toBe(false);
  });
});

describe("buildSnapshot", () => {
  it("wraps fountains with metadata", () => {
    expect(buildSnapshot(EXPECTED, "2026-09-14T11:08:23.379555", new Date("2026-09-15T04:00:00Z"))).toEqual({
      generatedAt: "2026-09-15T04:00:00.000Z",
      lastCheckedAt: "2026-09-15T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 5,
      fountains: EXPECTED,
    });
  });

  it("keeps a previous generatedAt while bumping lastCheckedAt", () => {
    expect(
      buildSnapshot(
        EXPECTED,
        "2026-09-14T11:08:23.379555",
        new Date("2026-09-22T04:00:00Z"),
        "2026-09-15T04:00:00.000Z",
      ),
    ).toEqual({
      generatedAt: "2026-09-15T04:00:00.000Z",
      lastCheckedAt: "2026-09-22T04:00:00.000Z",
      sourceModified: "2026-09-14T11:08:23.379555",
      count: 5,
      fountains: EXPECTED,
    });
  });

  it("uses an empty string when the source has no modified date", () => {
    expect(buildSnapshot(EXPECTED, null, new Date(0)).sourceModified).toBe("");
  });
});
