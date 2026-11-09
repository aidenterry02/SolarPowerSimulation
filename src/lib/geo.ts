/** Convert square meters to square feet. */
export function m2ToSqFt(m2: number): number {
  return m2 * 10.7639;
}

/** Approximate polygon area (m²) from lon/lat ring using equirectangular shoelace. */
export function polygonAreaM2(ring: Array<[number, number]>): number {
  if (ring.length < 3) return 0;
  const lat0 =
    ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
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

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeocodeResult extends GeoPoint {
  displayName: string;
  boundingBox?: [number, number, number, number]; // south, north, west, east
}

/**
 * Free geocoding via OpenStreetMap Nominatim (US bias).
 * Respect usage policy: identify app, moderate request rate.
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal
): Promise<GeocodeResult> {
  const q = address.trim();
  if (!q) throw new Error("Enter a street address.");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    boundingbox?: [string, string, string, string];
  }>;

  if (!data.length) {
    throw new Error("No match found. Try a fuller address (street, city, state).");
  }

  const hit = data[0];
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
}

export interface BuildingFootprint {
  source: "osm";
  center: GeoPoint;
  /** Outer ring lon/lat pairs (closed optional). */
  ring: Array<[number, number]>;
  footprintM2: number;
  footprintSqFt: number;
  osmId?: number;
  buildingTag?: string;
}

function parseOverpassGeometry(
  geometry: Array<{ lat: number; lon: number }>
): Array<[number, number]> {
  return geometry.map((p) => [p.lon, p.lat]);
}

/**
 * Fetch nearest building footprint from OpenStreetMap via Overpass.
 * Footprints are mapped building outlines (often derived from imagery).
 */
export async function fetchNearestBuilding(
  point: GeoPoint,
  signal?: AbortSignal
): Promise<BuildingFootprint> {
  // Expand search radii until we find a building way with geometry
  const radii = [40, 80, 150, 250];
  let lastError: Error | null = null;

  for (const radius of radii) {
    const query = `
[out:json][timeout:25];
(
  way["building"](around:${radius},${point.lat},${point.lon});
);
out body geom;
`.trim();

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      lastError = new Error(`Building lookup failed (${res.status}).`);
      continue;
    }

    const data = (await res.json()) as {
      elements: Array<{
        type: string;
        id: number;
        tags?: Record<string, string>;
        geometry?: Array<{ lat: number; lon: number }>;
      }>;
    };

    const ways = data.elements.filter(
      (e) => e.type === "way" && e.geometry && e.geometry.length >= 3
    );
    if (!ways.length) continue;

    // Pick building whose centroid is closest to the geocode point
    let best: BuildingFootprint | null = null;
    let bestDist = Infinity;

    for (const way of ways) {
      const ring = parseOverpassGeometry(way.geometry!);
      const area = polygonAreaM2(ring);
      if (area < 15) continue; // skip tiny sheds / noise

      const cLat =
        ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
      const cLon =
        ring.reduce((s, [lon]) => s + lon, 0) / ring.length;
      const dLat = cLat - point.lat;
      const dLon = cLon - point.lon;
      const dist = dLat * dLat + dLon * dLon;

      if (dist < bestDist) {
        bestDist = dist;
        best = {
          source: "osm",
          center: { lat: cLat, lon: cLon },
          ring,
          footprintM2: area,
          footprintSqFt: m2ToSqFt(area),
          osmId: way.id,
          buildingTag: way.tags?.building,
        };
      }
    }

    if (best) return best;
  }

  throw (
    lastError ??
    new Error(
      "No building outline found near that pin. Try a more precise house address."
    )
  );
}

/** Esri World Imagery tile URL (satellite). */
export function satelliteTileUrl(z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

/** Web mercator helpers for a simple static satellite preview. */
export function latLonToTile(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y, z };
}

export function projectToPixel(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  z: number,
  width: number,
  height: number
): { x: number; y: number } {
  const n = 2 ** z;
  const world = n * 256;

  const lonToX = (lo: number) => ((lo + 180) / 360) * world;
  const latToY = (la: number) => {
    const latRad = (la * Math.PI) / 180;
    return (
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      world
    );
  };

  const cx = lonToX(centerLon);
  const cy = latToY(centerLat);
  const px = lonToX(lon);
  const py = latToY(lat);

  return {
    x: width / 2 + (px - cx),
    y: height / 2 + (py - cy),
  };
}
