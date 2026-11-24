# AIRINDX FastAPI Integration Contract

This document defines the HTTP+JSON integration contract between the AIRINDX frontend (`src/services/apiClient.js`) and the separately developed Python FastAPI backend.

## 1. Base URL & Environment Configuration

- Development base URL: `http://localhost:8000`
- Configured via `VITE_API_BASE_URL` and `VITE_API_TIMEOUT_MS` in `.env.local` (see `.env.example`).
- Toggleable provider mode via `VITE_USE_MOCK_DATA` (`true` uses `src/services/mockProvider.js`, `false` dispatches requests to FastAPI).
- **No API keys or Gemini credentials are permitted in frontend code or `VITE_*` variables.**

---

## 2. Required Endpoints & Frontend Client Mapping

| Frontend Client Method | HTTP Method & Path | Query / Body Parameters | Purpose |
|---|---|---|---|
| `getCurrentAQI(params)` | `GET /api/v1/aqi/current` | `stationId` | Current AQI, category, dominant pollutant, timestamp, source |
| `getLocationAQI(params)` | `GET /api/v1/aqi/location` | `city`, `state`, `country`, `lat`, `lon` | Location-resolved AQI telemetry |
| `getPollutants(params)` | `GET /api/v1/pollutants` | `stationId` | Concentrations & units for PM2.5, PM10, CO, SO2, NO2, O3 |
| `getHistoricalAQI(params)` | `GET /api/v1/history` | `stationId`, `range` (`24h`\|`7d`\|`30d`\|`90d`\|`365d`), `startDate`, `endDate`, `metric` | Historical time series with averaging period & units |
| `getWeather(params)` | `GET /api/v1/weather` | `stationId` / `city` | Meteorological telemetry (temp, humidity, wind, pressure, conditions) |
| `getMonitoringStations(params)` | `GET /api/v1/stations` | `severity`, `query`, `country`, `state`, `city` | Station directory and live status |
| `compareCities(params)` | `GET /api/v1/compare` | `cities` (comma-separated), `timeframe` | Multi-city comparison matrix and ranking metadata |
| `sendAIMessage(payload)` | `POST /api/v1/assistant/chat` | `{ query, stationId, history }` | Grounded environmental reasoning via server-side Gemini |

---

## 3. Standard Response Envelope & Provenance Fields

Every environmental payload must include provenance metadata so the UI can distinguish live telemetry from historical records, estimates, or demonstration data:

```json
{
  "status": "ok",
  "dataType": "live | historical | demonstration | estimate | forecast",
  "source": "CPCB / OpenAQ / Open-Meteo",
  "standard": "CPCB_NAQI | US_EPA",
  "stationId": "IND-MH-BKC-04",
  "timestamp": "2026-11-25T01:00:00+05:30"
}
```

### Example: `GET /api/v1/aqi/current?stationId=IND-MH-BKC-04`

```json
{
  "status": "ok",
  "dataType": "live",
  "station": {
    "id": "IND-MH-BKC-04",
    "name": "Bandra Kurla Complex (BKC)",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "lat": 19.0657,
    "lon": 72.8687,
    "aqi": 168,
    "standard": "CPCB_NAQI",
    "category": "Moderate",
    "dominantPollutant": "PM2.5",
    "source": "CPCB",
    "timestamp": "2026-11-25T01:00:00+05:30"
  }
}
```

### Example: `POST /api/v1/assistant/chat`

Request:
```json
{
  "query": "Is it safe to jog outdoors right now?",
  "stationId": "IND-MH-BKC-04",
  "history": []
}
```

Response:
```json
{
  "status": "ok",
  "dataType": "live",
  "stationId": "IND-MH-BKC-04",
  "timestamp": "2026-11-25T01:00:00+05:30",
  "groundedContext": {
    "city": "Mumbai",
    "aqi": 168,
    "standard": "CPCB_NAQI",
    "dominantPollutant": "PM2.5"
  },
  "sections": {
    "observedConditions": "...",
    "interpretation": "...",
    "recommendations": "...",
    "dataLimitations": "..."
  }
}
```

---

## 4. Error Response Format

FastAPI must return structured JSON errors without stack traces:

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR | UPSTREAM_UNAVAILABLE | RATE_LIMITED | TIMEOUT",
  "message": "Human-readable safe error message."
}
```

## 5. Backend Security & Grounding Requirements

1. **Secrets**: Store `GEMINI_API_KEY` and external data provider keys exclusively in backend environment variables.
2. **CORS**: Restrict `CORSMiddleware` `allow_origins` to explicit frontend origins (e.g., `http://localhost:5173`).
3. **Validation**: Validate all query parameters and request bodies with Pydantic models (`max_length` bounds on AI queries).
4. **Rate Limiting & Timeouts**: Enforce upstream HTTP timeouts and per-IP rate limiting on `/api/v1/assistant/chat`.
5. **Prompt Injection Defense**: Wrap retrieved station/web data in strict data delimiters in the system prompt; never allow retrieved text to override instructions or invoke arbitrary tools.
