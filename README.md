# Hometown Solar Savings

Interactive web demo: pick a U.S. hometown, estimate eligible roof coverage, apply local average weather/sun, and see how much electricity and money solar could offset for a portion of your roof.

**Live demo:** [https://aidenterry02.github.io/SolarPowerSimulation/](https://aidenterry02.github.io/SolarPowerSimulation/)

**Portfolio:** [https://aidenterry02.github.io/portfolio_webstite/](https://aidenterry02.github.io/portfolio_webstite/)

## What it does

1. **Hometown picker** — search ~100 U.S. cities with lat/lon, peak sun hours, cloud cover, temperature, and default $/kWh.
2. **Roof eligibility** — from floor area, stories, pitch, and shading → footprint → surface area → usable area after setbacks/orientation/shade.
3. **Coverage slider** — install panels on a portion of eligible roof.
4. **Production & savings** — annual and monthly kWh, % of usage offset, simple before/after bill estimate.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/SolarPowerSimulation/`).

## Build & deploy (GitHub Pages)

```bash
npm install
npm run build
npm run deploy
```

`deploy` pushes the `dist/` folder to the `gh-pages` branch. In the GitHub repo settings, set Pages source to **Deploy from a branch** → `gh-pages` / root (or use the included GitHub Action).

Site base path is `/SolarPowerSimulation/` (see `vite.config.ts`).

## Model notes (transparent)

| Piece | Approach |
| --- | --- |
| Roof footprint | floor area ÷ stories |
| Roof surface | footprint × pitch factor |
| Eligible area | surface × setbacks (0.7) × orientation (0.9) × shading |
| System size | panel sq ft × 18 W/ft² |
| Annual kWh | kW × peak sun hours × 365 × 0.85 PR |
| Monthly shape | latitude-scaled seasonal curve |
| $ savings | min(production, usage) × rate (no net metering credit) |

Legacy city-scale Python script: `SolarPowerSim.py` (SF / Chicago / Dallas stock model).

## License

See [LICENSE](./LICENSE).
