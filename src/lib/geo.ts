/** Convert square meters to square feet. */
export function m2ToSqFt(m2: number): number {
  return m2 * 10.7639;
}

/** Approximate polygon area (m²) from lon/lat ring using equirectangular shoelace. */
export function polygonAreaM2(ring: Array<[number, number]>): number {
  if (ring.length < 3) return 0;
  const lat0 = ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * cos;

  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    const x1 = lon1 * mPerDegLon;
    const y1 = lat1 * mPerDegLat;
    const x2 = lon2 * mPerDegLon;
    const y2 = lat2 * mPerDegLat;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function haversineMeters(
  a: GeoPoint,
  b: GeoPoint
): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLon = toR(b.lon - a.lon);
  const lat1 = toR(a.lat);
  const lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeocodeResult extends GeoPoint {
  displayName: string;
  boundingBox?: [number, number, number, number];
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function proxyUrl(url: string): string {
  const base = import.meta.env.VITE_API_PROXY as string | undefined;
  if (!base) return url;
  return `${base.replace(/\/$/, "")}?url=${encodeURIComponent(url)}`;
}

/**
 * Free geocoding via OpenStreetMap Nominatim (US bias).
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal
): Promise<GeocodeResult> {
  const results = await searchAddresses(address, 1, signal);
  if (!results.length) {
    throw new Error("No match found. Try a fuller address (street, city, state).");
  }
  return results[0];
}

/** Debounced-friendly address autocomplete. */
export async function searchAddresses(
  query: string,
  limit = 6,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(proxyUrl(url.toString()), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    boundingbox?: [string, string, string, string];
  }>;

  return data.map((hit) => {
    const result: GeocodeResult = {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      displayName: hit.display_name,
    };
    if (hit.boundingbox) {
      result.boundingBox = hit.boundingbox.map(Number) as [
        number,
        number,
        number,
        number,
      ];
    }
    return result;
  });
}

export interface BuildingFootprint {
  source: "osm" | "ms" | "manual";
  center: GeoPoint;
  ring: Array<[number, number]>;
  footprintM2: number;
  footprintSqFt: number;
  osmId?: number;
  buildingTag?: string;
  distanceM?: number;
  score?: number;
}

function parseOverpassGeometry(
  geometry: Array<{ lat: number; lon: number }>
): Array<[number, number]> {
  return geometry.map((p) => [p.lon, p.lat]);
}

function footprintFromRing(
  ring: Array<[number, number]>,
  source: BuildingFootprint["source"],
  extra?: Partial<BuildingFootprint>
): BuildingFootprint | null {
  const area = polygonAreaM2(ring);
  if (area < 15) return null;
  const cLat = ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
  const cLon = ring.reduce((s, [lon]) => s + lon, 0) / ring.length;
  return {
    source,
    center: { lat: cLat, lon: cLon },
    ring,
    footprintM2: area,
    footprintSqFt: m2ToSqFt(area),
    ...extra,
  };
}

async function overpassQuery(
  query: string,
  signal?: AbortSignal
): Promise<{
  elements: Array<{
    type: string;
    id: number;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(proxyUrl(endpoint), {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastError = new Error(`Building lookup failed (${res.status}).`);
        continue;
      }
      return (await res.json()) as {
        elements: Array<{
          type: string;
          id: number;
          tags?: Record<string, string>;
          geometry?: Array<{ lat: number; lon: number }>;
        }>;
      };
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("All Overpass endpoints failed.");
}

/**
 * Rank nearby OSM buildings by distance + plausible residential area.
 */
export async function fetchBuildingCandidates(
  point: GeoPoint,
  signal?: AbortSignal,
  limit = 8
): Promise<BuildingFootprint[]> {
  const radii = [40, 90, 160, 280];
  const seen = new Set<number>();
  const candidates: BuildingFootprint[] = [];

  for (const radius of radii) {
    const query = `
[out:json][timeout:25];
(
  way["building"](around:${radius},${point.lat},${point.lon});
);
out body geom;
`.trim();

    try {
      const data = await overpassQuery(query, signal);
      for (const way of data.elements) {
        if (way.type !== "way" || !way.geometry || way.geometry.length < 3) continue;
        if (seen.has(way.id)) continue;
        seen.add(way.id);
        const ring = parseOverpassGeometry(way.geometry);
        const fp = footprintFromRing(ring, "osm", {
          osmId: way.id,
          buildingTag: way.tags?.building,
        });
        if (!fp) continue;
        const distanceM = haversineMeters(point, fp.center);
        fp.distanceM = distanceM;
        // Prefer closer + typical house size (40–400 m²)
        const sizeScore =
          fp.footprintM2 >= 40 && fp.footprintM2 <= 400
            ? 1
            : fp.footprintM2 < 40
              ? 0.4
              : 0.7;
        const distScore = Math.max(0, 1 - distanceM / 250);
        fp.score = distScore * 0.7 + sizeScore * 0.3;
        candidates.push(fp);
      }
      if (candidates.length >= limit) break;
    } catch {
      /* try next radius / endpoint already handled */
    }
  }

  candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return candidates.slice(0, limit);
}

export async function fetchNearestBuilding(
  point: GeoPoint,
  signal?: AbortSignal
): Promise<BuildingFootprint> {
  const list = await fetchBuildingCandidates(point, signal, 5);
  if (list.length) return list[0];

  // Microsoft US Building Footprints via ArcGIS (open layer) fallback
  const ms = await fetchMsBuildingFootprint(point, signal);
  if (ms) return ms;

  throw new Error(
    "No building outline found near that pin. Click the map or draw a rough outline."
  );
}

/**
 * Query Esri USA Structures / building footprint service near a point.
 * Best-effort fallback when OSM is empty.
 */
export async function fetchMsBuildingFootprint(
  point: GeoPoint,
  signal?: AbortSignal
): Promise<BuildingFootprint | null> {
  try {
    // Public building footprints layer (Microsoft-derived / Esri hosted where available)
    const url = new URL(
      "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Structures/FeatureServer/0/query"
    );
    url.searchParams.set("f", "geojson");
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set(
      "geometry",
      JSON.stringify({ x: point.lon, y: point.lat, spatialReference: { wkid: 4326 } })
    );
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("distance", "40");
    url.searchParams.set("units", "esriSRUnit_Meter");
    url.searchParams.set("outFields", "*");
    url.searchParams.set("returnGeometry", "true");

    const res = await fetch(proxyUrl(url.toString()), { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: number[][][] | number[][][][] };
        properties?: Record<string, unknown>;
      }>;
    };
    const feat = data.features?.[0];
    if (!feat?.geometry?.coordinates) return null;

    // Polygon or MultiPolygon
    let ring: Array<[number, number]> = [];
    const coords = feat.geometry.coordinates as number[][][] | number[][][][];
    if (Array.isArray(coords[0]?.[0]?.[0])) {
      ring = (coords as number[][][][])[0][0].map((c) => [c[0], c[1]]);
    } else {
      ring = (coords as number[][][])[0].map((c) => [c[0], c[1]]);
    }
    const fp = footprintFromRing(ring, "ms");
    if (fp) fp.distanceM = haversineMeters(point, fp.center);
    return fp;
  } catch {
    return null;
  }
}

export function buildingFromManualRing(
  ring: Array<[number, number]>
): BuildingFootprint {
  const fp = footprintFromRing(ring, "manual");
  if (!fp) throw new Error("Outline too small — add more points around the roof.");
  return fp;
}

export function satelliteTileUrl(z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}
