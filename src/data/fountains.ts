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
  sourceModified: string;
  count: number;
  fountains: Fountain[];
}

export async function loadFountains(url: string, fetchFn: typeof fetch = fetch): Promise<Fountain[]> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to load fountains: HTTP ${response.status}`);
  }
  const data = (await response.json()) as Partial<Snapshot>;
  if (!Array.isArray(data.fountains)) {
    throw new Error("Fountain data is malformed");
  }
  return data.fountains;
}
