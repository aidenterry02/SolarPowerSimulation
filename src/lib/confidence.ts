import type { RoofSource } from "./solarCalc";

export type ConfidenceLevel = "high" | "medium" | "low";

export function roofConfidence(opts: {
  source: RoofSource;
  buildingDistanceM?: number;
  hasGoogle?: boolean;
  candidateCount?: number;
}): { level: ConfidenceLevel; label: string; detail: string; score: number } {
  if (opts.source === "google_solar" || opts.hasGoogle) {
    return {
      level: "high",
      label: "High confidence",
      detail: "Eligible area from Google Solar aerial/satellite model.",
      score: 92,
    };
  }
  if (opts.source === "satellite_osm") {
    const d = opts.buildingDistanceM ?? 99;
    const many = (opts.candidateCount ?? 1) > 1;
    if (d < 25 && !many) {
      return {
        level: "high",
        label: "Good confidence",
        detail: "Close OSM building outline on satellite basemap.",
        score: 78,
      };
    }
    if (d < 60) {
      return {
        level: "medium",
        label: "Medium confidence",
        detail: many
          ? "Multiple buildings nearby — confirm the outline."
          : "OSM footprint used; verify outline on the map.",
        score: 62,
      };
    }
    return {
      level: "low",
      label: "Low confidence",
      detail: "Building match is distant — pick another outline or move the pin.",
      score: 40,
    };
  }
  return {
    level: "low",
    label: "Estimate only",
    detail: "Home-size heuristic — run a satellite scan for a real roof.",
    score: 28,
  };
}
