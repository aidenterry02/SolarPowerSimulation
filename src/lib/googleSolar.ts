import { m2ToSqFt, type GeoPoint } from "./geo";

const STORAGE_KEY = "hometown_solar_google_api_key";

export function loadGoogleApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveGoogleApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export interface GoogleSolarRoof {
  source: "google_solar";
  center: GeoPoint;
  /** Whole-roof area from imagery analysis (sq ft). */
  roofAreaSqFt: number;
  /** Max area that can hold panels (sq ft) — best “eligible” signal. */
  eligiblePanelAreaSqFt: number;
  maxArrayPanelsCount: number;
  maxSunshineHoursPerYear?: number;
  carbonOffsetFactorKgPerMwh?: number;
  imageryDate?: string;
  postalCode?: string;
  administrativeArea?: string;
  raw?: unknown;
}

interface BuildingInsightsResponse {
  name?: string;
  center?: { latitude: number; longitude: number };
  imageryDate?: { year: number; month: number; day: number };
  postalCode?: string;
  administrativeArea?: string;
  solarPotential?: {
    maxArrayPanelsCount?: number;
    maxArrayAreaMeters2?: number;
    maxSunshineHoursPerYear?: number;
    carbonOffsetFactorKgPerMwh?: number;
    wholeRoofStats?: {
      areaMeters2?: number;
      sunshineQuantiles?: number[];
    };
    roofSegmentStats?: Array<{
      stats?: { areaMeters2?: number };
      pitchDegrees?: number;
      azimuthDegrees?: number;
    }>;
  };
  error?: { message?: string; status?: string };
}

/**
 * Google Solar API — building insights from aerial/satellite imagery.
 * Requires a Google Maps Platform key with the Solar API enabled.
 * https://developers.google.com/maps/documentation/solar
 */
export async function fetchGoogleSolarBuilding(
  point: GeoPoint,
  apiKey: string,
  signal?: AbortSignal
): Promise<GoogleSolarRoof> {
  const key = apiKey.trim();
  if (!key) throw new Error("Google Solar API key required.");

  const url = new URL(
    "https://solar.googleapis.com/v1/buildingInsights:findClosest"
  );
  url.searchParams.set("location.latitude", String(point.lat));
  url.searchParams.set("location.longitude", String(point.lon));
  url.searchParams.set("requiredQuality", "MEDIUM");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { signal });
  const data = (await res.json()) as BuildingInsightsResponse;

  if (!res.ok) {
    const msg =
      data.error?.message ??
      `Google Solar request failed (${res.status}). Enable Solar API and billing on the key.`;
    throw new Error(msg);
  }

  const pot = data.solarPotential;
  if (!pot) {
    throw new Error("Google Solar returned no solar potential for this building.");
  }

  const roofM2 = pot.wholeRoofStats?.areaMeters2 ?? 0;
  const eligibleM2 = pot.maxArrayAreaMeters2 ?? roofM2 * 0.7;
  const center = data.center
    ? { lat: data.center.latitude, lon: data.center.longitude }
    : point;

  let imageryDate: string | undefined;
  if (data.imageryDate) {
    const { year, month, day } = data.imageryDate;
    imageryDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return {
    source: "google_solar",
    center,
    roofAreaSqFt: m2ToSqFt(roofM2),
    eligiblePanelAreaSqFt: m2ToSqFt(eligibleM2),
    maxArrayPanelsCount: pot.maxArrayPanelsCount ?? 0,
    maxSunshineHoursPerYear: pot.maxSunshineHoursPerYear,
    carbonOffsetFactorKgPerMwh: pot.carbonOffsetFactorKgPerMwh,
    imageryDate,
    postalCode: data.postalCode,
    administrativeArea: data.administrativeArea,
    raw: data,
  };
}
