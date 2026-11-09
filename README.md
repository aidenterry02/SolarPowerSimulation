# Hometown Solar Savings

Interactive web demo: enter a U.S. address, measure eligible roof area from satellite imagery + building outlines, apply local climate/rates, and estimate production, bill savings, ITC-adjusted cost, and payback.

**Live demo:** [https://aidenterry02.github.io/SolarPowerSimulation/](https://aidenterry02.github.io/SolarPowerSimulation/)

**Portfolio:** [https://aidenterry02.github.io/portfolio_webstite/](https://aidenterry02.github.io/portfolio_webstite/) · solar shortcut: [/portfolio_webstite/solar](https://aidenterry02.github.io/portfolio_webstite/solar)

## Architecture

```
Address autocomplete (Nominatim)
        │
        ▼
Interactive Esri satellite map (Leaflet)
        │
        ├─► OSM Overpass building candidates (scored)
        ├─► MS/Esri structures fallback
        └─► Optional Google Solar (panelable area + segments)
        │
        ▼
Climate from lat/lon (nearest city blend)
        │
        ▼
solarCalc → economics (ITC, net metering, 25y cashflow)
        │
        ├─► Optional NREL PVWatts production override
        └─► Share URL + summary card
```

Optional Cloudflare Worker proxy: see [`worker/`](./worker/).

## Wizard flow

1. **Address** — autocomplete, analyze roof  
2. **Roof** — map pin, multi-building picker, confidence meter  
3. **System** — coverage, usage, $/W, ITC, net metering  
4. **Results** — charts, payback, share link  

## Run locally

```bash
npm install
npm run dev
npm test
```

## Deploy (GitHub Pages)

```bash
npm run deploy
```

Base path: `/SolarPowerSimulation/`.

## Optional API keys (browser localStorage)

| Key | Purpose |
| --- | --- |
| Google Solar | Imagery-ML eligible area, segments, sunshine hours |
| NREL PVWatts | Site-specific AC production override |

## Model notes

| Piece | Approach |
| --- | --- |
| Roof | Satellite footprint / Google eligible / heuristic fallback |
| Climate | Nearest catalog city + lat blend |
| kWh | kW × PSH × 365 × PR (or PVWatts) |
| $ | Self-use + NM export credit; ITC on install; 25y degradation/inflation |

Legacy city-scale Python: `SolarPowerSim.py`.

## License

See [LICENSE](./LICENSE).
