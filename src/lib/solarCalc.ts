import type { City } from "../data/cities";

/** Modern residential panel assumptions (demo defaults). */
export const PANEL = {
  efficiency: 0.2,
  wattsPerSqFt: 18,
  performanceRatio: 0.85,
  setbackFactor: 0.7,
  orientationFactor: 0.9,
} as const;

export type ShadingLevel = "minimal" | "moderate" | "heavy";

export const SHADING_FACTOR: Record<ShadingLevel, number> = {
  minimal: 0.95,
  moderate: 0.8,
  heavy: 0.55,
};

export type RoofSource =
  | "heuristic"
  | "satellite_osm"
  | "satellite_ms"
  | "manual"
  | "google_solar";

export interface SatelliteRoofInput {
  source: RoofSource;
  footprintSqFt: number;
  eligibleSqFt?: number;
  maxSunshineHoursPerYear?: number;
}

export interface ClimateInput {
  lat: number;
  peakSunHours: number;
  cloudCoverPct: number;
  avgTempF: number;
  ratePerKwh: number;
}

export interface HomeInputs {
  floorAreaSqFt: number;
  stories: number;
  roofPitchFactor: number;
  shading: ShadingLevel;
  coveragePortion: number;
  monthlyKwh: number;
  ratePerKwh?: number;
  satelliteRoof?: SatelliteRoofInput;
  climate?: ClimateInput;
  /** Override annual production (e.g. NREL PVWatts). */
  productionOverrideKwh?: number;
  productionOverrideMonthly?: number[];
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
  productionSource: "model" | "pvwatts" | "google_sunshine";
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

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function monthlySunFactors(lat: number): number[] {
  const amplitude = 0.18 + Math.min(Math.abs(lat) / 90, 0.55) * 0.35;
  return DAYS_IN_MONTH.map((_, i) => {
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
  const climate = inputs.climate;
  const lat = climate?.lat ?? city.lat;
  const basePsh = climate?.peakSunHours ?? city.peakSunHours;
  const cloud = climate?.cloudCoverPct ?? city.cloudCoverPct;
  const temp = climate?.avgTempF ?? city.avgTempF;
  const defaultRate = climate?.ratePerKwh ?? city.ratePerKwh;

  let footprint: number;
  let totalRoof: number;
  let eligible: number;
  let roofSource: RoofSource = "heuristic";

  if (sat && sat.footprintSqFt > 0) {
    roofSource = sat.source;
    footprint = sat.footprintSqFt;
    totalRoof =
      sat.source === "google_solar"
        ? sat.footprintSqFt
        : sat.footprintSqFt * inputs.roofPitchFactor;

    if (sat.eligibleSqFt != null && sat.eligibleSqFt > 0) {
      eligible =
        sat.eligibleSqFt *
        (sat.source === "google_solar" ? 1 : SHADING_FACTOR[inputs.shading]);
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

  const rate = inputs.ratePerKwh ?? defaultRate;
  const annualUsage = inputs.monthlyKwh * 12;

  const cloudAdj = 1 - (cloud - 40) * 0.002;
  let psh = basePsh * Math.max(0.75, Math.min(1.15, cloudAdj));
  let productionSource: SolarResult["productionSource"] = "model";

  if (sat?.maxSunshineHoursPerYear && sat.maxSunshineHoursPerYear > 0) {
    psh = sat.maxSunshineHoursPerYear / 365;
    productionSource = "google_sunshine";
  }

  let annualProduction = systemSizeKw * psh * 365 * PANEL.performanceRatio;
  let monthlyProduction: number[] | null = null;

  if (
    inputs.productionOverrideKwh != null &&
    inputs.productionOverrideKwh > 0
  ) {
    annualProduction = inputs.productionOverrideKwh;
    productionSource = "pvwatts";
    if (
      inputs.productionOverrideMonthly &&
      inputs.productionOverrideMonthly.length === 12
    ) {
      monthlyProduction = inputs.productionOverrideMonthly;
    }
  }

  const factors = monthlySunFactors(lat);
  const factorSum = factors.reduce((a, b) => a + b, 0);

  const monthly: MonthlyPoint[] = MONTHS.map((month, i) => {
    const productionKwh = monthlyProduction
      ? monthlyProduction[i]
      : annualProduction * (factors[i] / factorSum);
    const usageKwh = annualUsage * (DAYS_IN_MONTH[i] / 365);
    const offsetKwh = Math.min(productionKwh, usageKwh);
    return { month, productionKwh, usageKwh, offsetKwh };
  });

  const offsetKwh = Math.min(annualProduction, annualUsage);
  const billBefore = annualUsage * rate;
  const billAfter = Math.max(0, annualUsage - offsetKwh) * rate;

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
    annualSavingsUsd: billBefore - billAfter,
    billBeforeUsd: billBefore,
    billAfterUsd: billAfter,
    ratePerKwh: rate,
    peakSunHours: psh,
    cloudCoverPct: cloud,
    avgTempF: temp,
    monthly,
    roofSource,
    productionSource,
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
