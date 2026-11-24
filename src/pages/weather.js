/**
 * Page 5 — Weather & Atmospheric Dynamics
 * Separates meteorological observations cleanly from AQI measurements,
 * fixes all Stitch HTML/Tailwind typos (O₃, NO₂, bar heights, spelling),
 * shows weather-dispersion correlations, and labels simulated models honestly.
 */

import { apiClient } from '../services/apiClient.js';
import { appState } from '../state/appState.js';
import { renderLoadingState, renderErrorState, renderProvenanceStrip } from '../components/States.js';
import { renderIcon } from '../components/Icons.js';
import { escapeHtml } from '../utils/sanitize.js';

export async function renderWeather(container) {
  container.innerHTML = renderLoadingState('Loading meteorological observations...');
  const state = appState.getState();

  let weatherPayload;
  try {
    weatherPayload = await apiClient.getWeather({ stationId: state.selectedStationId });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Unable to Load Weather Data',
      message: err.message,
      retryId: 'retryWeatherBtn',
    });
    container.querySelector('#retryWeatherBtn')?.addEventListener('click', () => renderWeather(container));
    return () => { };
  }

  const w = weatherPayload.weather;
  const corr = weatherPayload.hourlyCorrelation || [];
  const maxPm = Math.max(...corr.map((c) => c.pm25), 50);
  const maxPbl = Math.max(...corr.map((c) => c.pblM), 1000);

  const correlationRowsHtml = corr
    .map((pt) => {
      const pmWidth = Math.min(100, Math.round((pt.pm25 / maxPm) * 100));
      const pblWidth = Math.min(100, Math.round((pt.pblM / maxPbl) * 100));
      return `
        <div class="grid grid-cols-12 items-center gap-3 text-xs font-label-micro">
          <span class="col-span-2 text-text-muted">${escapeHtml(pt.hour)}</span>
          <div class="col-span-4 space-y-1">
            <div class="h-2 rounded-full bg-surface-container-low overflow-hidden">
              <div class="h-full bg-primary rounded-full" style="width: ${pblWidth}%"></div>
            </div>
            <span class="text-[10px] text-text-muted block">PBLH ${escapeHtml(pt.pblM)} m • Wind ${escapeHtml(pt.windKmh)} km/h</span>
          </div>
          <div class="col-span-6 space-y-1">
            <div class="h-2 rounded-full bg-surface-container-low overflow-hidden">
              <div class="h-full bg-aqi-poor rounded-full" style="width: ${pmWidth}%"></div>
            </div>
            <span class="text-[10px] text-on-surface block">PM₂.₅ ${escapeHtml(pt.pm25)} µg/m³</span>
          </div>
        </div>
      `;
    })
    .join('');

  const outlookHtml = (weatherPayload.simulatedOutlook || [])
    .map(
      (d) => `
      <div class="p-4 rounded-xl bg-surface-white border border-border-subtle shadow-xs flex flex-col justify-between space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-title-card text-xs font-bold text-primary">${escapeHtml(d.day)}</span>
          <span class="px-2 py-0.5 rounded bg-aqi-moderate/20 font-label-micro text-[9px] text-on-surface font-semibold">SIMULATED</span>
        </div>
        <div class="text-center py-1">
          <div class="font-headline-sm text-lg font-bold text-primary">${escapeHtml(d.tempHighC)}° / <span class="text-text-muted text-sm font-normal">${escapeHtml(d.tempLowC)}°C</span></div>
          <div class="font-label-micro text-[11px] text-text-muted mt-1">${escapeHtml(d.windCardinal)} • ${escapeHtml(d.windKmh)} km/h</div>
        </div>
        <div class="text-center font-body-sm text-xs text-secondary font-medium pt-2 border-t border-border-subtle">${escapeHtml(d.condition)}</div>
      </div>
    `
    )
    .join('');

  container.innerHTML = `
    <section class="relative w-full rounded-2xl bg-abyssal-pine text-white p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden">
      <div class="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div class="space-y-3 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2 font-label-micro text-xs text-aqi-good">
            <span class="px-2.5 py-1 rounded-full bg-primary text-aqi-good font-semibold">METEOROLOGICAL OBSERVATIONS (SEPARATE FROM AQI)</span>
            <span class="text-white/60">•</span>
            <span class="text-white/80">Station: ${escapeHtml(weatherPayload.stationId)}</span>
          </div>
          <h1 class="font-headline-lg text-headline-md sm:text-headline-lg text-white font-bold tracking-tight">
            Weather &amp; Atmospheric Dispersion Dynamics
          </h1>
          <p class="font-body-sm text-white/80">
            ${escapeHtml(weatherPayload.stationName)}, ${escapeHtml(weatherPayload.city)}, ${escapeHtml(weatherPayload.country)} • ${escapeHtml(weatherPayload.source)}
          </p>
        </div>

        <div class="px-4 py-3 rounded-xl bg-primary/90 border border-white/10 text-right">
          <div class="font-label-micro text-xs text-white/70 uppercase">Current Weather State</div>
          <div class="font-headline-sm text-xl font-bold text-aqi-good">${escapeHtml(w.temperatureC)}°C • ${escapeHtml(w.condition)}</div>
          <div class="font-label-micro text-xs text-white/80 mt-0.5">${escapeHtml(w.dispersionStatus)}</div>
        </div>
      </div>
    </section>

    <div class="p-4 rounded-xl bg-surface-white border border-border-subtle flex flex-wrap items-center justify-between gap-3">
      ${renderProvenanceStrip({
    dataType: weatherPayload.dataType,
    source: weatherPayload.source,
    timestamp: weatherPayload.timestamp,
  })}
      <span class="font-label-micro text-xs text-text-muted">Meteorological units (°C, %, km/h, hPa) are tracked separately from AQI indices.</span>
    </div>

    <!-- 6 Meteorological Cards -->
    <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="p-6 rounded-2xl bg-surface-white border border-border-subtle shadow-sm space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-label-micro text-xs uppercase text-text-muted">Thermal Profile</span>
            <h2 class="font-title-card text-base font-bold text-primary">Ambient Temperature</h2>
          </div>
          ${renderIcon('thermostat', 'w-5 h-5 text-secondary')}
        </div>
        <div class="flex items-baseline gap-3">
          <span class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(w.temperatureC)}°C</span>
          <span class="px-2.5 py-1 rounded-full bg-surface-container text-primary font-label-micro text-xs font-semibold">Feels like ${escapeHtml(w.feelsLikeC)}°C</span>
        </div>
        <p class="font-label-micro text-xs text-text-muted">Dew Point: <strong class="text-on-surface">${escapeHtml(w.dewPointC)}°C</strong></p>
      </div>

      <div class="p-6 rounded-2xl bg-surface-white border border-border-subtle shadow-sm space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-label-micro text-xs uppercase text-text-muted">Moisture</span>
            <h2 class="font-title-card text-base font-bold text-primary">Relative Humidity</h2>
          </div>
          ${renderIcon('humidity_percentage', 'w-5 h-5 text-secondary')}
        </div>
        <div class="flex items-baseline gap-3">
          <span class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(w.humidityPct)}%</span>
          <span class="font-label-micro text-xs text-text-muted">RH</span>
        </div>
        <div class="w-full bg-surface-container-low rounded-full h-2.5 overflow-hidden">
          <div class="bg-secondary h-2.5 rounded-full" style="width: ${Math.min(100, w.humidityPct)}%;"></div>
        </div>
      </div>

      <div class="p-6 rounded-2xl bg-surface-white border border-border-subtle shadow-sm flex flex-col justify-between space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-label-micro text-xs uppercase text-text-muted">Anemometry</span>
            <h2 class="font-title-card text-base font-bold text-primary">Wind Speed &amp; Direction</h2>
          </div>
          ${renderIcon('air', 'w-5 h-5 text-secondary')}
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(w.windSpeedKmh)} <span class="text-sm font-normal text-text-muted">km/h</span></div>
            <div class="font-label-micro text-xs text-secondary font-semibold mt-1">${escapeHtml(w.windCardinal)} (${escapeHtml(w.windDirectionDeg)}°)</div>
          </div>
          <svg class="w-16 h-16" viewBox="0 0 100 100" role="img" aria-label="Wind direction compass">
            <circle cx="50" cy="50" fill="none" r="44" stroke="#D5E5DC" stroke-width="2"></circle>
            <text x="50" y="18" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#172B25">N</text>
            <g transform="rotate(${escapeHtml(w.windDirectionDeg)} 50 50)">
              <line x1="50" y1="50" x2="50" y2="16" stroke="#237A5B" stroke-width="3" stroke-linecap="round"></line>
              <polygon points="50,10 45,20 55,20" fill="#237A5B"></polygon>
            </g>
          </svg>
        </div>
      </div>

      <div class="p-6 rounded-2xl bg-surface-white border border-border-subtle shadow-sm space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-label-micro text-xs uppercase text-text-muted">Barometer</span>
            <h2 class="font-title-card text-base font-bold text-primary">Atmospheric Pressure</h2>
          </div>
          ${renderIcon('compress', 'w-5 h-5 text-secondary')}
        </div>
        <div class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(w.pressureHpa)} <span class="text-sm font-normal text-text-muted">hPa</span></div>
        <p class="font-body-sm text-xs text-text-muted">High-pressure subsidence reduces vertical mixing and can trap surface emissions.</p>
      </div>

      <div class="p-6 rounded-2xl bg-surface-white border border-border-subtle shadow-sm space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-label-micro text-xs uppercase text-text-muted">Solar Flux</span>
            <h2 class="font-title-card text-base font-bold text-primary">UV Index &amp; Photochemistry</h2>
          </div>
          ${renderIcon('wb_sunny', 'w-5 h-5 text-secondary')}
        </div>
        <div class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(w.uvIndex)}</div>
        <p class="font-body-sm text-xs text-text-muted">Solar ultraviolet irradiance drives photochemical reactions involving NO<sub>2</sub> and VOCs to form O<sub>3</sub>.</p>
      </div>

      <div class="p-6 rounded-2xl bg-surface-white border border-border-subtle shadow-sm space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-label-micro text-xs uppercase text-text-muted">Mixing Volume</span>
            <h2 class="font-title-card text-base font-bold text-primary">Boundary Layer &amp; Ventilation</h2>
          </div>
          ${renderIcon('layers', 'w-5 h-5 text-secondary')}
        </div>
        <div class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(w.pblHeightM)} <span class="text-sm font-normal text-text-muted">m</span></div>
        <p class="font-label-micro text-xs text-secondary font-semibold">Ventilation Coefficient: ${escapeHtml(w.ventilationCoefficientM2s)} m²/s</p>
      </div>
    </section>

    <!-- Correlation & Simulated Washout Model -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 bg-surface-white p-6 rounded-2xl border border-border-subtle shadow-sm space-y-4">
        <div>
          <span class="font-label-micro text-xs uppercase text-secondary font-bold">Weather–Pollution Coupling (Simulated Series)</span>
          <h2 class="font-headline-sm text-xl font-bold text-primary">Mixing Height &amp; Wind vs. PM₂.₅ Concentration</h2>
        </div>
        <div class="space-y-3 pt-2">${correlationRowsHtml}</div>
      </div>

      <div class="lg:col-span-5 bg-surface-white p-6 rounded-2xl border border-border-subtle shadow-sm space-y-4">
        <div>
          <span class="px-2 py-0.5 rounded bg-aqi-moderate/20 font-label-micro text-[10px] font-bold text-on-surface uppercase">Simulated Physics Model</span>
          <h2 class="font-headline-sm text-xl font-bold text-primary mt-2">Precipitation Washout Estimator</h2>
          <p class="font-body-sm text-xs text-text-muted">Demonstrates below-cloud wet scavenging attenuation under rainfall (simulated estimate only).</p>
        </div>
        <div>
          <label class="flex justify-between font-label-micro text-xs text-text-muted mb-2" for="weatherPrecipSlider">
            <span>Simulated Rain Rate:</span>
            <strong id="weatherPrecipLabel" class="text-primary">18 mm/hr (Heavy Shower)</strong>
          </label>
          <input id="weatherPrecipSlider" type="range" min="2" max="50" value="18" class="w-full accent-secondary cursor-pointer" />
        </div>
        <div class="grid grid-cols-2 gap-3 p-4 rounded-xl bg-pearl-bg border border-border-subtle">
          <div>
            <span class="font-label-micro text-[11px] text-text-muted block">Est. PM₁₀ Washout</span>
            <strong id="weatherPm10Wash" class="font-headline-sm text-lg text-secondary">-65.2%</strong>
          </div>
          <div>
            <span class="font-label-micro text-[11px] text-text-muted block">Est. PM₂.₅ Washout</span>
            <strong id="weatherPm25Wash" class="font-headline-sm text-lg text-secondary">-45.7%</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- Forecast / Simulated Outlook -->
    <section class="space-y-4">
      <div class="p-4 rounded-xl bg-surface-container-low border border-border-subtle flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-headline-sm text-primary font-bold">5-Day Simulated Weather Scenario Outlook</h2>
          <p class="font-body-sm text-xs text-text-muted">${escapeHtml(weatherPayload.forecastNotice)}</p>
        </div>
        <span class="px-3 py-1 rounded-full bg-aqi-moderate/25 font-label-micro text-xs font-bold text-on-surface">NOT A LIVE FORECAST FEED</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        ${outlookHtml}
      </div>
    </section>
  `;

  const precipSlider = container.querySelector('#weatherPrecipSlider');
  precipSlider?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    const label = container.querySelector('#weatherPrecipLabel');
    const pm10El = container.querySelector('#weatherPm10Wash');
    const pm25El = container.querySelector('#weatherPm25Wash');
    if (label) {
      const desc = val > 30 ? 'Torrential Monsoon' : val > 15 ? 'Heavy Shower' : 'Moderate Rain';
      label.textContent = `${val} mm/hr (${desc})`;
    }
    if (pm10El) pm10El.textContent = `-${Math.min(96, 40 + val * 1.4).toFixed(1)}%`;
    if (pm25El) pm25El.textContent = `-${Math.min(88, 25 + val * 1.15).toFixed(1)}%`;
  });

  return () => { };
}
