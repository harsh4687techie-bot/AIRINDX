/**
 * Page 7 — City Comparison
 * Add and remove cities dynamically, switch timeframe, compare AQI & pollutants
 * in consistent units under a single selected methodology, show rankings with
 * clear methodology notes, display source & timestamp, and export CSV.
 */

import { apiClient } from '../services/apiClient.js';
import { appState } from '../state/appState.js';
import { AQI_STANDARDS } from '../data/aqiStandards.js';
import { renderLoadingState, renderErrorState, renderEmptyState, renderProvenanceStrip } from '../components/States.js';
import { renderIcon } from '../components/Icons.js';
import { escapeHtml } from '../utils/sanitize.js';
import { downloadCsvFile } from '../utils/exportCsv.js';

export async function renderCityComparison(container) {
  container.innerHTML = renderLoadingState('Computing multi-city air quality comparison...');
  const state = appState.getState();

  let compPayload;
  try {
    compPayload = await apiClient.compareCities({
      cities: state.comparisonCityIds,
      timeframe: state.comparisonTimeframe,
      standard: state.aqiStandard,
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Unable to Load City Comparison',
      message: err.message,
      retryId: 'retryCompBtn',
    });
    container.querySelector('#retryCompBtn')?.addEventListener('click', () => renderCityComparison(container));
    return () => {};
  }

  const cities = compPayload.cities || [];
  const ranked = compPayload.ranked || [];
  const available = compPayload.availableCities || [];
  const addableCities = available.filter((c) => !state.comparisonCityIds.includes(c.cityId));
  const stdLabel =
    compPayload.standard === AQI_STANDARDS.US_EPA ? 'US EPA AQI (May 2024)' : 'India CPCB NAQI';

  const cityChipsHtml = cities
    .map((c) => {
      const hex = c.category?.hex || '#237A5B';
      return `
        <div class="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low text-on-surface text-xs font-title-card border border-border-subtle">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${escapeHtml(hex)};"></span>
          <span>${escapeHtml(c.city)}, ${escapeHtml(c.country)}</span>
          <strong class="font-label-micro">${escapeHtml(c.aqi ?? 'N/A')}</strong>
          <button type="button" data-remove-city="${escapeHtml(c.cityId)}" aria-label="Remove ${escapeHtml(c.city)}" class="comp-remove-btn min-w-7 min-h-7 rounded-full flex items-center justify-center hover:bg-surface-dim text-text-muted">
            ${renderIcon('close', 'w-3.5 h-3.5')}
          </button>
        </div>
      `;
    })
    .join('');

  const cityCardsHtml = cities
    .map((c) => {
      const hex = c.category?.hex || '#237A5B';
      return `
        <article class="bg-surface-white rounded-2xl border border-border-subtle shadow-sm p-6 flex flex-col justify-between relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1.5" style="background-color: ${escapeHtml(hex)};"></div>
          <div>
            <div class="flex items-start justify-between mb-3">
              <div>
                <h2 class="font-title-card text-xl font-bold text-primary">${escapeHtml(c.city)}</h2>
                <span class="font-label-micro text-[11px] text-text-muted">${escapeHtml(c.state)}, ${escapeHtml(c.country)} • ${escapeHtml(c.stationId)}</span>
              </div>
              <span class="px-2 py-0.5 rounded bg-aqi-moderate/20 font-label-micro text-[10px] font-semibold text-on-surface">Simulated</span>
            </div>

            <div class="flex items-baseline justify-between my-3 py-3 px-4 rounded-xl bg-pearl-bg border border-border-subtle">
              <div>
                <span class="font-label-micro text-[10px] text-text-muted uppercase block">${escapeHtml(stdLabel)}</span>
                <span class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(c.aqi ?? 'N/A')}</span>
              </div>
              <div class="text-right">
                <span class="px-2.5 py-1 rounded-full font-label-micro text-[11px] font-bold" style="background-color: ${escapeHtml(hex)}26; color: #172B25;">${escapeHtml(c.category?.label || 'Unavailable')}</span>
                <span class="font-label-micro text-[10px] text-text-muted block mt-1">Dom: ${escapeHtml(c.dominantPollutant || '—')}</span>
              </div>
            </div>

            <div class="space-y-2 text-xs font-label-micro">
              <div class="flex justify-between"><span class="text-text-muted">PM2.5</span><strong class="text-primary">${escapeHtml(c.pollutants.pm25?.value)} µg/m³</strong></div>
              <div class="flex justify-between"><span class="text-text-muted">PM10</span><strong class="text-primary">${escapeHtml(c.pollutants.pm10?.value)} µg/m³</strong></div>
              <div class="flex justify-between"><span class="text-text-muted">NO₂</span><strong class="text-primary">${escapeHtml(c.pollutants.no2?.value)} µg/m³</strong></div>
              <div class="flex justify-between"><span class="text-text-muted">O₃</span><strong class="text-primary">${escapeHtml(c.pollutants.o3?.value)} µg/m³</strong></div>
              <div class="flex justify-between"><span class="text-text-muted">Weather</span><strong class="text-secondary">${escapeHtml(c.weather.temperatureC)}°C • ${escapeHtml(c.weather.windSpeedKmh)} km/h</strong></div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-border-subtle font-label-micro text-[10px] text-text-muted space-y-0.5">
            <div>Source: ${escapeHtml(c.source)}</div>
            <div>Timestamp: ${escapeHtml(c.timestamp)}</div>
          </div>
        </article>
      `;
    })
    .join('');

  // Grouped SVG comparison chart for PM2.5 and PM10 in unified µg/m³
  const maxBar = Math.max(...cities.map((c) => c.pollutants.pm10?.value || 0), 100);
  const barChartRows = cities
    .map((c) => {
      const pm25Pct = Math.min(100, Math.round(((c.pollutants.pm25?.value || 0) / maxBar) * 100));
      const pm10Pct = Math.min(100, Math.round(((c.pollutants.pm10?.value || 0) / maxBar) * 100));
      return `
        <div class="space-y-1.5">
          <div class="flex justify-between font-label-micro text-xs">
            <span class="font-semibold text-primary">${escapeHtml(c.city)}</span>
            <span class="text-text-muted">PM2.5: <strong class="text-on-surface">${escapeHtml(c.pollutants.pm25?.value)} µg/m³</strong> • PM10: <strong class="text-on-surface">${escapeHtml(c.pollutants.pm10?.value)} µg/m³</strong></span>
          </div>
          <div class="space-y-1">
            <div class="w-full h-2.5 bg-pearl-bg rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full" style="width: ${pm25Pct}%"></div>
            </div>
            <div class="w-full h-2.5 bg-pearl-bg rounded-full overflow-hidden">
              <div class="h-full bg-secondary rounded-full" style="width: ${pm10Pct}%"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const rankingRowsHtml = ranked
    .map((c) => {
      const hex = c.category?.hex || '#237A5B';
      return `
        <tr class="hover:bg-surface-container-low/40 transition-colors">
          <td class="py-3 px-4 font-label-micro font-bold text-primary">#${escapeHtml(c.rankBestToWorst)}</td>
          <td class="py-3 px-4 font-title-card font-semibold text-primary">${escapeHtml(c.city)}, ${escapeHtml(c.country)}</td>
          <td class="py-3 px-4 font-telemetry-num-md font-bold text-primary text-right">${escapeHtml(c.aqi ?? 'N/A')}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full font-label-micro text-xs font-semibold" style="background-color: ${escapeHtml(hex)}26; color: #172B25;">${escapeHtml(c.category?.label || '—')}</span></td>
          <td class="py-3 px-4 font-label-micro text-xs">${escapeHtml(c.dominantPollutant || '—')}</td>
          <td class="py-3 px-4 font-label-micro text-xs text-right">${escapeHtml(c.pollutants.pm25?.value)} µg/m³</td>
          <td class="py-3 px-4 font-label-micro text-[11px] text-text-muted">${escapeHtml(c.methodology)}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <section class="flex flex-col gap-5">
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div class="space-y-2">
          <h1 class="font-headline-lg text-headline-md sm:text-headline-lg text-primary font-bold tracking-tight">
            Multi-City Air Quality Comparison
          </h1>
          ${renderProvenanceStrip({
            dataType: compPayload.dataType,
            source: compPayload.source,
            timestamp: compPayload.timestamp,
            standard: stdLabel,
          })}
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="bg-surface-container-low p-1 rounded-full flex items-center gap-1 border border-border-subtle">
            ${[
              { key: 'live', label: 'Snapshot' },
              { key: '24h', label: '24H Mean' },
              { key: '7d', label: '7D Mean' },
              { key: '30d', label: '30D Mean' },
            ]
              .map(
                (t) =>
                  `<button type="button" data-comp-tf="${t.key}" class="comp-tf-btn px-3.5 py-1.5 rounded-full font-title-card text-xs transition-all ${
                    state.comparisonTimeframe === t.key
                      ? 'bg-primary text-aqi-good font-semibold shadow-xs'
                      : 'text-text-muted hover:text-primary'
                  }">${t.label}</button>`
              )
              .join('')}
          </div>
          <button type="button" id="compExportCsvBtn" class="px-4 py-2 rounded-full bg-primary text-aqi-good font-title-card text-xs font-semibold flex items-center gap-1.5 hover:bg-abyssal-pine transition-colors">
            ${renderIcon('download', 'w-4 h-4')}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div class="bg-surface-white rounded-2xl border border-border-subtle shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div class="flex items-center flex-wrap gap-2">
          <span class="font-label-micro text-xs text-text-muted uppercase mr-1">Selected Cities:</span>
          ${cityChipsHtml || '<span class="text-xs text-text-muted">None selected</span>'}
        </div>
        <div class="flex items-center gap-2">
          <label for="compAddCitySelect" class="sr-only">Add City to Comparison</label>
          <select id="compAddCitySelect" class="bg-pearl-bg border border-border-subtle rounded-full px-3.5 py-1.5 text-xs text-on-surface" ${addableCities.length === 0 ? 'disabled' : ''}>
            ${
              addableCities.length > 0
                ? addableCities.map((c) => `<option value="${escapeHtml(c.cityId)}">${escapeHtml(c.name)}, ${escapeHtml(c.country)}</option>`).join('')
                : '<option value="">All cities added</option>'
            }
          </select>
          <button type="button" id="compAddCityBtn" class="px-4 py-1.5 rounded-full bg-primary text-aqi-good font-title-card text-xs font-semibold hover:bg-abyssal-pine disabled:opacity-40" ${addableCities.length === 0 ? 'disabled' : ''}>
            + Add City
          </button>
        </div>
      </div>
    </section>

    ${
      cities.length === 0
        ? renderEmptyState({
            title: 'No Cities Selected for Comparison',
            message: 'Select a city from the dropdown above to begin comparing air quality metrics.',
          })
        : `
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        ${cityCardsHtml}
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-6 bg-surface-white rounded-2xl border border-border-subtle shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-headline-sm text-primary font-bold">Particulate Concentration Comparison (µg/m³)</h2>
              <p class="font-label-micro text-xs text-text-muted">Unified gravimetric units across selected stations</p>
            </div>
            <div class="flex items-center gap-3 font-label-micro text-[11px]">
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-primary"></span> PM2.5</span>
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-secondary"></span> PM10</span>
            </div>
          </div>
          <div class="space-y-4 pt-2">${barChartRows}</div>
        </div>

        <div class="lg:col-span-6 bg-surface-white rounded-2xl border border-border-subtle shadow-sm p-6 space-y-4">
          <h2 class="font-headline-sm text-primary font-bold">Best vs. Worst Air Quality Indicators</h2>
          ${
            compPayload.bestCity && compPayload.worstCity
              ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="p-4 rounded-xl bg-surface-container-low border border-border-subtle">
                    <span class="font-label-micro text-[10px] uppercase text-secondary font-bold">Cleanest in Selection</span>
                    <div class="font-headline-sm text-xl font-bold text-primary mt-1">${escapeHtml(compPayload.bestCity.city)}</div>
                    <div class="font-telemetry-num-md text-2xl font-bold text-secondary">${escapeHtml(compPayload.bestCity.aqi ?? 'N/A')} <span class="text-xs font-normal">${escapeHtml(stdLabel)}</span></div>
                  </div>
                  <div class="p-4 rounded-xl bg-pearl-bg border border-border-subtle">
                    <span class="font-label-micro text-[10px] uppercase text-error font-bold">Highest Pollution Load</span>
                    <div class="font-headline-sm text-xl font-bold text-primary mt-1">${escapeHtml(compPayload.worstCity.city)}</div>
                    <div class="font-telemetry-num-md text-2xl font-bold text-error">${escapeHtml(compPayload.worstCity.aqi ?? 'N/A')} <span class="text-xs font-normal">${escapeHtml(stdLabel)}</span></div>
                  </div>
                </div>`
              : ''
          }
          <div class="p-3.5 rounded-xl bg-pearl-bg border border-border-subtle text-xs text-text-muted leading-relaxed">
            <strong class="text-primary">Ranking Methodology:</strong> ${escapeHtml(compPayload.rankingMethodology)}
          </div>
        </div>
      </section>

      <section class="bg-surface-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-5 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-headline-sm text-primary font-bold">City Rankings (Best to Worst under ${escapeHtml(stdLabel)})</h2>
          <span class="font-label-micro text-xs text-text-muted">Timestamp: ${escapeHtml(compPayload.timestamp)}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-pearl-bg text-text-muted font-label-micro text-xs uppercase">
                <th class="py-3 px-4">Rank</th>
                <th class="py-3 px-4">City</th>
                <th class="py-3 px-4 text-right">AQI</th>
                <th class="py-3 px-4">Category</th>
                <th class="py-3 px-4">Dominant</th>
                <th class="py-3 px-4 text-right">PM2.5</th>
                <th class="py-3 px-4">Standard</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">${rankingRowsHtml}</tbody>
          </table>
        </div>
      </section>
    `
    }
  `;

  container.querySelectorAll('.comp-tf-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.setState({ comparisonTimeframe: btn.getAttribute('data-comp-tf') });
      renderCityComparison(container);
    });
  });

  container.querySelector('#compAddCityBtn')?.addEventListener('click', () => {
    const select = container.querySelector('#compAddCitySelect');
    if (select?.value) {
      appState.addComparisonCity(select.value);
      renderCityComparison(container);
    }
  });

  container.querySelectorAll('.comp-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.removeComparisonCity(btn.getAttribute('data-remove-city'));
      renderCityComparison(container);
    });
  });

  container.querySelector('#compExportCsvBtn')?.addEventListener('click', () => {
    const headers = ['Rank', 'City', 'Country', 'Station ID', 'Standard', 'AQI', 'Category', 'Dominant', 'PM2.5 (ug/m3)', 'PM10 (ug/m3)', 'Source', 'Timestamp', 'Data Type'];
    const rows = ranked.map((c) => [
      c.rankBestToWorst,
      c.city,
      c.country,
      c.stationId,
      c.methodology,
      c.aqi ?? 'N/A',
      c.category?.label || 'Unavailable',
      c.dominantPollutant || 'N/A',
      c.pollutants.pm25?.value ?? 'N/A',
      c.pollutants.pm10?.value ?? 'N/A',
      c.source,
      c.timestamp,
      c.dataType,
    ]);
    downloadCsvFile(`airindx-city-comparison-${state.comparisonTimeframe}.csv`, headers, rows);
  });

  return () => {};
}
