import { describe, it, expect, vi } from 'vitest';
import {
  CAMS_AIR_QUALITY_ENDPOINT,
  classifyAodLevel,
  fetchCopernicusCamsColumn,
  getSentinel5PL2Availability,
} from '../src/services/satelliteLayer.js';

describe('Satellite & Atmospheric Column Layer', () => {
  it('honestly reports direct Sentinel-5P L2 NO2 as unavailable without CDSE backend', () => {
    const info = getSentinel5PL2Availability();
    expect(info.available).toBe(false);
    expect(info.status).toBe('UNAVAILABLE');
    expect(info.requiresBackend).toBe(true);
  });

  it('rejects invalid coordinates without making network requests', async () => {
    const fetchSpy = vi.fn();
    const res = await fetchCopernicusCamsColumn({ lat: 999, lon: 72, fetchImpl: fetchSpy });
    expect(res.available).toBe(false);
    expect(res.code).toBe('INVALID_COORDINATES');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses Copernicus CAMS AOD response with provenance and strict ground-AQI separation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latitude: 19.1,
        longitude: 72.9,
        timezone_abbreviation: 'GMT+5:30',
        current: { time: '2026-11-25T02:30', aerosol_optical_depth: 0.41, dust: 2.0 },
        hourly: { aerosol_optical_depth: [0.49, 0.46, 0.41] },
      }),
    });

    const res = await fetchCopernicusCamsColumn({
      lat: 19.0657,
      lon: 72.8687,
      fetchImpl: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain(CAMS_AIR_QUALITY_ENDPOINT);
    expect(res.available).toBe(true);
    expect(res.dataType).toBe('modelled-satellite-assimilated');
    expect(res.aod550nm).toBe(0.41);
    expect(res.surfaceDustModelUgM3).toBe(2.0);
    expect(res.timestamp).toBe('2026-11-25T02:30 GMT+5:30');
    expect(res.spatialResolution).toContain('40 km');
    expect(res.aodClassification.label).toContain('Elevated Plume');
    expect(res.source).toContain('Copernicus Atmosphere Monitoring Service');
    expect(res.scientificBoundary).toContain('NOT equivalent to ground-level CPCB NAQI');
  });

  it('returns an honest unavailable state when offline or upstream network fails', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const res = await fetchCopernicusCamsColumn({
      lat: 19.0657,
      lon: 72.8687,
      fetchImpl: failingFetch,
    });
    expect(res.available).toBe(false);
    expect(res.status).toBe('unavailable');
    expect(res.code).toBe('OFFLINE_OR_NETWORK_ERROR');
    expect(classifyAodLevel(null).label).toBe('Unavailable');
  });

  it('handles HTTP error status, AbortError timeout, and malformed/missing AOD fields cleanly', async () => {
    const httpErrFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const httpRes = await fetchCopernicusCamsColumn({
      lat: 19.0657,
      lon: 72.8687,
      fetchImpl: httpErrFetch,
    });
    expect(httpRes.available).toBe(false);
    expect(httpRes.code).toBe('UPSTREAM_HTTP_ERROR');

    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const timeoutFetch = vi.fn().mockRejectedValue(abortErr);
    const timeoutRes = await fetchCopernicusCamsColumn({
      lat: 19.0657,
      lon: 72.8687,
      fetchImpl: timeoutFetch,
    });
    expect(timeoutRes.available).toBe(false);
    expect(timeoutRes.code).toBe('TIMEOUT');

    const malformedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current: { time: '2026-11-25T02:30', aerosol_optical_depth: null } }),
    });
    const malformedRes = await fetchCopernicusCamsColumn({
      lat: 19.0657,
      lon: 72.8687,
      fetchImpl: malformedFetch,
    });
    expect(malformedRes.available).toBe(false);
    expect(malformedRes.code).toBe('MISSING_AOD_FIELD');
  });
});
