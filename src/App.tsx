import { useMemo, useRef, useState } from "react";
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
import { SatelliteMap } from "./components/SatelliteMap";
import { CITIES, cityLabel, searchCities, type City } from "./data/cities";
import {
  fetchNearestBuilding,
  geocodeAddress,
  type BuildingFootprint,
  type GeoPoint,
} from "./lib/geo";
import {
  fetchGoogleSolarBuilding,
  loadGoogleApiKey,
  saveGoogleApiKey,
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

const DEFAULT_CITY =
  CITIES.find((c) => c.name === "Buffalo" && c.state === "NY") ?? CITIES[0];

type AnalyzeStatus = "idle" | "loading" | "done" | "error";

export default function App() {
  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [query, setQuery] = useState(cityLabel(DEFAULT_CITY));
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<number | null>(null);
  const analyzeAbort = useRef<AbortController | null>(null);

  const [address, setAddress] = useState("1 Niagara Square, Buffalo, NY");
  const [googleKey, setGoogleKey] = useState(() => loadGoogleApiKey());
  const [showKey, setShowKey] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [geoPoint, setGeoPoint] = useState<GeoPoint | null>(null);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [building, setBuilding] = useState<BuildingFootprint | null>(null);
  const [googleRoof, setGoogleRoof] = useState<GoogleSolarRoof | null>(null);

  const [floorArea, setFloorArea] = useState(1800);
  const [stories, setStories] = useState(2);
  const [pitch, setPitch] = useState(1.15);
  const [shading, setShading] = useState<ShadingLevel>("moderate");
  const [portion, setPortion] = useState(0.6);
  const [monthlyKwh, setMonthlyKwh] = useState(900);
  const [rateOverride, setRateOverride] = useState<string>("");

  const suggestions = useMemo(() => searchCities(query, 10), [query]);

  const satelliteRoof: SatelliteRoofInput | undefined = useMemo(() => {
    if (googleRoof) {
      return {
        source: "google_solar",
        footprintSqFt: googleRoof.roofAreaSqFt || googleRoof.eligiblePanelAreaSqFt,
        eligibleSqFt: googleRoof.eligiblePanelAreaSqFt,
        maxSunshineHoursPerYear: googleRoof.maxSunshineHoursPerYear,
      };
    }
    if (building) {
      return {
        source: "satellite_osm",
        footprintSqFt: building.footprintSqFt,
      };
    }
    return undefined;
  }, [building, googleRoof]);

  const result = useMemo(() => {
    const rate =
      rateOverride.trim() === "" ? undefined : Number.parseFloat(rateOverride);
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
          : undefined,
      satelliteRoof,
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
  ]);

  function pickCity(c: City) {
    setCity(c);
    setQuery(cityLabel(c));
    setOpen(false);
  }

  function clearSatellite() {
    setBuilding(null);
    setGoogleRoof(null);
    setGeoPoint(null);
    setGeoLabel(null);
    setAnalyzeStatus("idle");
    setAnalyzeError(null);
  }

  async function analyzeRoof() {
    analyzeAbort.current?.abort();
    const ac = new AbortController();
    analyzeAbort.current = ac;

    setAnalyzeStatus("loading");
    setAnalyzeError(null);
    setBuilding(null);
    setGoogleRoof(null);
    setGeoPoint(null);
    setGeoLabel(null);

    try {
      const fullAddress = address.trim().includes(city.name)
        ? address.trim()
        : `${address.trim()}, ${cityLabel(city)}`;

      const geo = await geocodeAddress(fullAddress, ac.signal);
      if (ac.signal.aborted) return;

      setGeoPoint({ lat: geo.lat, lon: geo.lon });
      setGeoLabel(geo.displayName);

      // Prefer Google Solar when a key is present; still fetch OSM outline for map
      const osmPromise = fetchNearestBuilding(
        { lat: geo.lat, lon: geo.lon },
        ac.signal
      ).catch(() => null);

      let gRoof: GoogleSolarRoof | null = null;
      if (googleKey.trim()) {
        try {
          gRoof = await fetchGoogleSolarBuilding(
            { lat: geo.lat, lon: geo.lon },
            googleKey,
            ac.signal
          );
        } catch (err) {
          // Keep going with OSM footprint if Google fails
          console.warn("Google Solar unavailable:", err);
        }
      }

      const osm = await osmPromise;
      if (ac.signal.aborted) return;

      if (gRoof) setGoogleRoof(gRoof);
      if (osm) setBuilding(osm);

      if (!gRoof && !osm) {
        throw new Error(
          "Could not resolve a roof at that address. Try a more precise street address."
        );
      }

      setAnalyzeStatus("done");
    } catch (err) {
      if (ac.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Satellite analysis failed.";
      setAnalyzeError(message);
      setAnalyzeStatus("error");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickCity(suggestions[highlight] ?? suggestions[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const chartData = result.monthly.map((m) => ({
    month: m.month,
    Production: Math.round(m.productionKwh),
    Usage: Math.round(m.usageKwh),
  }));

  const roofSourceLabel =
    result.roofSource === "google_solar"
      ? "Google Solar (aerial / satellite imagery)"
      : result.roofSource === "satellite_osm"
        ? "Satellite map + OSM building outline"
        : "Home-size heuristic (no address scan yet)";

  const usingSatellite = result.roofSource !== "heuristic";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-kicker">Interactive demo</span>
          <h1>Hometown Solar Savings</h1>
          <p>
            Enter a U.S. address to measure eligible roof area from satellite
            imagery and building outlines, then estimate solar production and
            bill savings for your hometown climate.
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

      <div className="layout">
        <aside className="panel controls">
          <h2 className="panel-title">Location & roof</h2>

          <div className="field">
            <label htmlFor="city">Hometown (rates & climate)</label>
            <div className="city-wrap">
              <input
                id="city"
                className="input"
                role="combobox"
                aria-expanded={open}
                aria-controls="city-list"
                aria-autocomplete="list"
                value={query}
                placeholder="Search city, e.g. Austin or Buffalo"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setHighlight(0);
                }}
                onFocus={() => {
                  if (blurTimer.current) window.clearTimeout(blurTimer.current);
                  setOpen(true);
                }}
                onBlur={() => {
                  blurTimer.current = window.setTimeout(
                    () => setOpen(false),
                    150
                  );
                }}
                onKeyDown={onKeyDown}
              />
              {open && suggestions.length > 0 && (
                <ul className="suggestions" id="city-list" role="listbox">
                  {suggestions.map((c, i) => (
                    <li key={`${c.name}-${c.state}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickCity(c)}
                      >
                        {cityLabel(c)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="address">Street address</label>
            <input
              id="address"
              className="input"
              value={address}
              placeholder="123 Main St"
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void analyzeRoof();
              }}
            />
            <span className="hint">
              Geocoded, then roof outline measured on satellite basemap.
            </span>
          </div>

          <div className="field">
            <button
              type="button"
              className="btn-primary"
              disabled={analyzeStatus === "loading" || !address.trim()}
              onClick={() => void analyzeRoof()}
            >
              {analyzeStatus === "loading"
                ? "Scanning satellite…"
                : "Analyze roof from satellite"}
            </button>
            {usingSatellite && (
              <button
                type="button"
                className="btn-ghost"
                onClick={clearSatellite}
              >
                Clear satellite roof · use home-size estimate
              </button>
            )}
            {analyzeError && <p className="error-text">{analyzeError}</p>}
            {analyzeStatus === "done" && !analyzeError && (
              <p className="ok-text">
                Roof locked from {roofSourceLabel.toLowerCase()}.
              </p>
            )}
          </div>

          <details
            className="advanced"
            open={showKey}
            onToggle={(e) => setShowKey((e.target as HTMLDetailsElement).open)}
          >
            <summary>Optional: Google Solar API (imagery ML)</summary>
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              With a{" "}
              <a
                href="https://developers.google.com/maps/documentation/solar/get-api-key"
                target="_blank"
                rel="noreferrer"
              >
                Maps Platform key
              </a>{" "}
              that has the Solar API enabled, eligible panel area comes from
              Google’s aerial/satellite building model. Key stays in this browser
              only.
            </p>
            <input
              className="input"
              type="password"
              autoComplete="off"
              placeholder="Google API key"
              value={googleKey}
              onChange={(e) => {
                setGoogleKey(e.target.value);
                saveGoogleApiKey(e.target.value);
              }}
            />
          </details>

          <hr className="divider" />

          <h2 className="panel-title">System assumptions</h2>

          {!usingSatellite && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="floor">Floor area (sq ft)</label>
                <input
                  id="floor"
                  className="input"
                  type="number"
                  min={400}
                  max={12000}
                  step={50}
                  value={floorArea}
                  onChange={(e) => setFloorArea(Number(e.target.value) || 0)}
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
            <div className="field">
              <label htmlFor="pitch">Roof pitch</label>
              <select
                id="pitch"
                className="select"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
              >
                <option value={1.0}>Flat / low (1.0×)</option>
                <option value={1.15}>Moderate (1.15×)</option>
                <option value={1.3}>Steep (1.3×)</option>
              </select>
              <span className="hint">
                {usingSatellite
                  ? "Applied to satellite footprint to estimate roof surface."
                  : "Pitch multiplies footprint to estimate roof surface area."}
              </span>
            </div>
          )}

          {result.roofSource !== "google_solar" && (
            <div className="field">
              <label>Tree / shading</label>
              <div className="segmented" role="group" aria-label="Shading level">
                {(
                  [
                    ["minimal", "Minimal"],
                    ["moderate", "Moderate"],
                    ["heavy", "Heavy"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={shading === key ? "active" : ""}
                    onClick={() => setShading(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <div className="slider-row">
              <label htmlFor="portion">Solar coverage of eligible roof</label>
              <span className="slider-value">{Math.round(portion * 100)}%</span>
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
              <label htmlFor="kwh">Monthly usage (kWh)</label>
              <input
                id="kwh"
                className="input"
                type="number"
                min={100}
                max={5000}
                step={50}
                value={monthlyKwh}
                onChange={(e) => setMonthlyKwh(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="rate">Rate ($/kWh)</label>
              <input
                id="rate"
                className="input"
                type="number"
                min={0.05}
                max={1}
                step={0.01}
                placeholder={city.ratePerKwh.toFixed(2)}
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
              />
              <span className="hint">Blank = city default</span>
            </div>
          </div>
        </aside>

        <main className="results">
          <section className="hero-cards" aria-label="Key results">
            <article className="stat-card solar">
              <div className="label">System size</div>
              <div className="value">{result.systemSizeKw.toFixed(1)} kW</div>
              <div className="sub">
                {formatSqFt(result.panelAreaSqFt)} sq ft of panels
              </div>
            </article>
            <article className="stat-card sky">
              <div className="label">Annual production</div>
              <div className="value">
                {formatKwh(result.annualProductionKwh)} kWh
              </div>
              <div className="sub">
                {result.peakSunHours.toFixed(1)} peak sun hrs/day avg
              </div>
            </article>
            <article className="stat-card">
              <div className="label">Usage offset</div>
              <div className="value">{result.offsetPct.toFixed(0)}%</div>
              <div className="sub">
                {formatKwh(result.offsetKwh)} of{" "}
                {formatKwh(result.annualUsageKwh)} kWh
              </div>
            </article>
            <article className="stat-card money">
              <div className="label">Est. annual savings</div>
              <div className="value">{formatUsd(result.annualSavingsUsd)}</div>
              <div className="sub">
                @ {result.ratePerKwh.toFixed(2)}/kWh · simple bill offset
              </div>
            </article>
          </section>

          <section className="panel card">
            <h2>Satellite roof scan</h2>
            {geoPoint ? (
              <>
                <SatelliteMap
                  center={googleRoof?.center ?? building?.center ?? geoPoint}
                  building={building}
                />
                {geoLabel && <p className="geo-label">{geoLabel}</p>}
              </>
            ) : (
              <div className="sat-placeholder">
                Enter a street address and click{" "}
                <strong>Analyze roof from satellite</strong> to load imagery and
                measure the building outline.
              </div>
            )}

            <div className="meta-grid" style={{ marginTop: "1rem" }}>
              <div className="meta-item">
                <div className="k">Roof data source</div>
                <div className="v">{roofSourceLabel}</div>
              </div>
              <div className="meta-item">
                <div className="k">Footprint / whole roof</div>
                <div className="v">
                  {formatSqFt(result.roofFootprintSqFt)} ft²
                  {googleRoof?.imageryDate
                    ? ` · imagery ${googleRoof.imageryDate}`
                    : ""}
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Eligible for panels</div>
                <div className="v">
                  {formatSqFt(result.eligibleRoofSqFt)} ft² · then{" "}
                  {Math.round(portion * 100)}% covered
                  {googleRoof?.maxArrayPanelsCount
                    ? ` · up to ~${googleRoof.maxArrayPanelsCount} panels (Google max)`
                    : ""}
                </div>
              </div>
            </div>
          </section>

          <section className="panel card">
            <h2>Local weather</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <div className="k">Climate snapshot</div>
                <div className="v">
                  {result.avgTempF.toFixed(0)}°F avg · {result.cloudCoverPct}%
                  clouds · {result.peakSunHours.toFixed(1)} PSH
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Surface after pitch</div>
                <div className="v">
                  {formatSqFt(result.totalRoofAreaSqFt)} ft²
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Hometown rates</div>
                <div className="v">
                  {cityLabel(city)} · {result.ratePerKwh.toFixed(2)}/kWh
                </div>
              </div>
            </div>
          </section>

          <section className="panel card">
            <h2>Monthly production vs. usage</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#243049" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7c9c"
                    tick={{ fill: "#93a4c3", fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#6b7c9c"
                    tick={{ fill: "#93a4c3", fontSize: 12 }}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#121a2b",
                      border: "1px solid #334563",
                      borderRadius: 10,
                    }}
                    labelStyle={{ color: "#e8eef9" }}
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
            <h2>Annual electricity bill (simple model)</h2>
            <div className="bill-compare">
              <div className="bill-box">
                <div className="tag">Before solar</div>
                <div className="amt">{formatUsd(result.billBeforeUsd)}</div>
              </div>
              <div className="bill-arrow">→</div>
              <div className="bill-box after">
                <div className="tag">After solar offset</div>
                <div className="amt">{formatUsd(result.billAfterUsd)}</div>
              </div>
            </div>
            <div className="breakdown" style={{ marginTop: "1rem" }}>
              <div>
                <div className="breakdown-item">
                  <span>Self-consumed solar</span>
                  <span>{formatKwh(result.offsetKwh)} kWh</span>
                </div>
                <div className="breakdown-item">
                  <span>Remaining grid purchase</span>
                  <span>
                    {formatKwh(
                      Math.max(0, result.annualUsageKwh - result.offsetKwh)
                    )}{" "}
                    kWh
                  </span>
                </div>
              </div>
              <div>
                <div className="breakdown-item">
                  <span>Excess production (not credited here)</span>
                  <span>
                    {formatKwh(
                      Math.max(
                        0,
                        result.annualProductionKwh - result.offsetKwh
                      )
                    )}{" "}
                    kWh
                  </span>
                </div>
                <div className="breakdown-item">
                  <span>Net metering / incentives</span>
                  <span>not modeled</span>
                </div>
              </div>
            </div>
          </section>

          <p className="disclaimer">
            Educational demo only. Default roof scan uses Esri satellite
            basemap plus OpenStreetMap building footprints (often traced from
            imagery). Optional Google Solar API uses Google’s aerial/satellite
            model for panelable area and sunshine. Not an installer quote —
            real roofs depend on pitch, obstructions, setbacks, and utility
            rules. Map data © OpenStreetMap contributors; imagery © Esri.
          </p>
        </main>
      </div>

      <footer className="footer">
        Built by{" "}
        <a href="https://aidenterry02.github.io/portfolio_webstite/">
          Aiden Terry
        </a>{" "}
        · source on{" "}
        <a href="https://github.com/aidenterry02/SolarPowerSimulation">
          GitHub
        </a>
      </footer>
    </div>
  );
}
