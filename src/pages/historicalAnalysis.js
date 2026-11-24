/**
 * Page 4 — Historical Analysis
 * Functional 24H, 7D, 30D, 90D, and 365D timeframes, custom date range,
 * metric filters, real curve-aligned interactive hover scrubber, anomaly detection,
 * diurnal cycle matrix, and client-side CSV export.
 */

import { apiClient } from '../services/apiClient.js';
import { appState } from '../state/appState.js';
import { AQI_STANDARDS } from '../data/aqiStandards.js';
import { STATIONS } from '../data/mock/index.js';
import { buildLineSeriesChart } from '../components/Charts.js';
import { renderIcon } from '../components/Icons.js';
import { renderLoadingState, renderErrorState, renderProvenanceStrip } from '../components/States.js';
import { escapeHtml } from '../utils/sanitize.js';
import { downloadCsvFile } from '../utils/exportCsv.js';

export async function renderHistoricalAnalysis(container) {
  container.innerHTML = renderLoadingState('Loading historical telemetry series...');
  const state = appState.getState();

  let histPayload;
  let diurnal24h;
  try {
    [histPayload, diurnal24h] = await Promise.all([
      apiClient.getHistoricalAQI({
        stationId: state.selectedStationId,
        range: state.historicalRange,
        standard: state.aqiStandard,
        metric: state.historicalMetric,
        startDate: state.dateRange.start,
        endDate: state.dateRange.end,
      }),
      apiClient.getHistoricalAQI({
        stationId: state.selectedStationId,
        range: '24h',
        standard: state.aqiStandard,
        metric: 'aqi',
      }),
    ]);
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Unable to Load Historical Analysis',
      message: err.message,
      retryId: 'retryHistoryBtn',
    });
    container.querySelector('#retryHistoryBtn')?.addEventListener('click', () => renderHistoricalAnalysis(container));
    return () => {};
  }

  const stdLabel =
    histPayload.standard === AQI_STANDARDS.US_EPA ? 'US EPA AQI' : 'CPCB NAQI';
  const metricUnit = histPayload.series[0]?.unit || stdLabel;
  const chartData = buildLineSeriesChart({
    series: histPayload.series,
    unitLabel: metricUnit,
    showWindOverlay: state.historicalMetric === 'aqi',
    thresholds:
      state.historicalMetric === 'aqi'
        ? [
            { value: 50, label: '50 Good', color: '#237A5B' },
            { value: 100, label: '100', color: '#F2C94C' },
            { value: 200, label: '200', color: '#F2994A' },
            { value: 300, label: '300', color: '#EB5757' },
          ]
        : [],
  });

  const timeframes = [
    { key: '24h', label: 'Hourly (24H)' },
    { key: '7d', label: 'Daily (7D)' },
    { key: '30d', label: 'Monthly (30D)' },
    { key: '90d', label: '90 Days' },
    { key: '365d', label: 'Yearly (365D)' },
  ];

  const metrics = [
    { key: 'aqi', label: `AQI (${stdLabel})` },
    { key: 'pm25', label: 'PM2.5 (µg/m³)' },
    { key: 'pm10', label: 'PM10 (µg/m³)' },
    { key: 'no2', label: 'NO2 (µg/m³)' },
    { key: 'o3', label: 'O3 (µg/m³)' },
    { key: 'wind', label: 'Wind Speed (km/h)' },
  ];

  const stationOptions = STATIONS.map(
    (st) =>
      `<option value="${escapeHtml(st.stationId)}" ${
        st.stationId === histPayload.stationId ? 'selected' : ''
      }>${escapeHtml(st.city)} — ${escapeHtml(st.name)}</option>`
  ).join('');

  const diurnalCellsHtml = diurnal24h.series
    .map((pt) => {
      const bg = pt.category?.hex || '#B9ED73';
      return `
        <div class="flex flex-col items-center p-2 rounded-lg bg-surface-container-low">
          <span class="font-label-micro text-[10px] text-text-muted">${escapeHtml(pt.label.slice(0, 2))}h</span>
          <div class="w-full h-8 rounded mt-1 flex items-center justify-center font-label-micro text-[10px] text-on-surface font-bold" style="background-color: ${escapeHtml(bg)}40;">
            ${escapeHtml(pt.aqi ?? '—')}
          </div>
        </div>
      `;
    })
    .join('');

  const anomaliesHtml =
    histPayload.anomalies.length > 0
      ? histPayload.anomalies
          .map(
            (a) => `
          <div class="p-3 rounded-xl bg-pearl-bg border border-border-subtle flex items-center justify-between gap-2">
            <div>
              <strong class="font-title-card text-xs text-primary block">${escapeHtml(a.label)} (${escapeHtml(a.dateIso)})</strong>
              <span class="font-body-sm text-xs text-text-muted">${escapeHtml(a.note)}</span>
            </div>
            <span class="font-telemetry-num-md text-sm font-bold text-error">${escapeHtml(a.value)} ${escapeHtml(a.unit)}</span>
          </div>`
          )
          .join('')
      : '<p class="font-body-sm text-xs text-text-muted">No extreme spikes (&gt;22% above mean) detected in this window.</p>';

  container.innerHTML = `
    <section class="rounded-2xl bg-surface-white p-6 md:p-8 border border-border-subtle shadow-sm space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div class="space-y-2">
          <h1 class="font-headline-lg text-headline-md sm:text-headline-lg text-primary font-bold tracking-tight">
            Historical Air Quality Analysis
          </h1>
          ${renderProvenanceStrip({
            dataType: histPayload.dataType,
            source: histPayload.source,
            timestamp: histPayload.timestamp,
            standard: `${stdLabel} • ${histPayload.averagingPeriod}`,
          })}
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <select id="histStationSelect" aria-label="Select Station" class="bg-surface-container-low border border-border-subtle rounded-xl px-3.5 py-2 font-body-sm text-xs text-on-surface">
            ${stationOptions}
          </select>
          <button type="button" id="histExportCsvBtn" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-aqi-good font-title-card text-xs font-semibold hover:bg-abyssal-pine transition-colors">
            ${renderIcon('download', 'w-4 h-4')}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
        <div class="xl:col-span-7 flex flex-wrap items-center gap-1.5 bg-surface-container-low p-1.5 rounded-xl">
          ${timeframes
            .map(
              (tf) =>
                `<button type="button" data-tf="${tf.key}" class="hist-tf-btn px-3.5 py-2 rounded-lg font-title-card text-xs transition-all ${
                  state.historicalRange === tf.key
                    ? 'bg-primary text-aqi-good font-semibold shadow-sm'
                    : 'text-text-muted hover:text-on-surface hover:bg-surface-white'
                }">${tf.label}</button>`
            )
            .join('')}
        </div>

        <div class="xl:col-span-5 flex flex-wrap items-center gap-2 xl:justify-end">
          <label class="font-label-micro text-[11px] text-text-muted" for="histStartDate">From</label>
          <input id="histStartDate" type="date" value="${escapeHtml(state.dateRange.start)}" class="bg-pearl-bg border border-border-subtle rounded-lg px-2.5 py-1.5 font-label-micro text-xs text-on-surface" />
          <label class="font-label-micro text-[11px] text-text-muted" for="histEndDate">To</label>
          <input id="histEndDate" type="date" value="${escapeHtml(state.dateRange.end)}" class="bg-pearl-bg border border-border-subtle rounded-lg px-2.5 py-1.5 font-label-micro text-xs text-on-surface" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="font-label-micro text-xs text-text-muted uppercase mr-1">Metric:</span>
        ${metrics
          .map(
            (m) =>
              `<button type="button" data-metric="${m.key}" class="hist-metric-btn px-3 py-1.5 rounded-lg font-label-micro text-xs transition-all ${
                state.historicalMetric === m.key
                  ? 'bg-surface-container text-primary font-bold shadow-xs'
                  : 'bg-surface-container-low text-text-muted hover:text-on-surface'
              }">${escapeHtml(m.label)}</button>`
          )
          .join('')}
      </div>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-surface-white border border-border-subtle shadow-sm">
        <span class="font-label-micro text-xs text-text-muted uppercase">Window Mean</span>
        <div class="font-telemetry-num-lg text-3xl font-bold text-primary mt-1">${escapeHtml(histPayload.summary.mean ?? 'N/A')} <span class="text-xs font-normal text-text-muted">${escapeHtml(metricUnit)}</span></div>
      </div>
      <div class="p-5 rounded-2xl bg-surface-white border border-border-subtle shadow-sm">
        <span class="font-label-micro text-xs text-text-muted uppercase">Peak Reading</span>
        <div class="font-telemetry-num-lg text-3xl font-bold text-error mt-1">${escapeHtml(histPayload.summary.max ?? 'N/A')} <span class="text-xs font-normal text-text-muted">(${escapeHtml(histPayload.summary.peakLabel)})</span></div>
      </div>
      <div class="p-5 rounded-2xl bg-surface-white border border-border-subtle shadow-sm">
        <span class="font-label-micro text-xs text-text-muted uppercase">Lowest Reading</span>
        <div class="font-telemetry-num-lg text-3xl font-bold text-secondary mt-1">${escapeHtml(histPayload.summary.min ?? 'N/A')} <span class="text-xs font-normal text-text-muted">(${escapeHtml(histPayload.summary.minLabel)})</span></div>
      </div>
    </section>

    <section class="rounded-2xl bg-surface-white p-6 md:p-8 border border-border-subtle shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="font-headline-md text-xl font-bold text-primary">${escapeHtml(histPayload.stationName)} — ${escapeHtml(state.historicalRange.toUpperCase())} Trend</h2>
          <p class="font-label-micro text-xs text-text-muted">Hover over the chart to inspect individual data points • Unit: ${escapeHtml(metricUnit)}</p>
        </div>
        <div id="histHoverReadout" class="px-3 py-1.5 rounded-lg bg-abyssal-pine text-aqi-good font-label-micro text-xs">
          Hover chart to inspect point
        </div>
      </div>
      <div id="histChartWrap" class="relative w-full h-80 bg-pearl-bg rounded-xl p-4 border border-border-subtle">
        ${chartData.html}
      </div>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 rounded-2xl bg-surface-white p-6 border border-border-subtle shadow-sm space-y-4">
        <h2 class="font-headline-sm text-primary font-bold">24-Hour Diurnal Cycle (${escapeHtml(stdLabel)})</h2>
        <div class="grid grid-cols-6 sm:grid-cols-12 gap-1.5">${diurnalCellsHtml}</div>
      </div>
      <div class="lg:col-span-5 rounded-2xl bg-surface-white p-6 border border-border-subtle shadow-sm space-y-4">
        <h2 class="font-headline-sm text-primary font-bold">Detected Historical Anomalies</h2>
        <div class="space-y-2.5">${anomaliesHtml}</div>
      </div>
    </section>
  `;

  // Curve-aligned interactive hover scrubber
  const svgEl = container.querySelector('#histChartWrap svg');
  const readoutEl = container.querySelector('#histHoverReadout');
  if (svgEl && chartData.plottedPoints.length > 0) {
    const scrubLine = svgEl.querySelector('[data-scrubber-line]');
    const scrubDot = svgEl.querySelector('[data-scrubber-dot]');
    svgEl.addEventListener('mousemove', (e) => {
      const rect = svgEl.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 960;
      let nearest = chartData.plottedPoints[0];
      let minDist = Infinity;
      for (const pt of chartData.plottedPoints) {
        const d = Math.abs(pt.cx - relX);
        if (d < minDist) {
          minDist = d;
          nearest = pt;
        }
      }
      if (scrubLine && scrubDot) {
        scrubLine.setAttribute('x1', nearest.cx);
        scrubLine.setAttribute('x2', nearest.cx);
        scrubLine.setAttribute('opacity', '0.75');
        scrubDot.setAttribute('cx', nearest.cx);
        scrubDot.setAttribute('cy', nearest.cy);
        scrubDot.setAttribute('opacity', '1');
      }
      if (readoutEl) {
        readoutEl.textContent = `${nearest.label} (${nearest.dateIso}): ${nearest.value} ${nearest.unit}`;
      }
    });
    svgEl.addEventListener('mouseleave', () => {
      if (scrubLine) scrubLine.setAttribute('opacity', '0');
      if (scrubDot) scrubDot.setAttribute('opacity', '0');
    });
  }

  container.querySelector('#histStationSelect')?.addEventListener('change', (e) => {
    const st = STATIONS.find((s) => s.stationId === e.target.value);
    if (st) appState.selectStation(st.stationId, st.cityId);
  });

  container.querySelectorAll('.hist-tf-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.setState({ historicalRange: btn.getAttribute('data-tf') });
      renderHistoricalAnalysis(container);
    });
  });

  container.querySelectorAll('.hist-metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.setState({ historicalMetric: btn.getAttribute('data-metric') });
      renderHistoricalAnalysis(container);
    });
  });

  const onDateChange = () => {
    const start = container.querySelector('#histStartDate')?.value;
    const end = container.querySelector('#histEndDate')?.value;
    if (start && end && start <= end) {
      appState.setState({ dateRange: { start, end } });
      renderHistoricalAnalysis(container);
    }
  };
  container.querySelector('#histStartDate')?.addEventListener('change', onDateChange);
  container.querySelector('#histEndDate')?.addEventListener('change', onDateChange);

  container.querySelector('#histExportCsvBtn')?.addEventListener('click', () => {
    const headers = ['Label', 'Date', 'Station ID', 'Standard', 'Metric Value', 'Unit', 'AQI', 'PM2.5 (ug/m3)', 'PM10 (ug/m3)', 'Wind (km/h)', 'Data Type'];
    const rows = histPayload.series.map((pt) => [
      pt.label,
      pt.dateIso,
      pt.stationId,
      pt.methodology,
      pt.value,
      pt.unit,
      pt.aqi ?? 'N/A',
      pt.pollutants?.pm25?.value ?? 'N/A',
      pt.pollutants?.pm10?.value ?? 'N/A',
      pt.windSpeedKmh,
      pt.dataType,
    ]);
    downloadCsvFile(`airindx-history-${histPayload.stationId}-${histPayload.range}.csv`, headers, rows);
  });

  return () => {};
}
