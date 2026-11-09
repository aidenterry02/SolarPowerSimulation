# Plan: Make Hometown Solar Savings Better

**Live:** https://aidenterry02.github.io/SolarPowerSimulation/  
**Repo:** https://github.com/aidenterry02/SolarPowerSimulation  
**Date:** 2026-11-09  
**Goal:** Turn a solid portfolio demo into a memorable, trustworthy, shareable product people actually play with.

---

## Current state (honest baseline)

| Strength | Gap |
| --- | --- |
| Clear hometown + savings story | City climate is a static CSV, not real weather APIs |
| Satellite map + OSM footprint | OSM misses many homes; nearest-building can pick the wrong structure |
| Optional Google Solar | Key UX is buried; no guided setup; most visitors never use it |
| Instant client-side calc | No net metering, incentives, or payback |
| Single-page demo | UX is dense; city + address + assumptions compete for attention |
| GH Pages hosting | CORS / rate limits on Nominatim & Overpass can flake in prod |
| Portfolio link exists | Demo isn’t nested on the portfolio domain; weak “wow” share moment |

**North star experience**

> Type your address → see *your* roof on satellite → watch eligible area and $ savings update → leave with a shareable “my roof could save ~$X/yr” card.

---

## Product principles

1. Address-first, not city-first (climate follows the pin).
2. Satellite result is the hero; heuristics are fallback only.
3. Numbers are transparent and labeled as estimates.
4. Works great with zero API keys; unlocks “pro” mode with Google Solar.
5. Shareable in under 10 seconds (URL or image card).

---

## Recommended phases

### Phase 0 — Reliability & trust (1–2 days)
**Why first:** Flaky geocode/building lookup kills the demo.

| ID | Work | Acceptance |
| --- | --- | --- |
| P0.1 | Address autocomplete (Nominatim or Mapbox/Google if key) with debounce + US bias | User picks a suggestion; no free-text-only dead ends |
| P0.2 | Building match quality: score by distance + area; warn if ambiguous; allow “pick another building” | Wrong-building rate drops; user can recover |
| P0.3 | Retry / alternate Overpass endpoints; loading skeleton; clear error copy | Transient API failures don’t feel broken |
| P0.4 | Cache last successful scan in `sessionStorage` | Refresh doesn’t wipe a good result |
| P0.5 | Unit tests for `solarCalc` + polygon area | Math regressions caught in CI |

### Phase 1 — Satellite as the product (2–4 days)
**Why:** This is the differentiator you already started.

| ID | Work | Acceptance |
| --- | --- | --- |
| P1.1 | Interactive map (Leaflet/MapLibre): pan, zoom, click-to-set pin | User can fix a bad geocode visually |
| P1.2 | Draw / edit building polygon if OSM missing | Rural or unmapped homes still work |
| P1.3 | Google Solar as first-class path: setup checklist, status badge, sample key docs | Non-dev can enable it; demo shows “Google Solar active” |
| P1.4 | Use Google Solar `dataLayers` RGB + mask when key present | Imagery and panelable mask feel premium |
| P1.5 | Auto-derive climate from lat/lon (nearest city or NASA POWER / NREL) | Drop separate “hometown” as required step |
| P1.6 | Roof segment breakdown when Google returns segments (pitch/azimuth) | Eligible area explained by face, not one blob |

### Phase 2 — Economics people care about (2–3 days)
**Why:** kWh is engineering; $ and years-to-payback are the story.

| ID | Work | Acceptance |
| --- | --- | --- |
| P2.1 | Install cost model ($/W, optional battery) + simple payback years | Payback number appears beside annual savings |
| P2.2 | Federal ITC toggle (e.g. 30%) + optional state credit placeholder | Savings/cost reflects incentive switch |
| P2.3 | Net metering modes: none / 1:1 / avoided-cost fraction | Excess kWh isn’t silently zeroed without explanation |
| P2.4 | EIA-ish rate by state from lat/lon; show source | Rate feels local without manual entry |
| P2.5 | 25-year cashflow chart (degradation 0.5%/yr, rate inflation) | Portfolio-quality “lifetime value” visual |

### Phase 3 — UX polish & shareability (1–2 days)
**Why:** Demo traffic comes from shares and portfolio visits.

| ID | Work | Acceptance |
| --- | --- | --- |
| P3.1 | Guided flow: Address → Roof confirm → Usage → Results | First-time user finishes without reading a wall of controls |
| P3.2 | Share URL with encoded params (`?lat=&lon=&portion=&kwh=`) | Link recreates the scenario |
| P3.3 | “Share card” PNG/SVG summary (city, kW, $/yr, offset %) | One image for LinkedIn / portfolio |
| P3.4 | Mobile layout pass; sticky results on desktop | Usable on phone |
| P3.5 | Embed on portfolio as `/solar` route or iframe section | One brand domain path optional |
| P3.6 | Empty/error/success microcopy + confidence meter (data quality) | User knows estimate quality |

### Phase 4 — Data quality upgrades (2–5 days, optional)
**Why:** Accuracy ceiling without leaving static hosting.

| ID | Work | Acceptance |
| --- | --- | --- |
| P4.1 | NREL PVWatts API (or precomputed TMY) for production | Production within ~15% of PVWatts for test addresses |
| P4.2 | Expand city/rate dataset or replace with continuous surfaces | Coverage beyond ~100 cities |
| P4.3 | Microsoft US Building Footprints fallback when OSM empty | Higher hit rate in US suburbs |
| P4.4 | Tree canopy / shade proxy (if free layer available) | Shading not only a manual toggle |
| P4.5 | Tiny serverless proxy (Cloudflare Worker) for keys + rate limits | Hide API keys; stabilize Nominatim/Overpass |

### Phase 5 — Portfolio storytelling (0.5–1 day)
**Why:** You’re the audience’s reason to click.

| ID | Work | Acceptance |
| --- | --- | --- |
| P5.1 | Case study blurb: problem → satellite approach → stack → live link | Portfolio entry sells the demo |
| P5.2 | Before/after: heuristic vs satellite on same address | Shows why satellite mattered |
| P5.3 | README architecture diagram + model assumptions | Recruiters/engineers understand depth |

---

## Architecture direction

```
┌─────────────────────────────────────────────────────────┐
│  UI (wizard + map + results + share card)               │
├──────────────┬──────────────────┬───────────────────────┤
│ Geocode      │ Roof geometry    │ Resource & $ model    │
│ Nominatim /  │ OSM Overpass →   │ solarCalc             │
│ Google       │ MS footprints →  │ + PVWatts (opt)       │
│              │ Google Solar     │ + incentives          │
├──────────────┴──────────────────┴───────────────────────┤
│  Optional Worker: API keys, caching, CORS hardening     │
│  Host: GitHub Pages (static) ± Worker                   │
└─────────────────────────────────────────────────────────┘
```

Keep **calculation pure and testable** in `src/lib/*`. Keep **App thin**. Split today’s 700-line `App.tsx` into `AddressPanel`, `RoofMap`, `Assumptions`, `Results`, `ShareCard`.

---

## Priority stack (what to build if time is limited)

### Must (ship next)
1. Interactive map + better building pick (P1.1, P0.2)
2. Address autocomplete (P0.1)
3. Payback + install cost (P2.1)
4. Share URL (P3.2)
5. Split UI + calc tests (P0.5, refactor)

### Should
6. Google Solar first-class + segments (P1.3–P1.4, P1.6)
7. Climate from coordinates (P1.5)
8. Net metering modes (P2.3)
9. Share card image (P3.3)
10. Wizard flow (P3.1)

### Could
11. PVWatts (P4.1)
12. Worker proxy (P4.5)
13. Portfolio nested route (P3.5)
14. Lifetime cashflow (P2.5)

### Won’t (for now)
- Real-time installer quotes / lead gen
- Full 3D roof mesh editing
- Non-US expansion
- Auth / saved accounts

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Nominatim/Overpass rate limits & CORS | Debounce, cache, alternate endpoints, optional Worker |
| Google Solar cost / key abuse | User-owned key in localStorage; later Worker with your key + quotas |
| Wrong building selected | Distance+area scoring, multi-candidate picker, manual polygon |
| Overclaiming accuracy | Confidence badge + disclaimer always visible |
| Scope creep | Ship Must stack before Should |

---

## Success metrics (demo quality, not growth)

- Time-to-first-result (address → numbers) &lt; 15s on broadband
- Building-found rate on 20 test US addresses ≥ 80% (OSM) / ≥ 95% (Google Solar)
- Share URL round-trips preserve scenario 100%
- Lighthouse mobile performance ≥ 85 (map weight controlled)
- Zero unexplained NaN/Infinity in results for valid inputs

---

## Suggested build order (vertical slices)

```
Slice A  Address autocomplete + map pin + OSM footprint (fix P0/P1 core)
    → User can fix location and see outline

Slice B  Confidence UI + multi-building picker + cache
    → User trusts / recovers from bad matches

Slice C  Cost + payback + net metering toggles
    → Results answer “is it worth it?”

Slice D  Share URL + share card
    → Demo is portable

Slice E  Google Solar pro mode (segments, sunshine, badge)
    → Premium accuracy path

Slice F  PVWatts / Worker / portfolio embed
    → Production-grade polish
```

---

## Open decisions (need your call before coding)

1. **Google Solar:** Will you provide a project API key (referrer-restricted), or keep BYO-key only?
2. **Hosting:** Stay pure static GH Pages, or OK to add a free Cloudflare Worker?
3. **Depth vs flash:** Prefer engineering accuracy (PVWatts, segments) or viral share card first?
4. **Portfolio:** Keep separate `/SolarPowerSimulation/` URL, or nest under portfolio site?

Default recommendation if no answer: BYO-key + static hosting; ship **Slice A → C → D** next; Google Solar polish after.

---

## Out of scope for “better demo” vNext

Rewriting the legacy city-scale Python script, mobile native apps, multi-language, utility interconnection paperwork.
