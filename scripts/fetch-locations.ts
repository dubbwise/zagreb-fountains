import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Snapshot } from "../src/data/locations";
import {
  assertCountPlausible,
  buildSnapshot,
  normalizeFeatures,
  sameLocations,
  selectGeoJsonResource,
} from "./lib/location-data";

const PACKAGE_SHOW_URL = "https://data.zagreb.hr/api/3/action/package_show?id=geoportal_javni_zdenci";
const OUTPUT_PATH = "public/data/locations.json";
const REQUEST_HEADERS = { "User-Agent": "zagreb-fountains-data-refresh/1.0", Accept: "application/json" };

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return response.json();
}

async function readPreviousSnapshot(): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as Snapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function main(): Promise<void> {
  const resource = selectGeoJsonResource(await getJson(PACKAGE_SHOW_URL));
  console.log(`Downloading ${resource.url}`);
  const { locations, excluded, unrecognizedStatuses } = normalizeFeatures(await getJson(resource.url));

  const unverified = locations.filter((location) => location.status === "unverified").length;
  const cemetery = locations.filter((location) => location.cemetery).length;
  console.log(`Kept ${locations.length} locations (${unverified} unverified, ${cemetery} cemetery)`);
  console.log(`Excluded ${excluded.length}:`);
  for (const exclusion of excluded) {
    console.log(`  - ${exclusion.id} ${exclusion.name}: ${exclusion.reason}`);
  }
  if (unrecognizedStatuses.length > 0) {
    console.log(`Warning: unrecognized status_odrz values: ${unrecognizedStatuses.join(", ")}`);
  }

  const previous = await readPreviousSnapshot();
  const previousCount = previous ? (previous.locations?.length ?? previous.count) : null;
  assertCountPlausible(locations.length, previousCount);

  const now = new Date();
  const sourceModified = typeof resource.last_modified === "string" ? resource.last_modified : null;
  const locationsUnchanged = Boolean(previous && sameLocations(previous.locations, locations));
  const snapshot = buildSnapshot(
    locations,
    sourceModified,
    now,
    locationsUnchanged ? previous!.generatedAt : undefined,
  );

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  if (locationsUnchanged) {
    console.log("No changes to locations; bumped lastCheckedAt.");
  }
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
