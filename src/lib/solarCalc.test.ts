import { describe, expect, it } from "vitest";
import { CITIES } from "../data/cities";
import { polygonAreaM2 } from "./geo";
import { calculateEconomics } from "./economics";
import {
  calculateSolar,
  eligibleRoofSqFt,
  estimateRoofAreas,
} from "./solarCalc";

describe("polygonAreaM2", () => {
  it("computes area of a ~100m square near equator-ish lat", () => {
    // ~0.001 deg lat ≈ 111m; use small square
    const lat = 40;
    const d = 0.001;
    const ring: Array<[number, number]> = [
      [-90, lat],
      [-90 + d, lat],
      [-90 + d, lat + d],
      [-90, lat + d],
      [-90, lat],
    ];
    const m2 = polygonAreaM2(ring);
    expect(m2).toBeGreaterThan(5000);
    expect(m2).toBeLessThan(20000);
  });

  it("returns 0 for degenerate rings", () => {
    expect(polygonAreaM2([])).toBe(0);
    expect(polygonAreaM2([[0, 0], [1, 1]])).toBe(0);
  });
});

describe("estimateRoofAreas / eligible", () => {
  it("splits floor area by stories and applies pitch", () => {
    const { footprint, totalRoof } = estimateRoofAreas(2000, 2, 1.15);
    expect(footprint).toBe(1000);
    expect(totalRoof).toBe(1150);
  });

  it("eligible is less than total roof", () => {
    const e = eligibleRoofSqFt(1000, "moderate");
    expect(e).toBeLessThan(1000);
    expect(e).toBeGreaterThan(400);
  });
});

describe("calculateSolar", () => {
  const city = CITIES.find((c) => c.name === "Phoenix")!;

  it("produces more energy in high-sun cities with satellite roof", () => {
    const r = calculateSolar(city, {
      floorAreaSqFt: 1800,
      stories: 1,
      roofPitchFactor: 1.15,
      shading: "minimal",
      coveragePortion: 1,
      monthlyKwh: 1000,
      satelliteRoof: {
        source: "satellite_osm",
        footprintSqFt: 1500,
      },
    });
    expect(r.systemSizeKw).toBeGreaterThan(5);
    expect(r.annualProductionKwh).toBeGreaterThan(8000);
    expect(r.roofSource).toBe("satellite_osm");
  });

  it("uses google eligible area when provided", () => {
    const r = calculateSolar(city, {
      floorAreaSqFt: 1800,
      stories: 1,
      roofPitchFactor: 1,
      shading: "heavy",
      coveragePortion: 1,
      monthlyKwh: 900,
      satelliteRoof: {
        source: "google_solar",
        footprintSqFt: 2000,
        eligibleSqFt: 800,
      },
    });
    expect(r.eligibleRoofSqFt).toBe(800);
    expect(r.roofSource).toBe("google_solar");
  });
});

describe("calculateEconomics", () => {
  it("applies ITC and computes positive year-1 savings with full NM", () => {
    const e = calculateEconomics({
      systemSizeKw: 8,
      annualProductionKwh: 12000,
      annualUsageKwh: 10000,
      ratePerKwh: 0.2,
      costPerWatt: 3,
      itcFraction: 0.3,
      netMetering: "full",
      exportRateFraction: 0.5,
      degradationPerYear: 0.005,
      rateInflationPerYear: 0.03,
      years: 25,
    });
    expect(e.grossInstallUsd).toBe(24000);
    expect(e.itcUsd).toBe(7200);
    expect(e.netInstallUsd).toBe(16800);
    expect(e.year1SavingsUsd).toBeGreaterThan(2000);
    expect(e.simplePaybackYears).not.toBeNull();
    expect(e.simplePaybackYears!).toBeLessThan(15);
    expect(e.cashflow).toHaveLength(25);
  });
});
