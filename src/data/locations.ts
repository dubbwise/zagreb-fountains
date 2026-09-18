export interface Location {
  id: string;
  lat: number;
  lon: number;
  name: string;
  hint?: string;
  status: "working" | "unverified";
  cemetery: boolean;
  type?: string;
}

export interface Snapshot {
  generatedAt: string;
  lastCheckedAt: string;
  sourceModified: string;
  count: number;
  locations: Location[];
}

export async function loadSnapshot(url: string, fetchFn: typeof fetch = fetch): Promise<Snapshot> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to load locations: HTTP ${response.status}`);
  }
  const data = (await response.json()) as Partial<Snapshot>;
  if (!Array.isArray(data.locations)) {
    throw new Error("Location data is malformed");
  }
  if (typeof data.generatedAt !== "string" || typeof data.lastCheckedAt !== "string") {
    throw new Error("Location data is malformed");
  }
  return {
    generatedAt: data.generatedAt,
    lastCheckedAt: data.lastCheckedAt,
    sourceModified: typeof data.sourceModified === "string" ? data.sourceModified : "",
    count: typeof data.count === "number" ? data.count : data.locations.length,
    locations: data.locations,
  };
}

export async function loadLocations(url: string, fetchFn: typeof fetch = fetch): Promise<Location[]> {
  return (await loadSnapshot(url, fetchFn)).locations;
}
