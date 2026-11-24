/**
 * Environment-based frontend configuration.
 * Never store API keys or secrets in VITE_* client variables.
 */

const rawBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';
const rawTimeout = Number(import.meta.env?.VITE_API_TIMEOUT_MS || 5000);
const rawUseMock = import.meta.env?.VITE_USE_MOCK_DATA;

export const ENV = Object.freeze({
  API_BASE_URL: rawBaseUrl.replace(/\/+$/, ''),
  API_TIMEOUT_MS: Number.isFinite(rawTimeout) && rawTimeout >= 500 ? rawTimeout : 5000,
  USE_MOCK_DATA: rawUseMock === undefined ? true : rawUseMock === 'true',
  APP_ENV: import.meta.env?.MODE || 'development',
});
