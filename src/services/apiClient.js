/**
 * Centralized AIRINDX API Client
 * Supports toggling between the local demonstration mock provider
 * and the FastAPI backend configured via ENV.API_BASE_URL.
 */

import { ENV } from '../config/env.js';
import { mockProvider } from './mockProvider.js';

export class ApiClientError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR' } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export class AirindxApiClient {
  constructor({
    baseUrl = ENV.API_BASE_URL,
    timeoutMs = ENV.API_TIMEOUT_MS,
    useMock = ENV.USE_MOCK_DATA,
    fetchImpl = (...args) => globalThis.fetch(...args),
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.useMock = Boolean(useMock);
    this.fetchImpl = fetchImpl;
  }

  setUseMock(flag) {
    this.useMock = Boolean(flag);
  }

  setBaseUrl(url) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
      this.baseUrl = url.trim().replace(/\/+$/, '');
    }
  }

  async _request(path, { method = 'GET', params = null, body = null } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params && typeof params === 'object') {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null && val !== '') {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiClientError(`Backend responded with HTTP ${response.status}`, {
          status: response.status,
          code: 'HTTP_ERROR',
        });
      }

      const payload = await response.json();
      if (!payload || typeof payload !== 'object') {
        throw new ApiClientError('Invalid JSON response shape from backend', {
          code: 'VALIDATION_ERROR',
        });
      }
      return payload;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiClientError(`Request timed out after ${this.timeoutMs}ms`, {
          code: 'TIMEOUT',
        });
      }
      if (err instanceof ApiClientError) throw err;
      throw new ApiClientError('Unable to reach AIRINDX backend service', {
        code: 'NETWORK_ERROR',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async getCurrentAQI(params = {}) {
    if (this.useMock) return mockProvider.getCurrentAQI(params);
    return this._request('/api/v1/aqi/current', { params });
  }

  async getLocationAQI(params = {}) {
    if (this.useMock) return mockProvider.getLocationAQI(params);
    return this._request('/api/v1/aqi/location', { params });
  }

  async getPollutants(params = {}) {
    if (this.useMock) return mockProvider.getPollutants(params);
    return this._request('/api/v1/pollutants', { params });
  }

  async getHistoricalAQI(params = {}) {
    if (this.useMock) return mockProvider.getHistoricalAQI(params);
    return this._request('/api/v1/history', { params });
  }

  async getWeather(params = {}) {
    if (this.useMock) return mockProvider.getWeather(params);
    return this._request('/api/v1/weather', { params });
  }

  async getMonitoringStations(params = {}) {
    if (this.useMock) return mockProvider.getMonitoringStations(params);
    return this._request('/api/v1/stations', { params });
  }

  async compareCities(params = {}) {
    if (this.useMock) return mockProvider.compareCities(params);
    const citiesParam = Array.isArray(params.cities) ? params.cities.join(',') : params.cities;
    return this._request('/api/v1/compare', {
      params: { ...params, cities: citiesParam },
    });
  }

  async sendAIMessage(payload = {}) {
    if (this.useMock) return mockProvider.sendAIMessage(payload);
    return this._request('/api/v1/assistant/chat', {
      method: 'POST',
      body: payload,
    });
  }
}

export const apiClient = new AirindxApiClient();
