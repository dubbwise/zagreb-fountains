import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Snapshot } from "../src/data/fountains";
import {
  assertCountPlausible,
  buildSnapshot,
  normalizeFeatures,
  sameFountains,
  selectGeoJsonResource,
} from "./lib/fountain-data";

const PACKAGE_SHOW_URL = "https://data.zagreb.hr/api/3/action/package_show?id=geoportal_javni_zdenci";
const OUTPUT_PATH = "public/data/fountains.json";
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
  const { fountains, excluded, unrecognizedStatuses } = normalizeFeatures(await getJson(resource.url));

  const unverified = fountains.filter((fountain) => fountain.status === "unverified").length;
  const cemetery = fountains.filter((fountain) => fountain.cemetery).length;
  console.log(`Kept ${fountains.length} fountains (${unverified} unverified, ${cemetery} cemetery)`);
  console.log(`Excluded ${excluded.length}:`);
  for (const exclusion of excluded) {
    console.log(`  - ${exclusion.id} ${exclusion.location}: ${exclusion.reason}`);
  }
  if (unrecognizedStatuses.length > 0) {
    console.log(`Warning: unrecognized status_odrz values: ${unrecognizedStatuses.join(", ")}`);
  }

  const previous = await readPreviousSnapshot();
  const previousCount = previous ? previous.fountains?.length ?? previous.count : null;
  assertCountPlausible(fountains.length, previousCount);
  if (previous && sameFountains(previous.fountains, fountains)) {
    console.log("No changes to fountains; snapshot left untouched.");
    return;
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const sourceModified = typeof resource.last_modified === "string" ? resource.last_modified : null;
  const snapshot = buildSnapshot(fountains, sourceModified, new Date());
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
