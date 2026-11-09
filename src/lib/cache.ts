const KEY = "hometown_solar_last_scan_v1";

export interface CachedScan {
  address: string;
  lat: number;
  lon: number;
  displayName?: string;
  buildingRing?: Array<[number, number]>;
  buildingSource?: string;
  footprintSqFt?: number;
  portion?: number;
  monthlyKwh?: number;
  savedAt: number;
}

export function loadCachedScan(): CachedScan | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedScan;
  } catch {
    return null;
  }
}

export function saveCachedScan(scan: CachedScan): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(scan));
  } catch {
    /* ignore */
  }
}

export function clearCachedScan(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
