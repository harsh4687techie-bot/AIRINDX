/**
 * AIRINDX Atmospheric Column & Satellite Data Layer
 *
 * Scientific & Security Boundaries:
 * 1. Original AIRINDX challenge ("ubrain air quality assistant") did NOT mandate a
 *    direct Sentinel-5P L2 NetCDF feed; Stitch prototypes added static TROPOMI labels.
 * 2. Direct Sentinel-5P L2 TROPOMI column spectra require Copernicus Data Space (CDSE)
 *    OAuth2 or NASA Earthdata credentials + server-side NetCDF subsetting, so this
 *    serverless frontend honestly marks direct Sentinel-5P L2 swath telemetry UNAVAILABLE.
 * 3. As an optional, zero-API-key, CORS-enabled live atmospheric column enhancement,
 *    users may explicitly request Copernicus Atmosphere Monitoring Service (CAMS)
 *    modelled Aerosol Optical Depth (550 nm) via Open-Meteo (CC BY 4.0).
 * 4. Atmospheric column AOD (unitless) is NEVER converted into or mixed with ground-level
 *    CPCB NAQI / US EPA AQI measurements.
 * 5. Zero unsolicited external network requests occur in default/offline demo mode.
 */

export const CAMS_AIR_QUALITY_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export function getSentinel5PL2Availability() {
  return Object.freeze({
    product: 'Copernicus Sentinel-5P / TROPOMI Level-2 Tropospheric NO₂',
    status: 'UNAVAILABLE',
    available: false,
    requiresBackend: true,
    reason:
      'Direct Sentinel-5P L2/L3 NetCDF column spectra require Copernicus Data Space Ecosystem (CDSE) OAuth2 tokens and server-side spatial subsetting; unavailable in serverless offline-first browser mode.',
    note: '3D Earth globe orbital marker in AIRINDX is a visual observatory guide, not live L2 TROPOMI telemetry.',
  });
}

export function classifyAodLevel(aod) {
  if (typeof aod !== 'number' || !Number.isFinite(aod) || aod < 0) {
    return { label: 'Unavailable', note: 'No valid optical depth reading.' };
  }
  if (aod < 0.15) {
    return { label: 'Clear Column (<0.15)', note: 'Low total-column aerosol extinction at 550 nm.' };
  }
  if (aod < 0.35) {
    return { label: 'Light Haze (0.15–0.34)', note: 'Moderate columnar aerosol optical thickness.' };
  }
  if (aod < 0.65) {
    return { label: 'Elevated Plume (0.35–0.64)', note: 'Noticeable total-column aerosol loading.' };
  }
  return { label: 'Heavy Column Loading (>=0.65)', note: 'Dense atmospheric aerosol column at 550 nm.' };
}

export async function fetchCopernicusCamsColumn(
  { lat, lon, fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 5000 } = {}
) {
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90 || !Number.isFinite(lonNum) || lonNum < -180 || lonNum > 180) {
    return {
      status: 'error',
      available: false,
      code: 'INVALID_COORDINATES',
      message: 'Valid WGS84 latitude (-90..90) and longitude (-180..180) are required.',
    };
  }

  const url = new URL(CAMS_AIR_QUALITY_ENDPOINT);
  url.searchParams.set('latitude', latNum.toFixed(4));
  url.searchParams.set('longitude', lonNum.toFixed(4));
  url.searchParams.set('current', 'aerosol_optical_depth,dust');
  url.searchParams.set('hourly', 'aerosol_optical_depth');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        status: 'unavailable',
        available: false,
        code: 'UPSTREAM_HTTP_ERROR',
        message: `Copernicus CAMS feed returned HTTP ${res.status}.`,
      };
    }

    const json = await res.json();
    const aod = json?.current?.aerosol_optical_depth;
    if (typeof aod !== 'number' || !Number.isFinite(aod)) {
      return {
        status: 'unavailable',
        available: false,
        code: 'MISSING_AOD_FIELD',
        message: 'Copernicus CAMS response did not contain valid 550 nm Aerosol Optical Depth.',
      };
    }

    const dustUg = json?.current?.dust;
    return {
      status: 'ok',
      available: true,
      dataType: 'modelled-satellite-assimilated',
      source: 'Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo (CC BY 4.0)',
      processingLevel: 'Satellite-Assimilated Atmospheric Composition Model (550 nm Column AOD)',
      spatialResolution: '~40 km × 40 km CAMS Global Grid',
      timestamp: `${json.current.time} ${json.timezone_abbreviation || 'UTC'}`.trim(),
      gridLat: json.latitude,
      gridLon: json.longitude,
      pollutant: 'Aerosol Optical Depth (550 nm total column)',
      aod550nm: Number(aod.toFixed(2)),
      aodClassification: classifyAodLevel(aod),
      surfaceDustModelUgM3:
        typeof dustUg === 'number' && Number.isFinite(dustUg) ? Number(dustUg.toFixed(1)) : null,
      hourlyAod: Array.isArray(json?.hourly?.aerosol_optical_depth)
        ? json.hourly.aerosol_optical_depth.slice(0, 24)
        : [],
      scientificBoundary:
        'Total-column optical depth (unitless) measures light extinction from surface to top-of-atmosphere and is NOT equivalent to ground-level CPCB NAQI (µg/m³).',
    };
  } catch (err) {
    return {
      status: 'unavailable',
      available: false,
      code: err?.name === 'AbortError' ? 'TIMEOUT' : 'OFFLINE_OR_NETWORK_ERROR',
      message:
        err?.name === 'AbortError'
          ? 'Copernicus CAMS atmospheric column request timed out.'
          : 'Live Copernicus CAMS atmospheric column feed is unreachable (offline mode active).',
    };
  } finally {
    clearTimeout(timer);
  }
}
