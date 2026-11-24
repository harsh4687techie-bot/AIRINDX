/**
 * Page 1 — Live Dashboard
 * Preserves the Stitch Live Dashboard asymmetric layout, AQI radial gauge,
 * 3D globe cockpit, 6-card weather strip, 6 priority pollutant cards,
 * interactive historical curve, nearby monitoring station table, and Copilot panel.
 */

import { apiClient } from '../services/apiClient.js';
import { appState } from '../state/appState.js';
import {
  AQI_STANDARDS,
  POLLUTANT_METADATA,
  WHO_2021_GUIDELINES,
  convertConcentration,
} from '../data/aqiStandards.js';
import { renderIcon } from '../components/Icons.js';
import { buildLineSeriesChart, buildSparklineSvg } from '../components/Charts.js';
import { renderLoadingState, renderErrorState, renderProvenanceStrip } from '../components/States.js';
import { escapeHtml } from '../utils/sanitize.js';
import { downloadCsvFile } from '../utils/exportCsv.js';
import { runContainerCleanup, registerContainerCleanup } from '../utils/lifecycle.js';

function getAqiDashOffset(aqi) {
  const pct = Math.min(1, Math.max(0, (aqi || 0) / 500));
  const arcSpan = 424;
  return Math.round(565 - pct * arcSpan);
}

export async function renderLiveDashboard(container) {
  runContainerCleanup(container);
  container.innerHTML = renderLoadingState('Loading station telemetry & environmental model...');
  const state = appState.getState();

  let currentPayload;
  let historyPayload;
  let stationsPayload;

  try {
    [currentPayload, historyPayload, stationsPayload] = await Promise.all([
      apiClient.getCurrentAQI({
        stationId: state.selectedStationId,
        cityId: state.selectedCityId,
        standard: state.aqiStandard,
      }),
      apiClient.getHistoricalAQI({
        stationId: state.selectedStationId,
        range: state.historicalRange,
        standard: state.aqiStandard,
        metric: 'aqi',
      }),
      apiClient.getMonitoringStations({ standard: state.aqiStandard }),
    ]);
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Unable to Load Live Dashboard',
      message: err.message || 'Telemetry request failed.',
      retryId: 'retryDashboardBtn',
    });
    container.querySelector('#retryDashboardBtn')?.addEventListener('click', () => {
      renderLiveDashboard(container);
    });
    return () => {};
  }

  const station = currentPayload.station;
  const cityStations = currentPayload.cityStations || [station];
  const allStations = stationsPayload.stations || [];
  const nearbyList = cityStations.length > 1 ? cityStations : allStations.slice(0, 5);

  const aqiVal = station.aqi;
  const catLabel = station.category?.label || 'Unavailable';
  const catHex = station.category?.hex || '#F2994A';
  const domKey = (station.dominantPollutant || 'PM25').toLowerCase();
  const domMeta = POLLUTANT_METADATA[domKey] || POLLUTANT_METADATA.pm25;
  const domReading = station.pollutants[domKey] || station.pollutants.pm25;
  const stdLabel =
    station.methodology === AQI_STANDARDS.US_EPA
      ? 'US EPA AQI (May 2024)'
      : 'India CPCB NAQI (0–500)';

  const pm25Val = station.pollutants.pm25?.value ?? null;
  const whoPm25Ratio =
    typeof pm25Val === 'number'
      ? (pm25Val / WHO_2021_GUIDELINES.pm25.guideline24h).toFixed(1)
      : null;

  const sixPollutantIds = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];
  const chartData = buildLineSeriesChart({
    series: historyPayload.series,
    unitLabel: stdLabel,
    showWindOverlay: true,
  });

  const stationChipsHtml = (cityStations.length ? cityStations : [station])
    .map((st) => {
      const active = st.stationId === station.stationId;
      return `<button type="button" data-station-id="${escapeHtml(st.stationId)}" data-city-id="${escapeHtml(st.cityId)}" class="station-chip px-3.5 py-1.5 rounded-full ${
        active
          ? 'bg-primary text-aqi-good font-semibold ring-1 ring-primary'
          : 'bg-pearl-bg hover:bg-surface-container text-on-surface border border-border-subtle'
      } font-title-card text-xs whitespace-nowrap transition-colors">${escapeHtml(st.name.split(',')[0])}</button>`;
    })
    .join('');

  const pollutantCardsHtml = sixPollutantIds
    .map((id) => {
      const meta = POLLUTANT_METADATA[id];
      const reading = station.pollutants[id];
      const sub = station.subIndices?.[id];
      const who = WHO_2021_GUIDELINES[id];
      const sparkValues = historyPayload.series.map((p) => p.pollutants?.[id]?.value ?? 0);
      const valDisplay = reading?.value !== undefined && reading?.value !== null ? reading.value : 'N/A';
      const unitDisplay = reading?.unit || meta.unit;
      const subText = sub?.available ? `${sub.subIndex} sub-index` : 'N/A';
      const subColor = sub?.category?.hex || '#237A5B';
      const trend = reading?.trendPct24h;
      const trendHtml =
        typeof trend === 'number'
          ? `<span class="font-label-micro text-xs ${
              trend > 0 ? 'text-error' : 'text-secondary'
            } font-semibold flex items-center gap-0.5">${trend > 0 ? '↑' : '↓'} ${trend > 0 ? '+' : ''}${trend}%/24h</span>`
          : '';

      // Compute guideline ratio cleanly in WHO units
      let whoLine = 'WHO 2021 Reference';
      let barPct = 25;
      if (who && typeof reading?.value === 'number') {
        const refLimit = who.guideline24h || who.guideline8h;
        const converted =
          reading.unit === who.unit
            ? reading.value
            : convertConcentration(id, reading.value, reading.unit, who.unit);
        if (typeof converted === 'number' && refLimit) {
          const pct = Math.round((converted / refLimit) * 100);
          whoLine = `WHO 2021 (${refLimit} ${who.unit}): ${pct}%`;
          barPct = Math.min(100, Math.max(8, Math.round(pct / 2)));
        }
      }

      return `
        <article class="bg-surface-white rounded-2xl p-5 border border-border-subtle shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="font-title-card text-lg font-bold text-primary">${escapeHtml(meta.symbol)}</h3>
              <span class="font-label-micro text-xs text-text-muted">${escapeHtml(meta.name)}</span>
            </div>
            <span class="px-2.5 py-1 rounded-full font-label-micro text-xs font-bold" style="background-color: ${escapeHtml(subColor)}26; color: #172B25;">${escapeHtml(subText)}</span>
          </div>
          <div class="flex items-baseline justify-between py-1">
            <div class="font-telemetry-num-lg text-3xl font-bold text-primary">
              ${escapeHtml(valDisplay)} <span class="font-body-sm text-xs font-normal text-text-muted">${escapeHtml(unitDisplay)}</span>
            </div>
            ${trendHtml}
          </div>
          <div class="w-full h-10 my-2">${buildSparklineSvg(sparkValues, 'text-secondary')}</div>
          <div class="space-y-1.5 pt-1">
            <div class="flex justify-between font-label-micro text-xs text-text-muted">
              <span>${escapeHtml(whoLine)}</span>
              <span class="text-on-surface font-semibold">${escapeHtml(sub?.category?.label || '—')}</span>
            </div>
            <div class="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width: ${barPct}%; background-color: ${escapeHtml(subColor)};"></div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  const stationRowsHtml = nearbyList
    .map((st) => {
      const isSelected = st.stationId === station.stationId;
      const rowHex = st.category?.hex || '#237A5B';
      return `
        <tr tabindex="0" role="button" aria-pressed="${isSelected}" class="${isSelected ? 'bg-surface-container-low/60' : 'hover:bg-surface-container-low/40'} transition-colors cursor-pointer station-row" data-station-id="${escapeHtml(st.stationId)}" data-city-id="${escapeHtml(st.cityId)}">
          <td class="py-3 px-3">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${escapeHtml(rowHex)};"></span>
              <div>
                <strong class="font-title-card text-sm font-bold text-primary block">${escapeHtml(st.name)}</strong>
                <span class="font-label-micro text-xs text-text-muted">${escapeHtml(st.city)} • ${escapeHtml(st.distanceLabel || st.stationId)}</span>
              </div>
            </div>
          </td>
          <td class="py-3 px-3">
            <span class="px-2.5 py-1 rounded-md font-label-micro text-xs font-bold whitespace-nowrap" style="background-color: ${escapeHtml(rowHex)}26; color: #172B25;">${escapeHtml(st.aqi ?? 'N/A')} ${escapeHtml(st.category?.label || '')}</span>
          </td>
          <td class="py-3 px-3 text-right font-telemetry-num-md text-base font-bold text-primary">${escapeHtml(st.pollutants.pm25?.value ?? 'N/A')}</td>
          <td class="py-3 px-3 text-right font-telemetry-badge text-text-muted text-xs">${escapeHtml(st.pollutants.pm10?.value ?? 'N/A')}</td>
          <td class="py-3 px-3 text-right font-label-micro text-xs font-semibold">${escapeHtml(st.dominantPollutant || '—')}</td>
        </tr>
      `;
    })
    .join('');

  const globeStations = allStations.map((s) => ({
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    aqi: s.aqi || 0,
    color: parseInt((s.category?.hex || '#B9ED73').replace('#', ''), 16),
  }));

  container.innerHTML = `
    <div class="bg-surface-white rounded-2xl p-5 sm:p-6 border border-border-subtle shadow-sm relative overflow-hidden">
      <div class="absolute -top-24 right-1/4 w-80 h-80 rounded-full bg-aqi-good/10 blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex items-center flex-wrap gap-2 text-text-muted">
            <span class="inline-flex items-center justify-center p-1 rounded-md bg-secondary/10 text-secondary">
              ${renderIcon('location_on', 'w-4 h-4')}
            </span>
            <h1 class="font-headline-sm text-xl sm:text-2xl text-primary font-bold tracking-tight">
              ${escapeHtml(station.city)}, ${escapeHtml(station.state)}, ${escapeHtml(station.country)}
            </h1>
            <span class="font-label-micro text-xs px-2.5 py-0.5 rounded-md bg-pearl-bg text-secondary border border-border-subtle font-medium">
              ${escapeHtml(Number(station.lat ?? 0).toFixed(4))}° N, ${escapeHtml(Number(station.lon ?? 0).toFixed(4))}° E
            </span>
            <span class="font-body-sm text-xs text-text-muted bg-surface-container-low px-2 py-0.5 rounded">${escapeHtml(station.name)}</span>
          </div>
          ${renderProvenanceStrip({
            dataType: station.dataType,
            source: station.source,
            timestamp: station.timestamp,
            standard: stdLabel,
          })}
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none" aria-label="Station Selector">
          ${stationChipsHtml}
          <a href="#/explore-map" class="px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-primary font-title-card text-xs font-semibold flex items-center gap-1 whitespace-nowrap border border-secondary/20 transition-colors">
            ${renderIcon('explore', 'w-4 h-4')}
            <span>All Stations</span>
          </a>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 bg-surface-white rounded-2xl p-6 lg:p-7 border border-border-subtle shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border-subtle/80">
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded-full font-label-micro text-xs font-semibold tracking-wide" style="background-color: ${escapeHtml(catHex)}26; color: #172B25;">
                ${escapeHtml(stdLabel.toUpperCase())}
              </span>
              <span class="font-label-micro text-xs text-text-muted hidden sm:inline">• Simulated Station Readout</span>
            </div>
            <div class="font-label-micro text-xs text-text-muted">
              Valid Pollutants: <strong class="text-on-surface font-semibold">${escapeHtml(station.aqiEvaluation?.validPollutantCount ?? 0)}</strong>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 items-center gap-6 py-6">
            <div class="md:col-span-6 flex flex-col items-center justify-center relative">
              <div class="relative w-64 h-64 flex items-center justify-center">
                <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 220 220" aria-hidden="true">
                  <circle class="text-surface-container" cx="110" cy="110" fill="none" r="90" stroke="currentColor" stroke-dasharray="424" stroke-dashoffset="140" stroke-linecap="round" stroke-width="16"></circle>
                  <circle cx="110" cy="110" fill="none" r="90" stroke="${escapeHtml(catHex)}" stroke-dasharray="565" stroke-dashoffset="${getAqiDashOffset(aqiVal)}" stroke-linecap="round" stroke-width="16"></circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span class="font-label-micro text-[11px] text-text-muted uppercase tracking-widest font-semibold">Simulated AQI</span>
                  <span class="font-telemetry-num-lg text-5xl lg:text-6xl text-primary font-bold tracking-tight my-1">${escapeHtml(aqiVal ?? 'N/A')}</span>
                  <span class="px-2.5 py-1 rounded-full font-title-card text-xs font-semibold tracking-tight" style="background-color: ${escapeHtml(catHex)}30; color: #172B25;">
                    ${escapeHtml(catLabel)}
                  </span>
                </div>
              </div>
              <div class="w-full max-w-xs mt-2 px-2">
                <div class="flex justify-between items-center text-[10px] font-label-micro text-text-muted mb-1">
                  <span>0 Good</span><span>100</span><span>200</span><span>300+</span><span>500</span>
                </div>
                <div class="h-2 w-full rounded-full overflow-hidden flex bg-surface-container">
                  <div class="h-full bg-aqi-good" style="width: 20%"></div>
                  <div class="h-full bg-aqi-moderate" style="width: 20%"></div>
                  <div class="h-full bg-aqi-poor" style="width: 20%"></div>
                  <div class="h-full bg-aqi-unhealthy" style="width: 20%"></div>
                  <div class="h-full bg-aqi-severe" style="width: 20%"></div>
                </div>
              </div>
            </div>

            <div class="md:col-span-6 flex flex-col justify-center space-y-4">
              <div class="p-4 rounded-xl bg-surface-container-low border border-border-subtle">
                <div class="flex items-center justify-between text-xs font-label-micro text-text-muted uppercase font-semibold">
                  <span>Dominant Pollutant</span>
                  <span class="text-primary font-bold">${escapeHtml(domMeta.symbol)}</span>
                </div>
                <div class="flex items-baseline justify-between pt-2">
                  <span class="font-headline-sm text-2xl font-bold text-primary">${escapeHtml(domMeta.name)}</span>
                  <span class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(domReading?.value ?? 'N/A')} <span class="font-body-sm text-xs font-normal text-text-muted">${escapeHtml(domReading?.unit || '')}</span></span>
                </div>
                <p class="font-body-sm text-xs text-text-muted pt-2 leading-relaxed">
                  ${whoPm25Ratio ? `<strong class="text-on-surface font-semibold">${escapeHtml(whoPm25Ratio)}× WHO 2021 24-hr PM2.5 Guideline</strong> (15 µg/m³). ` : ''}
                  ${escapeHtml(domMeta.healthEffects)}
                </p>
              </div>

              <div class="p-4 rounded-xl bg-pearl-bg border border-border-subtle flex flex-col gap-2">
                <div class="flex justify-between items-center font-label-micro text-xs">
                  <span class="text-text-muted">24h Simulated Min:</span>
                  <span class="text-primary font-bold font-telemetry-badge">${escapeHtml(historyPayload.summary.min ?? 'N/A')} AQI (${escapeHtml(historyPayload.summary.minLabel)})</span>
                </div>
                <div class="flex justify-between items-center font-label-micro text-xs">
                  <span class="text-text-muted">24h Simulated Peak:</span>
                  <span class="text-error font-bold font-telemetry-badge">${escapeHtml(historyPayload.summary.max ?? 'N/A')} AQI (${escapeHtml(historyPayload.summary.peakLabel)})</span>
                </div>
                <div class="flex justify-between items-center font-label-micro text-xs">
                  <span class="text-text-muted">24h Mean:</span>
                  <span class="text-secondary font-bold font-telemetry-badge">${escapeHtml(historyPayload.summary.mean ?? 'N/A')} AQI</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-2 p-4 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-lg bg-surface-white text-secondary shadow-xs mt-0.5">
              ${renderIcon('health_and_safety', 'w-5 h-5')}
            </div>
            <div>
              <h2 class="font-title-card text-sm font-bold text-primary">General Environmental Advisory (Non-Medical)</h2>
              <p class="font-body-sm text-xs text-text-muted leading-relaxed">
                ${escapeHtml(station.category?.healthImplication || 'Monitor local environmental updates.')}
              </p>
            </div>
          </div>
          <a href="#/ai-assistant" class="px-4 py-2 rounded-lg bg-primary hover:bg-abyssal-pine text-white font-title-card text-xs font-semibold transition-colors whitespace-nowrap self-stretch sm:self-auto text-center shadow-xs">
            Ask AI Copilot
          </a>
        </div>
      </div>

      <div class="lg:col-span-5 bg-abyssal-pine text-white rounded-2xl p-6 lg:p-7 border border-white/10 shadow-lg flex flex-col justify-between relative overflow-hidden min-h-[480px]">
        <div class="relative z-10 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-aqi-good"></span>
            <span class="font-headline-sm text-sm font-semibold tracking-wide text-white">3D Geospatial Observatory</span>
          </div>
          <span class="font-label-micro text-xs text-aqi-good bg-primary/80 border border-aqi-good/30 px-2.5 py-0.5 rounded-full">
            ${escapeHtml(station.stationId)}
          </span>
        </div>

        <div id="dashboardGlobeMount" class="relative z-10 w-full h-64 my-2 rounded-xl overflow-hidden"></div>

        <div class="relative z-10 space-y-3">
          <div class="flex items-center justify-between p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
            <button type="button" data-globe-mode="globe" class="globe-mode-btn flex-1 py-1.5 text-center font-title-card text-xs rounded-lg bg-aqi-good text-primary font-bold shadow-sm transition-all">3D Globe</button>
            <button type="button" data-globe-mode="aerosol" class="globe-mode-btn flex-1 py-1.5 text-center font-title-card text-xs rounded-lg text-white/80 hover:text-white transition-colors">Atmosphere</button>
            <button type="button" data-globe-mode="nodes" class="globe-mode-btn flex-1 py-1.5 text-center font-title-card text-xs rounded-lg text-white/80 hover:text-white transition-colors">Sensor Lattice</button>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3 rounded-xl bg-white/5 border border-white/10">
              <span class="font-label-micro text-[10px] text-white/60 block uppercase tracking-wider">Boundary Layer (PBLH)</span>
              <div class="font-telemetry-num-md text-xl font-bold text-white mt-0.5">${escapeHtml(station.weather.pblHeightM)} <span class="font-label-micro text-xs text-aqi-good font-normal">m ASL</span></div>
            </div>
            <div class="p-3 rounded-xl bg-white/5 border border-white/10">
              <span class="font-label-micro text-[10px] text-white/60 block uppercase tracking-wider">Observatory Layer</span>
              <div class="font-label-micro text-[11px] text-white/90 mt-1">Visual 3D Globe • <a href="#/explore-map" class="text-aqi-good underline">CAMS Column</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-surface-white p-4 rounded-xl border border-border-subtle shadow-xs">
        <div class="flex items-center justify-between text-text-muted mb-1.5">
          <span class="font-label-micro text-xs uppercase font-semibold">Temperature</span>
          ${renderIcon('thermostat', 'w-4 h-4 text-secondary')}
        </div>
        <div class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.weather.temperatureC)}°C</div>
        <span class="font-body-sm text-xs text-text-muted">Feels like ${escapeHtml(station.weather.feelsLikeC)}°C</span>
      </div>
      <div class="bg-surface-white p-4 rounded-xl border border-border-subtle shadow-xs">
        <div class="flex items-center justify-between text-text-muted mb-1.5">
          <span class="font-label-micro text-xs uppercase font-semibold">Humidity</span>
          ${renderIcon('humidity_percentage', 'w-4 h-4 text-secondary')}
        </div>
        <div class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.weather.humidityPct)}%</div>
        <span class="font-body-sm text-xs text-text-muted">Dew Point: ${escapeHtml(station.weather.dewPointC)}°C</span>
      </div>
      <div class="bg-surface-white p-4 rounded-xl border border-border-subtle shadow-xs">
        <div class="flex items-center justify-between text-text-muted mb-1.5">
          <span class="font-label-micro text-xs uppercase font-semibold">Wind Speed</span>
          ${renderIcon('air', 'w-4 h-4 text-secondary')}
        </div>
        <div class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.weather.windSpeedKmh)} <span class="font-body-sm text-xs font-normal text-text-muted">km/h</span></div>
        <span class="font-body-sm text-xs text-secondary font-semibold">${escapeHtml(station.weather.windCardinal)} (${escapeHtml(station.weather.windDirectionDeg)}°)</span>
      </div>
      <div class="bg-surface-white p-4 rounded-xl border border-border-subtle shadow-xs">
        <div class="flex items-center justify-between text-text-muted mb-1.5">
          <span class="font-label-micro text-xs uppercase font-semibold">UV Index</span>
          ${renderIcon('wb_sunny', 'w-4 h-4 text-secondary')}
        </div>
        <div class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.weather.uvIndex)}</div>
        <span class="font-body-sm text-xs text-text-muted">Solar index</span>
      </div>
      <div class="bg-surface-white p-4 rounded-xl border border-border-subtle shadow-xs">
        <div class="flex items-center justify-between text-text-muted mb-1.5">
          <span class="font-label-micro text-xs uppercase font-semibold">Pressure</span>
          ${renderIcon('compress', 'w-4 h-4 text-secondary')}
        </div>
        <div class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.weather.pressureHpa)} <span class="font-body-sm text-xs font-normal text-text-muted">hPa</span></div>
        <span class="font-body-sm text-xs text-text-muted">Surface barometer</span>
      </div>
      <div class="bg-surface-white p-4 rounded-xl border border-border-subtle shadow-xs">
        <div class="flex items-center justify-between text-text-muted mb-1.5">
          <span class="font-label-micro text-xs uppercase font-semibold">Visibility</span>
          ${renderIcon('visibility', 'w-4 h-4 text-secondary')}
        </div>
        <div class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.weather.visibilityKm)} <span class="font-body-sm text-xs font-normal text-text-muted">km</span></div>
        <span class="font-body-sm text-xs text-on-surface font-semibold">${escapeHtml(station.weather.condition)}</span>
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span class="font-label-micro text-xs text-secondary font-bold uppercase tracking-wider">Atmospheric Composition</span>
          <h2 class="font-headline-md text-2xl font-bold text-primary tracking-tight">Priority Pollutant Breakdown</h2>
        </div>
        <a href="#/pollutants" class="font-label-micro text-xs text-secondary font-semibold hover:underline">View all 8 CPCB pollutants &amp; standards →</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        ${pollutantCardsHtml}
      </div>
    </div>

    <div class="bg-surface-white rounded-2xl p-6 lg:p-7 border border-border-subtle shadow-sm space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="font-label-micro text-xs text-secondary font-bold uppercase tracking-wider">Simulated Historical Trajectory</span>
          <h2 class="font-headline-md text-2xl font-bold text-primary tracking-tight" id="dashChartTitle">Historical AQI Trend (${escapeHtml(state.historicalRange.toUpperCase())})</h2>
        </div>
        <div class="flex items-center gap-1 p-1 bg-surface-container-low border border-border-subtle rounded-full self-start md:self-auto">
          ${['24h', '7d', '30d', '90d']
            .map(
              (r) =>
                `<button type="button" data-range="${r}" class="dash-range-btn px-4 py-1.5 rounded-full font-title-card text-xs transition-colors ${
                  state.historicalRange === r
                    ? 'bg-surface-white text-primary font-bold shadow-xs'
                    : 'text-text-muted hover:text-on-surface'
                }">${r.toUpperCase()}</button>`
            )
            .join('')}
        </div>
      </div>
      <div id="dashChartContainer" class="relative w-full h-72 pt-2">${chartData.html}</div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 bg-surface-white rounded-2xl p-6 border border-border-subtle shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <span class="font-label-micro text-xs text-secondary font-bold uppercase tracking-wider">Monitoring Network</span>
              <h2 class="font-headline-md text-xl font-bold text-primary tracking-tight">Nearby &amp; Regional Stations</h2>
            </div>
            <button type="button" id="dashExportCsvBtn" class="px-3.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-primary font-label-micro text-xs font-semibold border border-border-subtle transition-colors flex items-center gap-1.5 self-start sm:self-auto">
              ${renderIcon('download', 'w-4 h-4')}
              <span>Download CSV</span>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="font-label-micro text-[11px] text-text-muted uppercase border-b border-border-subtle">
                  <th class="py-3 px-3">Station Node</th>
                  <th class="py-3 px-3">AQI Status</th>
                  <th class="py-3 px-3 text-right">PM2.5</th>
                  <th class="py-3 px-3 text-right">PM10</th>
                  <th class="py-3 px-3 text-right">Dominant</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle/50 font-body-sm text-sm">
                ${stationRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="lg:col-span-5 bg-primary text-white rounded-2xl p-6 lg:p-7 border border-primary/20 shadow-md flex flex-col justify-between relative overflow-hidden">
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-aqi-good">
                ${renderIcon('auto_awesome', 'w-4 h-4')}
              </span>
              <div>
                <h2 class="font-title-card text-base font-bold text-white leading-none">AIRINDX Environmental Briefing</h2>
                <span class="font-label-micro text-[10px] text-white/70">Grounded in ${escapeHtml(station.stationId)}</span>
              </div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-aqi-good text-primary font-label-micro text-[11px] font-bold">Simulated</span>
          </div>

          <div id="dashBriefingBox" class="p-4 rounded-xl bg-abyssal-pine/80 border border-white/10 space-y-2 text-xs text-white/90 leading-relaxed">
            <div class="font-label-micro text-aqi-good uppercase font-bold">Observed Conditions</div>
            <p>${escapeHtml(station.city)} (${escapeHtml(station.name)}) reports ${escapeHtml(aqiVal ?? 'N/A')} ${escapeHtml(stdLabel)} (${escapeHtml(catLabel)}), led by ${escapeHtml(domMeta.symbol)} at ${escapeHtml(domReading?.value ?? 'N/A')} ${escapeHtml(domReading?.unit || '')}.</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <button type="button" data-quick-q="Is it safe to exercise outdoors right now?" class="dash-quick-q w-full text-left px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-body-sm text-xs transition-colors flex items-center justify-between">
              <span>Is outdoor exercise safe right now?</span>
              ${renderIcon('arrow_forward', 'w-4 h-4')}
            </button>
            <button type="button" data-quick-q="What are the 24-hour historical trends for this station?" class="dash-quick-q w-full text-left px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-body-sm text-xs transition-colors flex items-center justify-between">
              <span>Explain today's 24-hour trend</span>
              ${renderIcon('arrow_forward', 'w-4 h-4')}
            </button>
          </div>
        </div>

        <form id="dashCopilotForm" class="pt-4 space-y-2">
          <div class="flex items-center gap-2 p-1.5 rounded-full bg-white/10 border border-white/15 focus-within:border-aqi-good/60 transition-colors">
            <label for="dashCopilotInput" class="sr-only">Ask about this station's air quality</label>
            <input id="dashCopilotInput" class="w-full bg-transparent px-3 py-1 text-white font-body-sm text-xs placeholder:text-white/60 outline-none" placeholder="Ask about this station's air quality..." type="text" maxlength="300" />
            <button type="submit" aria-label="Submit question" class="w-8 h-8 rounded-full bg-aqi-good text-primary flex items-center justify-center hover:opacity-90 flex-shrink-0" title="Ask AIRINDX">
              ${renderIcon('arrow_upward', 'w-4 h-4')}
            </button>
          </div>
          <p class="font-label-micro text-[10px] text-white/70">General environmental info only, not medical advice.</p>
        </form>
      </div>
    </div>
  `;

  // Dynamically load Three.js GlobeScene only on dashboard/map views
  const { mountGlobeScene } = await import('../components/GlobeScene.js');
  const globeMount = container.querySelector('#dashboardGlobeMount');
  const globeCleanup = globeMount
    ? mountGlobeScene(globeMount, globeStations, { focusLat: station.lat, focusLon: station.lon })
    : () => {};

  // Globe mode buttons
  container.querySelectorAll('.globe-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.globe-mode-btn').forEach((b) => {
        b.className = 'globe-mode-btn flex-1 py-1.5 text-center font-title-card text-xs rounded-lg text-white/80 hover:text-white transition-colors';
      });
      btn.className = 'globe-mode-btn flex-1 py-1.5 text-center font-title-card text-xs rounded-lg bg-aqi-good text-primary font-bold shadow-sm transition-all';
      if (typeof globeCleanup.setMode === 'function') {
        globeCleanup.setMode(btn.getAttribute('data-globe-mode'));
      }
    });
  });

  // Station selector chips & keyboard-accessible table rows
  const onSelectStation = (el) => {
    const stId = el.getAttribute('data-station-id');
    const cId = el.getAttribute('data-city-id');
    if (stId) appState.selectStation(stId, cId);
  };
  container.querySelectorAll('.station-chip, .station-row').forEach((el) => {
    el.addEventListener('click', () => onSelectStation(el));
    if (el.classList.contains('station-row')) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectStation(el);
        }
      });
    }
  });

  // Historical timeframe switcher inside dashboard
  container.querySelectorAll('.dash-range-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextRange = btn.getAttribute('data-range');
      appState.setState({ historicalRange: nextRange });
      container.querySelectorAll('.dash-range-btn').forEach((b) => {
        b.className =
          b.getAttribute('data-range') === nextRange
            ? 'dash-range-btn px-4 py-1.5 rounded-full font-title-card text-xs bg-surface-white text-primary font-bold shadow-xs'
            : 'dash-range-btn px-4 py-1.5 rounded-full font-title-card text-xs text-text-muted hover:text-on-surface';
      });
      const updatedHist = await apiClient.getHistoricalAQI({
        stationId: station.stationId,
        range: nextRange,
        standard: state.aqiStandard,
        metric: 'aqi',
      });
      const nextChart = buildLineSeriesChart({
        series: updatedHist.series,
        unitLabel: stdLabel,
        showWindOverlay: true,
      });
      const chartBox = container.querySelector('#dashChartContainer');
      const titleEl = container.querySelector('#dashChartTitle');
      if (chartBox) chartBox.innerHTML = nextChart.html;
      if (titleEl) titleEl.textContent = `Historical AQI Trend (${nextRange.toUpperCase()})`;
    });
  });

  // CSV Export
  container.querySelector('#dashExportCsvBtn')?.addEventListener('click', () => {
    const headers = ['Station ID', 'Station Name', 'City', 'Standard', 'AQI', 'Category', 'Dominant', 'PM2.5 (ug/m3)', 'PM10 (ug/m3)', 'Data Type', 'Timestamp'];
    const rows = nearbyList.map((s) => [
      s.stationId,
      s.name,
      s.city,
      s.methodology,
      s.aqi ?? 'N/A',
      s.category?.label || 'Unavailable',
      s.dominantPollutant || 'N/A',
      s.pollutants.pm25?.value ?? 'N/A',
      s.pollutants.pm10?.value ?? 'N/A',
      s.dataType,
      s.timestamp,
    ]);
    downloadCsvFile(`airindx-${station.cityId}-stations.csv`, headers, rows);
  });

  // Inline Copilot quick questions & form
  const runBriefingQuestion = async (questionText) => {
    const box = container.querySelector('#dashBriefingBox');
    if (!box) return;
    box.innerHTML = '<div class="font-label-micro text-xs text-aqi-good">Analyzing station telemetry...</div>';
    try {
      const res = await apiClient.sendAIMessage({
        query: questionText,
        stationId: station.stationId,
        standard: state.aqiStandard,
      });
      if (res.status === 'error') {
        box.innerHTML = `<p class="text-aqi-poor">${escapeHtml(res.message)}</p>`;
        return;
      }
      box.innerHTML = `
        <div class="font-label-micro text-aqi-good uppercase font-bold">Observed &amp; Interpreted</div>
        <p>${escapeHtml(res.sections.observedConditions)}</p>
        <p class="text-white/80">${escapeHtml(res.sections.recommendations)}</p>
      `;
    } catch {
      box.innerHTML = '<p class="text-aqi-poor">Copilot request failed. Please retry.</p>';
    }
  };

  container.querySelectorAll('.dash-quick-q').forEach((btn) => {
    btn.addEventListener('click', () => runBriefingQuestion(btn.getAttribute('data-quick-q')));
  });

  container.querySelector('#dashCopilotForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#dashCopilotInput');
    const q = input?.value?.trim();
    if (!q) return;
    input.value = '';
    runBriefingQuestion(q);
  });

  const cleanup = () => {
    if (typeof globeCleanup === 'function') globeCleanup();
  };
  registerContainerCleanup(container, cleanup);
  return cleanup;
}
