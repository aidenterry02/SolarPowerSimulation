import { CITIES, type City } from "../data/cities";
import type { GeoPoint } from "./geo";
import { haversineMeters } from "./geo";

/** Find nearest catalog city for rates / climate defaults. */
export function nearestCity(point: GeoPoint): City & { distanceKm: number } {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = haversineMeters(point, { lat: c.lat, lon: c.lon });
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { ...best, distanceKm: bestD / 1000 };
}

/**
 * Continuous peak-sun-hour estimate from latitude + nearest-city blend.
 * Used when pin is far from catalog cities.
 */
export function estimateClimate(point: GeoPoint): {
  city: City;
  peakSunHours: number;
  cloudCoverPct: number;
  avgTempF: number;
  ratePerKwh: number;
  label: string;
} {
  const city = nearestCity(point);
  // Rough lat-based PSH prior for CONUS (higher in SW lower latitudes)
  const latFactor = Math.max(0.55, 1.15 - Math.abs(point.lat - 33) * 0.018);
  const blend = Math.min(1, city.distanceKm / 400);
  const peakSunHours =
    city.peakSunHours * (1 - blend * 0.35) +
    city.peakSunHours * latFactor * blend * 0.35;

  return {
    city,
    peakSunHours: Math.round(peakSunHours * 100) / 100,
    cloudCoverPct: city.cloudCoverPct,
    avgTempF: city.avgTempF,
    ratePerKwh: city.ratePerKwh,
    label:
      city.distanceKm < 25
        ? `${city.name}, ${city.state}`
        : `Near ${city.name}, ${city.state} (${city.distanceKm.toFixed(0)} km)`,
  };
}

/** Optional NREL PVWatts v8 annual AC production (requires free NREL key). */
export async function fetchPvwattsAnnualKwh(opts: {
  lat: number;
  lon: number;
  systemCapacityKw: number;
  apiKey: string;
  lossesPct?: number;
  signal?: AbortSignal;
}): Promise<{ annualKwh: number; monthlyKwh: number[] } | null> {
  const key = opts.apiKey.trim();
  if (!key || opts.systemCapacityKw <= 0) return null;

  const url = new URL("https://developer.nrel.gov/api/pvwatts/v8.json");
  url.searchParams.set("api_key", key);
  url.searchParams.set("lat", String(opts.lat));
  url.searchParams.set("lon", String(opts.lon));
  url.searchParams.set("system_capacity", String(opts.systemCapacityKw));
  url.searchParams.set("azimuth", "180");
  url.searchParams.set("tilt", "20");
  url.searchParams.set("array_type", "1");
  url.searchParams.set("module_type", "0");
  url.searchParams.set("losses", String(opts.lossesPct ?? 14));

  try {
    const res = await fetch(url.toString(), { signal: opts.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      outputs?: { ac_annual?: number; ac_monthly?: number[] };
    };
    const annual = data.outputs?.ac_annual;
    const monthly = data.outputs?.ac_monthly;
    if (annual == null || !monthly) return null;
    return { annualKwh: annual, monthlyKwh: monthly };
  } catch {
    return null;
  }
}
