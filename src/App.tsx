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
import { CITIES, cityLabel, searchCities, type City } from "./data/cities";
import {
  calculateSolar,
  formatKwh,
  formatSqFt,
  formatUsd,
  type ShadingLevel,
} from "./lib/solarCalc";

const DEFAULT_CITY =
  CITIES.find((c) => c.name === "Buffalo" && c.state === "NY") ?? CITIES[0];

export default function App() {
  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [query, setQuery] = useState(cityLabel(DEFAULT_CITY));
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<number | null>(null);

  const [floorArea, setFloorArea] = useState(1800);
  const [stories, setStories] = useState(2);
  const [pitch, setPitch] = useState(1.15);
  const [shading, setShading] = useState<ShadingLevel>("moderate");
  const [portion, setPortion] = useState(0.6);
  const [monthlyKwh, setMonthlyKwh] = useState(900);
  const [rateOverride, setRateOverride] = useState<string>("");

  const suggestions = useMemo(() => searchCities(query, 10), [query]);

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
  ]);

  function pickCity(c: City) {
    setCity(c);
    setQuery(cityLabel(c));
    setOpen(false);
    if (rateOverride.trim() === "") {
      // keep empty so city default applies
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-kicker">Interactive demo</span>
          <h1>Hometown Solar Savings</h1>
          <p>
            Pick a U.S. city, estimate eligible roof coverage from your home
            size, and see how much power and money solar could offset using
            local average sun and electricity rates.
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
          <h2 className="panel-title">Your home</h2>

          <div className="field">
            <label htmlFor="city">Hometown</label>
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
                  blurTimer.current = window.setTimeout(() => setOpen(false), 150);
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
            <span className="hint">
              {city.lat.toFixed(2)}°N, {Math.abs(city.lon).toFixed(2)}°W ·{" "}
              {CITIES.length} U.S. cities
            </span>
          </div>

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
              Pitch multiplies footprint to estimate roof surface area.
            </span>
          </div>

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
            <span className="hint">
              Only a portion of the usable roof is covered with panels.
            </span>
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
            <h2>Local weather & roof eligibility</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <div className="k">Climate snapshot</div>
                <div className="v">
                  {result.avgTempF.toFixed(0)}°F avg · {result.cloudCoverPct}%
                  clouds · {result.peakSunHours.toFixed(1)} PSH
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Roof path</div>
                <div className="v">
                  {formatSqFt(result.roofFootprintSqFt)} ft² footprint →{" "}
                  {formatSqFt(result.totalRoofAreaSqFt)} ft² surface
                </div>
              </div>
              <div className="meta-item">
                <div className="k">Eligible after setbacks / shade</div>
                <div className="v">
                  {formatSqFt(result.eligibleRoofSqFt)} ft² · then{" "}
                  {Math.round(portion * 100)}% covered
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
            Educational demo only — not an installer quote. Roof eligibility uses
            simple setback, orientation, and shading factors. Sun resource and
            rates are approximate climate normals and state averages, not
            site-specific measurements. Real production depends on azimuth, tilt,
            inverter losses, utility tariffs, and local codes.
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
