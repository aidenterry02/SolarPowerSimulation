import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ConfidenceBadge } from "./components/ConfidenceBadge";
import { buildingKey, RoofMap } from "./components/RoofMap";
import { ShareCard } from "./components/ShareCard";
import { CITIES, cityLabel } from "./data/cities";
import { loadCachedScan, saveCachedScan } from "./lib/cache";
import { estimateClimate, fetchPvwattsAnnualKwh } from "./lib/climate";
import { roofConfidence } from "./lib/confidence";
import {
  calculateEconomics,
  type NetMeteringMode,
} from "./lib/economics";
import {
  fetchBuildingCandidates,
  fetchMsBuildingFootprint,
  searchAddresses,
  type BuildingFootprint,
  type GeoPoint,
  type GeocodeResult,
} from "./lib/geo";
import {
  fetchGoogleSolarBuilding,
  loadGoogleApiKey,
  loadNrelApiKey,
  saveGoogleApiKey,
  saveNrelApiKey,
  type GoogleSolarRoof,
} from "./lib/googleSolar";
import {
  calculateSolar,
  formatKwh,
  formatSqFt,
  formatUsd,
  type SatelliteRoofInput,
  type ShadingLevel,
} from "./lib/solarCalc";
import { readUrlState, shareUrl, writeUrlState } from "./lib/urlState";

const STEPS = ["Address", "Roof", "System", "Results"] as const;

export default function App() {
  const urlInit = useMemo(() => readUrlState(), []);
  const cached = useMemo(() => loadCachedScan(), []);

  const [step, setStep] = useState(() =>
    Math.min(3, Math.max(0, urlInit.step ?? (cached ? 1 : 0)))
  );

  const [address, setAddress] = useState(
    () => urlInit.address ?? cached?.address ?? ""
  );
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestTimer = useRef<number | null>(null);

  const [pin, setPin] = useState<GeoPoint | null>(() =>
    urlInit.lat != null && urlInit.lon != null
      ? { lat: urlInit.lat, lon: urlInit.lon }
      : cached
        ? { lat: cached.lat, lon: cached.lon }
        : null
  );
  const [geoLabel, setGeoLabel] = useState<string | null>(
    () => cached?.displayName ?? null
  );
  const [candidates, setCandidates] = useState<BuildingFootprint[]>([]);
  const [building, setBuilding] = useState<BuildingFootprint | null>(() => {
    if (cached?.buildingRing?.length) {
      return {
        source: (cached.buildingSource as BuildingFootprint["source"]) ?? "osm",
        center: { lat: cached.lat, lon: cached.lon },
        ring: cached.buildingRing,
        footprintM2: (cached.footprintSqFt ?? 0) / 10.7639,
        footprintSqFt: cached.footprintSqFt ?? 0,
      };
    }
    return null;
  });
  const [googleRoof, setGoogleRoof] = useState<GoogleSolarRoof | null>(null);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [googleKey, setGoogleKey] = useState(() => loadGoogleApiKey());
  const [nrelKey, setNrelKey] = useState(() => loadNrelApiKey());
  const [pvwatts, setPvwatts] = useState<{
    annualKwh: number;
    monthlyKwh: number[];
  } | null>(null);

  const [floorArea, setFloorArea] = useState(1800);
  const [stories, setStories] = useState(2);
  const [pitch, setPitch] = useState(1.15);
  const [shading, setShading] = useState<ShadingLevel>("moderate");
  const [portion, setPortion] = useState(() => urlInit.portion ?? cached?.portion ?? 0.6);
  const [monthlyKwh, setMonthlyKwh] = useState(
    () => urlInit.monthlyKwh ?? cached?.monthlyKwh ?? 900
  );
  const [rateOverride, setRateOverride] = useState("");
  const [costPerWatt, setCostPerWatt] = useState(
    () => urlInit.costPerWatt ?? 2.8
  );
  const [itc, setItc] = useState(() => urlInit.itc ?? 0.3);
  const [netMetering, setNetMetering] = useState<NetMeteringMode>(
    () => (urlInit.nm as NetMeteringMode) || "full"
  );
  const [exportFrac, setExportFrac] = useState(0.5);
  const [linkCopied, setLinkCopied] = useState(false);

  const climate = useMemo(
    () => (pin ? estimateClimate(pin) : null),
    [pin]
  );
  const city = climate?.city ?? CITIES[0];

  const satelliteRoof: SatelliteRoofInput | undefined = useMemo(() => {
    if (googleRoof) {
      return {
        source: "google_solar",
        footprintSqFt:
          googleRoof.roofAreaSqFt || googleRoof.eligiblePanelAreaSqFt,
        eligibleSqFt: googleRoof.eligiblePanelAreaSqFt,
        maxSunshineHoursPerYear: googleRoof.maxSunshineHoursPerYear,
      };
    }
    if (building) {
      const source: SatelliteRoofInput["source"] =
        building.source === "ms"
          ? "satellite_ms"
          : building.source === "manual"
            ? "manual"
            : "satellite_osm";
      return { source, footprintSqFt: building.footprintSqFt };
    }
    return undefined;
  }, [building, googleRoof]);

  const result = useMemo(() => {
    const rate =
      rateOverride.trim() === ""
        ? undefined
        : Number.parseFloat(rateOverride);
    return calculateSolar(city, {
      floorAreaSqFt: floorArea,
      stories,
      roofPitchFactor: pitch,
      shading,
      coveragePortion: portion,
      monthlyKwh,
      ratePerKwh:
        rate !== undefined && Number.isFinite(rate) && rate > 0
          ? rate
          : climate?.ratePerKwh,
      satelliteRoof,
      climate: climate
        ? {
            lat: pin!.lat,
            peakSunHours: climate.peakSunHours,
            cloudCoverPct: climate.cloudCoverPct,
            avgTempF: climate.avgTempF,
            ratePerKwh: climate.ratePerKwh,
          }
        : undefined,
      productionOverrideKwh: pvwatts?.annualKwh,
      productionOverrideMonthly: pvwatts?.monthlyKwh,
    });
  }, [
    city,
    floorArea,
    stories,
    pitch,
    shading,
    portion,
    monthlyKwh,
    rateOverride,
    satelliteRoof,
    climate,
    pin,
    pvwatts,
  ]);

  const economics = useMemo(
    () =>
      calculateEconomics({
        systemSizeKw: result.systemSizeKw,
        annualProductionKwh: result.annualProductionKwh,
        annualUsageKwh: result.annualUsageKwh,
        ratePerKwh: result.ratePerKwh,
        costPerWatt,
        itcFraction: itc,
        netMetering,
        exportRateFraction: exportFrac,
        degradationPerYear: 0.005,
        rateInflationPerYear: 0.03,
        years: 25,
      }),
    [result, costPerWatt, itc, netMetering, exportFrac]
  );

  const conf = useMemo(
    () =>
      roofConfidence({
        source: result.roofSource,
        buildingDistanceM: building?.distanceM,
        hasGoogle: !!googleRoof,
        candidateCount: candidates.length,
      }),
    [result.roofSource, building, googleRoof, candidates.length]
  );

  // Persist URL + session cache
  useEffect(() => {
    writeUrlState({
      lat: pin?.lat,
      lon: pin?.lon,
      address: address || undefined,
      portion,
      monthlyKwh,
      costPerWatt,
      itc,
      nm: netMetering,
      step,
    });
  }, [pin, address, portion, monthlyKwh, costPerWatt, itc, netMetering, step]);

  useEffect(() => {
    if (!pin || !building) return;
    saveCachedScan({
      address,
      lat: pin.lat,
      lon: pin.lon,
      displayName: geoLabel ?? undefined,
      buildingRing: building.ring,
      buildingSource: building.source,
      footprintSqFt: building.footprintSqFt,
      portion,
      monthlyKwh,
      savedAt: Date.now(),
    });
  }, [pin, building, address, geoLabel, portion, monthlyKwh]);

  // Address autocomplete
  useEffect(() => {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    if (address.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = window.setTimeout(() => {
      void searchAddresses(address, 6)
        .then((r) => setSuggestions(r))
        .catch(() => setSuggestions([]));
    }, 350);
    return () => {
      if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    };
  }, [address]);

  // PVWatts when NREL key + system size
  useEffect(() => {
    if (!pin || !nrelKey.trim() || result.systemSizeKw <= 0) {
      setPvwatts(null);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetchPvwattsAnnualKwh({
        lat: pin.lat,
        lon: pin.lon,
        systemCapacityKw: result.systemSizeKw,
        apiKey: nrelKey,
        signal: ac.signal,
      }).then((r) => {
        if (!ac.signal.aborted) setPvwatts(r);
      });
    }, 600);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [pin, nrelKey, result.systemSizeKw]);

  const runScanAt = useCallback(
    async (point: GeoPoint, label?: string) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setScanStatus("loading");
      setScanError(null);
      setGoogleRoof(null);
      setCandidates([]);
      setPin(point);
      if (label) setGeoLabel(label);

      try {
        let list = await fetchBuildingCandidates(point, ac.signal, 8);
        if (!list.length) {
          const ms = await fetchMsBuildingFootprint(point, ac.signal);
          if (ms) list = [ms];
        }
        if (ac.signal.aborted) return;

        setCandidates(list);
        if (list.length) setBuilding(list[0]);
        else setBuilding(null);

        if (googleKey.trim()) {
          try {
            const g = await fetchGoogleSolarBuilding(
              point,
              googleKey,
              ac.signal
            );
            if (!ac.signal.aborted) setGoogleRoof(g);
          } catch (e) {
            console.warn(e);
          }
        }

        if (!list.length && !googleKey.trim()) {
          throw new Error(
            "No building found. Move the pin or enable Google Solar."
          );
        }
        setScanStatus("done");
        setStep(1);
      } catch (e) {
        if (ac.signal.aborted) return;
        setScanError(e instanceof Error ? e.message : "Scan failed");
        setScanStatus("error");
      }
    },
    [googleKey]
  );

  async function onPickSuggestion(s: GeocodeResult) {
    setAddress(s.displayName);
    setSuggestOpen(false);
    await runScanAt({ lat: s.lat, lon: s.lon }, s.displayName);
  }

  async function onAnalyze() {
    if (pin && address.trim().length < 3) {
      await runScanAt(pin, geoLabel ?? undefined);
      return;
    }
    try {
      setScanStatus("loading");
      const hits = await searchAddresses(address, 1);
      if (!hits.length) throw new Error("Address not found.");
      await onPickSuggestion(hits[0]);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Address lookup failed");
      setScanStatus("error");
    }
  }

  async function onPinMove(p: GeoPoint) {
    setPin(p);
    await runScanAt(p, geoLabel ?? undefined);
  }

  function copyShareLink() {
    const url = shareUrl({
      lat: pin?.lat,
      lon: pin?.lon,
      address,
      portion,
      monthlyKwh,
      costPerWatt,
      itc,
      nm: netMetering,
      step: 3,
    });
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const chartData = result.monthly.map((m) => ({
    month: m.month,
    Production: Math.round(m.productionKwh),
    Usage: Math.round(m.usageKwh),
  }));

  const cashChart = economics.cashflow
    .filter((y) => y.year % 1 === 0)
    .map((y) => ({
      year: `Y${y.year}`,
      Net: Math.round(y.netPositionUsd),
      Cumulative: Math.round(y.cumulativeSavingsUsd),
    }));

  const selectedKey = building ? buildingKey(building) : undefined;
  const usingRoof = !!satelliteRoof;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-kicker">Slices A–F · interactive demo</span>
          <h1>Hometown Solar Savings</h1>
          <p>
            Address → satellite roof → local climate → production, bill savings,
            payback, and a shareable result.
          </p>
        </div>
        <div className="top-links">
          <a
            className="chip-link"
            href="https://aidenterry02.github.io/portfolio_webstite/"
          >
            Portfolio
          </a>
          <a
            className="chip-link"
            href="https://github.com/aidenterry02/SolarPowerSimulation"
          >
            GitHub
          </a>
        </div>
      </header>

      <nav className="wizard-steps" aria-label="Steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`wiz-step ${step === i ? "active" : ""} ${
              i < step ? "done" : ""
            }`}
            onClick={() => setStep(i)}
          >
            <span className="wiz-num">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="layout">
        <aside className="panel controls">
          {step === 0 && (
            <>
              <h2 className="panel-title">1 · Find your home</h2>
              <div className="field">
                <label htmlFor="address">Street address (US)</label>
                <div className="city-wrap">
                  <input
                    id="address"
                    className="input"
                    value={address}
                    placeholder="123 Main St, Buffalo, NY"
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSuggestOpen(true);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onAnalyze();
                      }
                    }}
                  />
                  {suggestOpen && suggestions.length > 0 && (
                    <ul className="suggestions" role="listbox">
                      {suggestions.map((s) => (
                        <li key={`${s.lat},${s.lon},${s.displayName}`}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => void onPickSuggestion(s)}
                          >
                            {s.displayName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={scanStatus === "loading" || address.trim().length < 3}
                onClick={() => void onAnalyze()}
              >
                {scanStatus === "loading"
                  ? "Scanning satellite…"
                  : "Analyze roof from satellite"}
              </button>
              {scanError && <p className="error-text">{scanError}</p>}

              <details className="advanced" style={{ marginTop: "1rem" }}>
                <summary>Pro data sources (API keys)</summary>
                <p className="hint" style={{ marginTop: "0.5rem" }}>
                  Optional. Keys stay in this browser.{" "}
                  <a
                    href="https://developers.google.com/maps/documentation/solar/get-api-key"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Solar
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://developer.nrel.gov/signup/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NREL PVWatts
                  </a>
                </p>
                <label className="hint">Google Solar API key</label>
                <input
                  className="input"
                  type="password"
                  value={googleKey}
                  placeholder="Google Maps Platform key"
                  onChange={(e) => {
                    setGoogleKey(e.target.value);
                    saveGoogleApiKey(e.target.value);
                  }}
                />
                <label className="hint" style={{ marginTop: "0.5rem" }}>
                  NREL PVWatts API key
                </label>
                <input
                  className="input"
                  type="password"
                  value={nrelKey}
                  placeholder="NREL developer key"
                  onChange={(e) => {
                    setNrelKey(e.target.value);
                    saveNrelApiKey(e.target.value);
                  }}
                />
                {googleKey.trim() && (
                  <p className="ok-text">Google Solar will run on next scan.</p>
                )}
              </details>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="panel-title">2 · Confirm roof</h2>
              <p className="hint">
                {geoLabel ?? "Adjust the pin if the wrong building is highlighted."}
              </p>
              {climate && (
                <p className="hint">
                  Climate/rates: {climate.label} · {climate.peakSunHours} PSH · $
                  {climate.ratePerKwh.toFixed(2)}/kWh
                </p>
              )}
              {candidates.length > 1 && (
                <div className="field">
                  <label>Building candidates</label>
                  <div className="candidate-list">
                    {candidates.map((c) => {
                      const key = buildingKey(c);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`candidate ${
                            selectedKey === key ? "active" : ""
                          }`}
                          onClick={() => setBuilding(c)}
                        >
                          {formatSqFt(c.footprintSqFt)} ft² ·{" "}
                          {c.distanceM != null
                            ? `${c.distanceM.toFixed(0)} m`
                            : c.source}{" "}
                          · {c.source}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <ConfidenceBadge {...conf} />
              {googleRoof && (
                <div className="meta-item" style={{ marginTop: "0.75rem" }}>
                  <div className="k">Google Solar</div>
                  <div className="v">
                    {formatSqFt(googleRoof.eligiblePanelAreaSqFt)} ft² panelable
                    · max {googleRoof.maxArrayPanelsCount} panels
                    {googleRoof.imageryDate
                      ? ` · imagery ${googleRoof.imageryDate}`
                      : ""}
                  </div>
                  {googleRoof.rgbUrl && (
                    <p className="hint">
                      Data layers available (GeoTIFF).{" "}
                      <a href={googleRoof.rgbUrl} target="_blank" rel="noreferrer">
                        RGB layer
                      </a>
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: "1rem" }}
                onClick={() => setStep(2)}
                disabled={!usingRoof && !googleRoof}
              >
                Continue to system
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStep(0)}
              >
                Back
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="panel-title">3 · System & economics</h2>
              {!usingRoof && (
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="floor">Floor area (sq ft)</label>
                    <input
                      id="floor"
                      className="input"
                      type="number"
                      value={floorArea}
                      onChange={(e) =>
                        setFloorArea(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="stories">Stories</label>
                    <select
                      id="stories"
                      className="select"
                      value={stories}
                      onChange={(e) => setStories(Number(e.target.value))}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                </div>
              )}

              {result.roofSource !== "google_solar" && (
                <>
                  <div className="field">
                    <label htmlFor="pitch">Roof pitch</label>
                    <select
                      id="pitch"
                      className="select"
                      value={pitch}
                      onChange={(e) => setPitch(Number(e.target.value))}
                    >
                      <option value={1.0}>Flat / low</option>
                      <option value={1.15}>Moderate</option>
                      <option value={1.3}>Steep</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Shading</label>
                    <div className="segmented">
                      {(
                        [
                          ["minimal", "Min"],
                          ["moderate", "Mod"],
                          ["heavy", "Heavy"],
                        ] as const
                      ).map(([k, lab]) => (
                        <button
                          key={k}
                          type="button"
                          className={shading === k ? "active" : ""}
                          onClick={() => setShading(k)}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="field">
                <div className="slider-row">
                  <label htmlFor="portion">Coverage of eligible roof</label>
                  <span className="slider-value">
                    {Math.round(portion * 100)}%
                  </span>
                </div>
                <input
                  id="portion"
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(portion * 100)}
                  onChange={(e) => setPortion(Number(e.target.value) / 100)}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="kwh">Monthly kWh</label>
                  <input
                    id="kwh"
                    className="input"
                    type="number"
                    value={monthlyKwh}
                    onChange={(e) =>
                      setMonthlyKwh(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="rate">$/kWh</label>
                  <input
                    id="rate"
                    className="input"
                    type="number"
                    step={0.01}
                    placeholder={(
                      climate?.ratePerKwh ?? city.ratePerKwh
                    ).toFixed(2)}
                    value={rateOverride}
                    onChange={(e) => setRateOverride(e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="cpw">Install $/W</label>
                  <input
                    id="cpw"
                    className="input"
                    type="number"
                    step={0.1}
                    value={costPerWatt}
                    onChange={(e) =>
                      setCostPerWatt(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="itc">Federal ITC</label>
                  <select
                    id="itc"
                    className="select"
                    value={itc}
                    onChange={(e) => setItc(Number(e.target.value))}
                  >
                    <option value={0}>0%</option>
                    <option value={0.3}>30%</option>
                    <option value={0.26}>26%</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Net metering</label>
                <div className="segmented">
                  {(
                    [
                      ["none", "None"],
                      ["full", "1:1"],
                      ["partial", "Partial"],
                    ] as const
                  ).map(([k, lab]) => (
                    <button
                      key={k}
                      type="button"
                      className={netMetering === k ? "active" : ""}
                      onClick={() => setNetMetering(k)}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
                {netMetering === "partial" && (
                  <div className="slider-row" style={{ marginTop: "0.5rem" }}>
                    <span className="hint">Export credit vs retail</span>
                    <span className="slider-value">
                      {Math.round(exportFrac * 100)}%
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(exportFrac * 100)}
                      onChange={(e) =>
                        setExportFrac(Number(e.target.value) / 100)
                      }
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep(3)}
              >
                See results
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStep(1)}
              >
                Back
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="panel-title">4 · Share</h2>
              <ShareCard
                title={geoLabel ?? climate?.label ?? cityLabel(city)}
                systemKw={result.systemSizeKw}
                annualKwh={result.annualProductionKwh}
                savingsUsd={economics.year1SavingsUsd}
                offsetPct={result.offsetPct}
                paybackYears={economics.simplePaybackYears}
                confidenceLabel={conf.label}
              />
              <button type="button" className="btn-primary" onClick={copyShareLink}>
                {linkCopied ? "Link copied" : "Copy shareable URL"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStep(2)}
              >
                Adjust system
              </button>
            </>
          )}
        </aside>

        <main className="results">
          {pin && (
            <section className="panel card">
              <h2>Satellite map</h2>
              <RoofMap
                center={pin}
                pin={pin}
                buildings={
                  building
                    ? [
                        building,
                        ...candidates.filter(
                          (c) => buildingKey(c) !== buildingKey(building)
                        ),
                      ]
                    : candidates
                }
                selectedKey={selectedKey}
                onPinMove={(p) => void onPinMove(p)}
                onSelectBuilding={setBuilding}
              />
            </section>
          )}

          <section className="hero-cards" aria-label="Key results">
            <article className="stat-card solar">
              <div className="label">System size</div>
              <div className="value">{result.systemSizeKw.toFixed(1)} kW</div>
              <div className="sub">
                {formatSqFt(result.panelAreaSqFt)} ft² panels
              </div>
            </article>
            <article className="stat-card sky">
              <div className="label">Annual production</div>
              <div className="value">
                {formatKwh(result.annualProductionKwh)} kWh
              </div>
              <div className="sub">
                via {result.productionSource} · {result.peakSunHours.toFixed(1)}{" "}
                PSH
              </div>
            </article>
            <article className="stat-card money">
              <div className="label">Year-1 savings</div>
              <div className="value">
                {formatUsd(economics.year1SavingsUsd)}
              </div>
              <div className="sub">
                net install {formatUsd(economics.netInstallUsd)}
              </div>
            </article>
            <article className="stat-card">
              <div className="label">Simple payback</div>
              <div className="value">
                {economics.simplePaybackYears != null
                  ? `${economics.simplePaybackYears.toFixed(1)} yr`
                  : "—"}
              </div>
              <div className="sub">
                ITC {Math.round(itc * 100)}% · NM {netMetering}
              </div>
            </article>
          </section>

          <section className="panel card">
            <h2>Roof & climate</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <div className="k">Eligible roof</div>
                <div className="v">
                  {formatSqFt(result.eligibleRoofSqFt)} ft² · {result.roofSource}
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Climate</div>
                <div className="v">
                  {result.avgTempF.toFixed(0)}°F · {result.cloudCoverPct}% clouds
                  · {climate?.label ?? cityLabel(city)}
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Offset</div>
                <div className="v">
                  {result.offsetPct.toFixed(0)}% of usage (
                  {formatKwh(economics.annualSelfUseKwh)} self /{" "}
                  {formatKwh(economics.annualExportKwh)} export)
                </div>
              </div>
            </div>
            {googleRoof && googleRoof.segments.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h3 className="panel-title">Roof segments (Google Solar)</h3>
                <div className="seg-table">
                  {googleRoof.segments.slice(0, 8).map((s, i) => (
                    <div key={i} className="breakdown-item">
                      <span>
                        Face {i + 1}
                        {s.pitchDegrees != null
                          ? ` · ${s.pitchDegrees.toFixed(0)}° pitch`
                          : ""}
                        {s.azimuthDegrees != null
                          ? ` · ${s.azimuthDegrees.toFixed(0)}° az`
                          : ""}
                      </span>
                      <span>{formatSqFt(s.areaSqFt)} ft²</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="panel card">
            <h2>Monthly production vs usage</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="#243049" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: "#93a4c3", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#93a4c3", fontSize: 12 }} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "#121a2b",
                      border: "1px solid #334563",
                      borderRadius: 10,
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="Usage"
                    fill="rgba(91, 157, 255, 0.35)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="Production"
                    stroke="#3dd68c"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel card">
            <h2>25-year net position (after install)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashChart}>
                  <CartesianGrid stroke="#243049" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fill: "#93a4c3", fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fill: "#93a4c3", fontSize: 12 }} width={56} />
                  <Tooltip
                    contentStyle={{
                      background: "#121a2b",
                      border: "1px solid #334563",
                      borderRadius: 10,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Net"
                    stroke="#f5b942"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Cumulative"
                    stroke="#5b9dff"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              Lifetime net ≈ {formatUsd(economics.lifetimeSavingsUsd)} after{" "}
              {formatUsd(economics.netInstallUsd)} net install (gross{" "}
              {formatUsd(economics.grossInstallUsd)} − ITC{" "}
              {formatUsd(economics.itcUsd)}).
            </p>
          </section>

          <p className="disclaimer">
            Educational demo (plan slices A–F). Satellite roofs use Esri imagery +
            OSM/MS footprints; optional Google Solar & NREL PVWatts with your
            keys. Economics are simplified (degradation 0.5%/yr, rate inflation
            3%/yr). Not an installer quote. Map data © OSM; imagery © Esri.
          </p>
        </main>
      </div>

      <footer className="footer">
        Built by{" "}
        <a href="https://aidenterry02.github.io/portfolio_webstite/">
          Aiden Terry
        </a>{" "}
        ·{" "}
        <a href="https://github.com/aidenterry02/SolarPowerSimulation">
          source
        </a>
      </footer>
    </div>
  );
}
