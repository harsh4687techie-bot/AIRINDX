<<<<<<< HEAD
# AIRINDX — Environmental Intelligence Platform

AIRINDX is an offline-first environmental intelligence web application providing explainable air quality index (AQI) analysis, geospatial station exploration, pollutant speciation, historical trend analytics, meteorological dispersion insights, multi-city benchmarking, and grounded environmental Q&A.

## Features (Seven Integrated Pages)

1. **Live Dashboard (`#/`):** Calibrated AQI radial gauge, dominant pollutant card, WHO 2021 guideline comparisons, 6 meteorological KPIs, interactive historical trend chart, nearby station table with CSV export, and interactive Three.js 3D Earth observatory.
2. **Explore Map (`#/explore-map`):** Interactive Three.js 3D Earth + 2D geospatial plume projection toggle, Country/State/City cascading filters, severity filters, map layers, AQI legend, station inspection drawer, CSV export, and opt-in **Atmospheric Column Layer** (honest Sentinel-5P L2 status + optional keyless Copernicus CAMS 550 nm AOD via Open-Meteo).
3. **Pollutants (`#/pollutants`):** Full 8-parameter CPCB coverage (`PM2.5`, `PM10`, `NO2`, `SO2`, `CO`, `O3`, `NH3`, `Pb`), individual pollutant detail panel with 24h trend chart, emission sources, health impact explanations, and interactive abatement simulator.
4. **Historical Analysis (`#/history`):** Functional `24H`, `7D`, `30D`, `90D`, and `365D` views, custom date range selection, metric filters, curve-aligned hover scrubber, 24h diurnal cycle matrix, anomaly detection, and CSV export.
5. **Weather (`#/weather`):** Temperature, humidity, wind speed & compass rose, barometric pressure, UV index, boundary layer height (PBLH), ventilation coefficient, PM2.5–mixing height correlation, and clearly labeled simulated rain washout / scenario outlook.
6. **AI Assistant (`#/ai-assistant`):** Deterministic, data-grounded environmental Q&A using the active station's dataset (works offline with zero API keys), structured into Observed Conditions, Interpretation, Recommendations, and Data Limitations with non-medical disclaimer and prompt-injection defense.
7. **City Comparison (`#/comparison`):** Dynamic multi-city add/remove benchmarking across Indian/Maharashtra and international cities under a unified AQI standard, timeframe switcher, particulate comparison bars, best/worst cards, transparent ranking table, and CSV export.

## Technology Stack

- **Frontend:** Vite 6 + Vanilla JavaScript ES Modules + locally compiled Tailwind CSS v4 + bundled Three.js (`0.170.0`).
- **Quality, Security & Testing:** ESLint (`eslint` + `@eslint/js`), Vitest (`4.1.12`) + jsdom, Playwright (`playwright-core` using system Chrome), and `axe-core` WCAG 2.2 AA accessibility scanning.
- **Content Security Policy:** Strict `<meta http-equiv="Content-Security-Policy">` (`script-src 'self'`, `object-src 'none'`). Zero external CDN scripts, icon fonts, or LLM API keys.
- **Design System:** Preserves AIRINDX palette (`#123C32`, `#237A5B`, `#B9ED73`, `#F5F7F2`, `#FFFFFF`, `#10251F`) in `src/styles/tokens.css`.
- **Reference Prototypes:** Original Stitch exports remain untouched in `stitch_aqi_dashboard_design_system/`.

## Scientific Methodology

Implemented independently in `src/data/aqiStandards.js`:

- **India CPCB NAQI:** Supports all 8 pollutants (`PM2.5`, `PM10`, `NO2`, `SO2`, `CO`, `O3`, `NH3`, `Pb`), official averaging periods, linear interpolation breakpoints, 6 official categories, and the data sufficiency rule (minimum 3 valid pollutants with at least one of `PM2.5` or `PM10`). Missing readings are never substituted with `0`.
- **US EPA AQI (EPA-454/B-24-002, May 2024):** Supports 6 criteria pollutants (`PM2.5`, `PM10`, `O3`, `CO`, `SO2`, `NO2`) with EPA truncation rules, May 2024 `PM2.5` breakpoints, and explicit high-concentration 1-hr O₃ / 24-hr SO₂ notices.
- **WHO 2021 Guidelines:** Referenced strictly as health-based concentration benchmarks, never as an AQI scale.
- **Atmospheric Column Separation (`src/services/satelliteLayer.js`):** Modelled total-column 550 nm Aerosol Optical Depth (AOD) is never converted into or conflated with ground-level CPCB NAQI / US EPA AQI values.

## Data-Source & Simulation Disclosures

- **Ground Station & Weather Telemetry:** All default station readings, weather metrics, historical series, and assistant responses in offline demonstration mode use deterministic `dataType: "simulated"` records in `src/data/mock/` calibrated to CPCB/OpenAQ schemas.
- **Satellite / Atmospheric Column Status:**
  - Direct Copernicus **Sentinel-5P / TROPOMI Level-2** NO₂ column spectra are marked **`UNAVAILABLE`** in serverless browser mode because direct L2 NetCDF/HDF5 swaths require Copernicus Data Space Ecosystem (CDSE) OAuth2 credentials and server-side processing.
  - Users online may optionally trigger an explicit fetch for live **Copernicus Atmosphere Monitoring Service (CAMS)** modelled 550 nm AOD (~40 km global grid) via the keyless Open-Meteo Air Quality endpoint (`https://air-quality-api.open-meteo.com/v1/air-quality`, CC BY 4.0). Zero external requests occur unless clicked.
- **Non-Medical Disclaimer:** Health guidance is general environmental information only and not personal medical advice.
- Future FastAPI integration is documented in [docs/FASTAPI_CONTRACT.md](docs/FASTAPI_CONTRACT.md).

## Windows PowerShell Setup & Run Instructions

```powershell
# 1. Install dependencies
npm install

# 2. Run ESLint static analysis
npm run lint

# 3. Run all unit & integration tests
npm test

# 4. Create production build
npm run build

# 5. Run Playwright + axe-core WCAG 2.2 AA & 5-viewport E2E verification against production preview
npm run test:e2e

# 6. Start local development or preview server
npm run dev
npm run preview
```

## Demonstration Walkthrough (2-Minute Flow)

1. Open `#/` (**Live Dashboard**): switch stations in Mumbai (e.g., BKC vs. Colaba Coastal vs. Chembur) and toggle the top bar AQI standard between `CPCB NAQI` and `US EPA` to observe methodology-specific recalculation.
2. Open `#/explore-map`: filter by state (`Maharashtra`) or severity, inspect the **Atmospheric Column Layer** card (explicit Sentinel-5P L2 unavailability + optional keyless CAMS 550 nm AOD fetch), toggle `3D Globe` / 2D projection, and export filtered stations to CSV.
3. Open `#/pollutants`: inspect all 8 CPCB pollutants, switch standard to `US EPA` to see `NH3`/`Pb` cleanly marked unsupported, and test the emission reduction simulator.
4. Open `#/history` and `#/weather`: explore `24H`–`365D` historical trends, hover scrubber, wind–PBLH correlation, and simulated rain washout estimator.
5. Open `#/ai-assistant` and `#/comparison`: ask grounded questions (works offline with zero API keys) and benchmark multiple cities side-by-side.

## Known Limitations & Submission Packaging Notes

- Ground station, historical, and AI LLM inference endpoints from a live FastAPI backend are not attached in this offline-first submission (`dataType: "simulated"`).
- Direct Sentinel-5P TROPOMI Level-2 spectral column retrieval requires backend CDSE authentication and NetCDF parsing.
- Original untouched Stitch prototypes remain locally in `stitch_aqi_dashboard_design_system/` (`~7.50 MB`). When creating a lightweight public GitHub submission repository, exclude `stitch_aqi_dashboard_design_system/`, `node_modules/`, and `dist/` via `.gitignore` so the tracked repository remains ~0.6 MB (well below 10 MB).
=======

