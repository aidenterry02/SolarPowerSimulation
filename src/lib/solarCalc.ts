import type { City } from "../data/cities";

/** Modern residential panel assumptions (demo defaults). */
export const PANEL = {
  efficiency: 0.2,
  /** Installed DC watts per square foot of panel footprint. */
  wattsPerSqFt: 18,
  /** System performance ratio (inverter, wiring, soiling, mismatch). */
  performanceRatio: 0.85,
  /** Typical usable fraction after setbacks, vents, edges. */
  setbackFactor: 0.7,
  /** Default orientation/tilt derate for mixed US roofs. */
  orientationFactor: 0.9,
} as const;

export type ShadingLevel = "minimal" | "moderate" | "heavy";

export const SHADING_FACTOR: Record<ShadingLevel, number> = {
  minimal: 0.95,
  moderate: 0.8,
  heavy: 0.55,
};

export type RoofSource = "heuristic" | "satellite_osm" | "google_solar";

export interface SatelliteRoofInput {
  source: RoofSource;
  /** Building footprint / whole roof (sq ft). */
  footprintSqFt: number;
  /** Pre-computed eligible panel area when provider supplies it (sq ft). */
  eligibleSqFt?: number;
  /** Optional annual sunshine hours from Google Solar. */
  maxSunshineHoursPerYear?: number;
}

export interface HomeInputs {
  /** Heated/finished floor area (sq ft). Used when no satellite roof. */
  floorAreaSqFt: number;
  /** Number of stories (affects roof footprint estimate). */
  stories: number;
  /** Roof pitch factor: flat≈1.0, moderate≈1.15, steep≈1.3 */
  roofPitchFactor: number;
  shading: ShadingLevel;
  /** Share of eligible roof covered with panels (0–1). */
  coveragePortion: number;
  /** Monthly household electricity use (kWh). */
  monthlyKwh: number;
  /** Optional override of city default rate ($/kWh). */
  ratePerKwh?: number;
  /** When set, overrides heuristic roof sizing. */
  satelliteRoof?: SatelliteRoofInput;
}

export interface MonthlyPoint {
  month: string;
  productionKwh: number;
  usageKwh: number;
  offsetKwh: number;
}

export interface SolarResult {
  roofFootprintSqFt: number;
  totalRoofAreaSqFt: number;
  eligibleRoofSqFt: number;
  panelAreaSqFt: number;
  systemSizeKw: number;
  annualProductionKwh: number;
  annualUsageKwh: number;
  offsetKwh: number;
  offsetPct: number;
  annualSavingsUsd: number;
  billBeforeUsd: number;
  billAfterUsd: number;
  ratePerKwh: number;
  peakSunHours: number;
  cloudCoverPct: number;
  avgTempF: number;
  monthly: MonthlyPoint[];
  roofSource: RoofSource;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Days per month (non-leap) for monthly allocation. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Seasonal sun-hour multiplier by month.
 * Peak in summer (index 5–7), trough in winter — amplitude scales with latitude.
 */
function monthlySunFactors(lat: number): number[] {
  const amplitude = 0.18 + Math.min(Math.abs(lat) / 90, 0.55) * 0.35;
  return DAYS_IN_MONTH.map((_, i) => {
    // Month center angle; max near June (i≈5) in northern hemisphere
    const angle = ((i - 5) / 12) * 2 * Math.PI;
    return 1 - amplitude * Math.cos(angle);
  });
}

export function estimateRoofAreas(
  floorAreaSqFt: number,
  stories: number,
  roofPitchFactor: number
): { footprint: number; totalRoof: number } {
  const safeStories = Math.max(1, stories);
  const footprint = floorAreaSqFt / safeStories;
  const totalRoof = footprint * roofPitchFactor;
  return { footprint, totalRoof };
}

export function eligibleRoofSqFt(
  totalRoofSqFt: number,
  shading: ShadingLevel
): number {
  return (
    totalRoofSqFt *
    PANEL.setbackFactor *
    PANEL.orientationFactor *
    SHADING_FACTOR[shading]
  );
}

export function calculateSolar(city: City, inputs: HomeInputs): SolarResult {
  const sat = inputs.satelliteRoof;
  let footprint: number;
  let totalRoof: number;
  let eligible: number;
  let roofSource: RoofSource = "heuristic";

  if (sat && sat.footprintSqFt > 0) {
    roofSource = sat.source;
    footprint = sat.footprintSqFt;
    // Satellite footprints are plan-view; apply pitch for surface when OSM-only
    totalRoof =
      sat.source === "google_solar"
        ? sat.footprintSqFt
        : sat.footprintSqFt * inputs.roofPitchFactor;

    if (sat.eligibleSqFt != null && sat.eligibleSqFt > 0) {
      // Provider already accounted for setbacks / panelable area
      eligible =
        sat.eligibleSqFt *
        (sat.source === "google_solar"
          ? 1
          : SHADING_FACTOR[inputs.shading]);
    } else {
      eligible = eligibleRoofSqFt(totalRoof, inputs.shading);
    }
  } else {
    const est = estimateRoofAreas(
      inputs.floorAreaSqFt,
      inputs.stories,
      inputs.roofPitchFactor
    );
    footprint = est.footprint;
    totalRoof = est.totalRoof;
    eligible = eligibleRoofSqFt(totalRoof, inputs.shading);
  }

  const portion = Math.min(1, Math.max(0, inputs.coveragePortion));
  const panelArea = eligible * portion;
  const systemSizeKw = (panelArea * PANEL.wattsPerSqFt) / 1000;

  const rate = inputs.ratePerKwh ?? city.ratePerKwh;
  const annualUsage = inputs.monthlyKwh * 12;

  // Effective daily peak sun hours adjusted slightly by cloud cover vs baseline
  const cloudAdj = 1 - (city.cloudCoverPct - 40) * 0.002;
  let psh = city.peakSunHours * Math.max(0.75, Math.min(1.15, cloudAdj));

  // Prefer imagery-derived annual sunshine when Google Solar provides it
  if (sat?.maxSunshineHoursPerYear && sat.maxSunshineHoursPerYear > 0) {
    psh = sat.maxSunshineHoursPerYear / 365;
  }

  const annualProduction =
    systemSizeKw * psh * 365 * PANEL.performanceRatio;

  const factors = monthlySunFactors(city.lat);
  const factorSum = factors.reduce((a, b) => a + b, 0);

  const monthly: MonthlyPoint[] = MONTHS.map((month, i) => {
    const share = factors[i] / factorSum;
    const productionKwh = annualProduction * share;
    const usageKwh = annualUsage * (DAYS_IN_MONTH[i] / 365);
    const offsetKwh = Math.min(productionKwh, usageKwh);
    return { month, productionKwh, usageKwh, offsetKwh };
  });

  const offsetKwh = Math.min(annualProduction, annualUsage);
  const billBefore = annualUsage * rate;
  const billAfter = Math.max(0, annualUsage - offsetKwh) * rate;
  const annualSavings = billBefore - billAfter;

  return {
    roofFootprintSqFt: footprint,
    totalRoofAreaSqFt: totalRoof,
    eligibleRoofSqFt: eligible,
    panelAreaSqFt: panelArea,
    systemSizeKw,
    annualProductionKwh: annualProduction,
    annualUsageKwh: annualUsage,
    offsetKwh,
    offsetPct: annualUsage > 0 ? (offsetKwh / annualUsage) * 100 : 0,
    annualSavingsUsd: annualSavings,
    billBeforeUsd: billBefore,
    billAfterUsd: billAfter,
    ratePerKwh: rate,
    peakSunHours: psh,
    cloudCoverPct: city.cloudCoverPct,
    avgTempF: city.avgTempF,
    monthly,
    roofSource,
  };
}

export function formatKwh(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 1,
  }).format(n);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatSqFt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
