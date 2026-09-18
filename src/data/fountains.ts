export interface Fountain {
  id: string;
  lat: number;
  lon: number;
  location: string;
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
  fountains: Fountain[];
}

export async function loadSnapshot(url: string, fetchFn: typeof fetch = fetch): Promise<Snapshot> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to load fountains: HTTP ${response.status}`);
  }
  const data = (await response.json()) as Partial<Snapshot>;
  if (!Array.isArray(data.fountains)) {
    throw new Error("Fountain data is malformed");
  }
  if (typeof data.generatedAt !== "string" || typeof data.lastCheckedAt !== "string") {
    throw new Error("Fountain data is malformed");
  }
  return {
    generatedAt: data.generatedAt,
    lastCheckedAt: data.lastCheckedAt,
    sourceModified: typeof data.sourceModified === "string" ? data.sourceModified : "",
    count: typeof data.count === "number" ? data.count : data.fountains.length,
    fountains: data.fountains,
  };
}

export async function loadFountains(url: string, fetchFn: typeof fetch = fetch): Promise<Fountain[]> {
  return (await loadSnapshot(url, fetchFn)).fountains;
}
