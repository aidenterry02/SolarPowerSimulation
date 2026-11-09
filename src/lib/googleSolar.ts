import { m2ToSqFt, type GeoPoint } from "./geo";

const STORAGE_KEY = "hometown_solar_google_api_key";
const NREL_KEY = "hometown_solar_nrel_api_key";

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
    /* ignore */
  }
}

export function loadNrelApiKey(): string {
  try {
    return localStorage.getItem(NREL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNrelApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(NREL_KEY, key.trim());
    else localStorage.removeItem(NREL_KEY);
  } catch {
    /* ignore */
  }
}

export interface RoofSegment {
  areaSqFt: number;
  pitchDegrees?: number;
  azimuthDegrees?: number;
  sunshineQuantile?: number;
}

export interface GoogleSolarRoof {
  source: "google_solar";
  center: GeoPoint;
  roofAreaSqFt: number;
  eligiblePanelAreaSqFt: number;
  maxArrayPanelsCount: number;
  maxSunshineHoursPerYear?: number;
  carbonOffsetFactorKgPerMwh?: number;
  imageryDate?: string;
  postalCode?: string;
  administrativeArea?: string;
  segments: RoofSegment[];
  /** Optional RGB imagery URL from dataLayers (may need key). */
  rgbUrl?: string;
  maskUrl?: string;
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
      stats?: { areaMeters2?: number; sunshineQuantiles?: number[] };
      pitchDegrees?: number;
      azimuthDegrees?: number;
    }>;
  };
  error?: { message?: string; status?: string };
}

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

  const segments: RoofSegment[] = (pot.roofSegmentStats ?? []).map((s) => ({
    areaSqFt: m2ToSqFt(s.stats?.areaMeters2 ?? 0),
    pitchDegrees: s.pitchDegrees,
    azimuthDegrees: s.azimuthDegrees,
    sunshineQuantile: s.stats?.sunshineQuantiles?.[5],
  }));

  // Best-effort dataLayers URLs for imagery (GeoTIFF links — shown as status, not always browser-displayable)
  let rgbUrl: string | undefined;
  let maskUrl: string | undefined;
  try {
    const dl = new URL("https://solar.googleapis.com/v1/dataLayers:get");
    dl.searchParams.set("location.latitude", String(center.lat));
    dl.searchParams.set("location.longitude", String(center.lon));
    dl.searchParams.set("radiusMeters", "50");
    dl.searchParams.set("view", "FULL_LAYERS");
    dl.searchParams.set("requiredQuality", "MEDIUM");
    dl.searchParams.set("pixelSizeMeters", "0.5");
    dl.searchParams.set("key", key);
    const dlRes = await fetch(dl.toString(), { signal });
    if (dlRes.ok) {
      const layers = (await dlRes.json()) as {
        rgbUrl?: string;
        maskUrl?: string;
      };
      rgbUrl = layers.rgbUrl;
      maskUrl = layers.maskUrl;
    }
  } catch {
    /* optional */
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
    segments,
    rgbUrl,
    maskUrl,
    raw: data,
  };
}
