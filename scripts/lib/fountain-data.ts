import type { Fountain, Snapshot } from "../../src/data/fountains";

export const ZAGREB_BBOX = { minLat: 45.6, maxLat: 46.0, minLon: 15.7, maxLon: 16.3 } as const;

const STATUS_WORKING = "u funkciji";
const STATUS_NOT_WORKING = "nije u funkciji";
const STATUS_NEEDS_SURVEY = "treba teren";
const CEMETERY_MAINTAINER = "Gradska groblja";
const MIN_COUNT_RATIO = 0.5;

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataValidationError";
  }
}

export interface CkanResource {
  format?: string;
  url: string;
  last_modified?: string | null;
}

export interface ZdenacProperties {
  globalid?: string | null;
  lokacija?: string | null;
  napomena_teren?: string | null;
  status_odrz?: string | null;
  odrzava_ki?: string | null;
  tip_zdenca?: string | null;
  [key: string]: unknown;
}

export interface ZdenacFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: ZdenacProperties | null;
}

export interface ZdenciCollection {
  type: "FeatureCollection";
  features: ZdenacFeature[];
}

export interface Exclusion {
  id: string;
  location: string;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

export function selectGeoJsonResource(packageShow: unknown): CkanResource {
  if (
    !isRecord(packageShow) ||
    packageShow.success !== true ||
    !isRecord(packageShow.result) ||
    !Array.isArray(packageShow.result.resources)
  ) {
    throw new DataValidationError("Unexpected package_show response");
  }
  const resource = (packageShow.result.resources as CkanResource[]).find(
    (candidate) =>
      typeof candidate.format === "string" &&
      candidate.format.toLowerCase() === "geojson" &&
      typeof candidate.url === "string",
  );
  if (!resource) throw new DataValidationError("Dataset has no GeoJSON resource");
  return resource;
}

export function normalizeFeatures(input: unknown): {
  fountains: Fountain[];
  excluded: Exclusion[];
  unrecognizedStatuses: string[];
} {
  if (!isRecord(input) || !Array.isArray(input.features)) {
    throw new DataValidationError("Expected a GeoJSON FeatureCollection with a features array");
  }
  const fountains: Fountain[] = [];
  const excluded: Exclusion[] = [];
  const seenIds = new Set<string>();
  const unrecognizedStatuses = new Set<string>();

  (input.features as ZdenacFeature[]).forEach((feature, index) => {
    const props: ZdenacProperties = feature.properties ?? {};
    const id = clean(props.globalid);
    if (!id) throw new DataValidationError(`Feature at index ${index} is missing globalid`);
    if (seenIds.has(id)) throw new DataValidationError(`Feature ${id} has a duplicate globalid`);
    seenIds.add(id);
    const location = clean(props.lokacija);
    if (!location) throw new DataValidationError(`Feature ${id} is missing lokacija`);

    const coordinates = feature.geometry?.type === "Point" ? feature.geometry.coordinates : undefined;
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
      throw new DataValidationError(`Feature ${id} does not have Point geometry`);
    }
    const [lon, lat] = coordinates as [number, number];
    if (lat < ZAGREB_BBOX.minLat || lat > ZAGREB_BBOX.maxLat || lon < ZAGREB_BBOX.minLon || lon > ZAGREB_BBOX.maxLon) {
      throw new DataValidationError(`Feature ${id} has coordinates outside Zagreb (${lat}, ${lon})`);
    }

    const status = clean(props.status_odrz);
    if (status === STATUS_NOT_WORKING) {
      excluded.push({ id, location, reason: `not working (${STATUS_NOT_WORKING})` });
      return;
    }
    if (status !== undefined && status !== STATUS_WORKING && status !== STATUS_NEEDS_SURVEY) {
      unrecognizedStatuses.add(status);
    }
    const hint = clean(props.napomena_teren);
    const type = clean(props.tip_zdenca);
    fountains.push({
      id,
      lat: round6(lat),
      lon: round6(lon),
      location,
      ...(hint ? { hint } : {}),
      status: status === STATUS_WORKING ? "working" : "unverified",
      cemetery: (clean(props.odrzava_ki) ?? "").includes(CEMETERY_MAINTAINER),
      ...(type ? { type } : {}),
    });
  });

  fountains.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { fountains, excluded, unrecognizedStatuses: [...unrecognizedStatuses].sort() };
}

export function assertCountPlausible(nextCount: number, previousCount: number | null): void {
  if (nextCount === 0) {
    throw new DataValidationError("Source returned no usable fountains");
  }
  if (previousCount !== null && nextCount < previousCount * MIN_COUNT_RATIO) {
    throw new DataValidationError(
      `Only ${nextCount} fountains, less than half of the previous ${previousCount}; refusing to overwrite`,
    );
  }
}

export function sameFountains(a: readonly Fountain[], b: readonly Fountain[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildSnapshot(fountains: Fountain[], sourceModified: string | null | undefined, now: Date): Snapshot {
  return {
    generatedAt: now.toISOString(),
    sourceModified: sourceModified ?? "",
    count: fountains.length,
    fountains,
  };
}
