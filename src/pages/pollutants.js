/**
 * Page 3 — Pollutants & Chemical Speciation
 * Displays all 8 CPCB pollutants (PM2.5, PM10, NO2, SO2, CO, O3, NH3, Pb),
 * concentration & unit, sub-index where calculable, averaging period, sources,
 * health implications, individual pollutant detail panel, WHO 2021 benchmarks,
 * and an interactive abatement demonstration simulator.
 */

import { apiClient } from '../services/apiClient.js';
import { appState } from '../state/appState.js';
import {
  AQI_STANDARDS,
  calculateAQIByStandard,
  convertConcentration,
} from '../data/aqiStandards.js';
import { buildLineSeriesChart, buildSparklineSvg } from '../components/Charts.js';
import { renderLoadingState, renderErrorState, renderProvenanceStrip } from '../components/States.js';
import { escapeHtml } from '../utils/sanitize.js';

export async function renderPollutants(container) {
  container.innerHTML = renderLoadingState('Loading pollutant speciation & sub-index breakdown...');
  const state = appState.getState();

  let pollPayload;
  let histPayload;
  try {
    [pollPayload, histPayload] = await Promise.all([
      apiClient.getPollutants({
        stationId: state.selectedStationId,
        cityId: state.selectedCityId,
        standard: state.aqiStandard,
      }),
      apiClient.getHistoricalAQI({
        stationId: state.selectedStationId,
        range: '24h',
        standard: state.aqiStandard,
        metric: state.selectedPollutant,
      }),
    ]);
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Unable to Load Pollutant Data',
      message: err.message,
      retryId: 'retryPollutantsBtn',
    });
    container.querySelector('#retryPollutantsBtn')?.addEventListener('click', () => renderPollutants(container));
    return () => {};
  }

  const pollutants = pollPayload.pollutants || [];
  const selectedId = pollutants.some((p) => p.id === state.selectedPollutant)
    ? state.selectedPollutant
    : 'pm25';
  const activePollutant = pollutants.find((p) => p.id === selectedId) || pollutants[0];
  const stdLabel =
    pollPayload.standard === AQI_STANDARDS.US_EPA ? 'US EPA AQI (May 2024)' : 'India CPCB NAQI';

  const detailChart = buildLineSeriesChart({
    series: histPayload.series,
    unitLabel: activePollutant?.unit || 'µg/m³',
    thresholds: [],
  });

  const cardsHtml = pollutants
    .map((p) => {
      const isSelected = p.id === activePollutant.id;
      const subBadge = p.subIndexAvailable
        ? `${p.subIndex} Sub-Index`
        : p.subIndexReason === 'UNSUPPORTED_POLLUTANT'
        ? 'Not in US EPA'
        : 'Unavailable';
      const badgeColor = p.subIndexCategory?.hex || '#D5E5DC';
      const sparkVals = histPayload.series.map((pt) => pt.pollutants?.[p.id]?.value ?? 0);

      let whoNote = 'No WHO 2021 24h guideline';
      if (p.whoGuideline && typeof p.concentration === 'number') {
        const refVal = p.whoGuideline.guideline24h || p.whoGuideline.guideline8h;
        const converted =
          p.unit === p.whoGuideline.unit
            ? p.concentration
            : convertConcentration(p.id, p.concentration, p.unit, p.whoGuideline.unit);
        if (typeof converted === 'number' && refVal) {
          whoNote = `WHO 2021 ref: ${refVal} ${p.whoGuideline.unit} (${Math.round((converted / refVal) * 100)}%)`;
        }
      }

      return `
        <article tabindex="0" role="button" aria-pressed="${isSelected}" data-pollutant-id="${escapeHtml(p.id)}" class="pollutant-card cursor-pointer flex flex-col justify-between bg-surface-white rounded-2xl p-5 border transition-all ${
          isSelected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border-subtle shadow-sm hover:shadow-md'
        }">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="font-headline-sm text-lg font-bold text-primary">${escapeHtml(p.symbol)}</h2>
                <p class="font-body-sm text-xs text-text-muted">${escapeHtml(p.name)}</p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full font-label-micro text-[11px] font-semibold" style="background-color: ${escapeHtml(badgeColor)}33; color: #172B25;">
                ${escapeHtml(subBadge)}
              </span>
            </div>

            <div class="flex items-baseline justify-between">
              <div>
                <span class="font-telemetry-num-lg text-3xl font-bold text-primary">${escapeHtml(p.concentration ?? 'N/A')}</span>
                <span class="font-label-micro text-xs text-text-muted ml-1">${escapeHtml(p.unit)}</span>
              </div>
              <span class="font-label-micro text-[11px] text-text-muted">${escapeHtml(p.averagingPeriod)}</span>
            </div>

            <div class="h-10 w-full">${buildSparklineSvg(sparkVals, 'text-secondary')}</div>
            <div class="text-xs font-label-micro text-text-muted">${escapeHtml(whoNote)}</div>
          </div>
          <div class="pt-3 mt-3 border-t border-border-subtle flex items-center justify-between font-label-micro text-[11px]">
            <span class="text-text-muted">${escapeHtml(p.subIndexCategory?.label || 'Reference Parameter')}</span>
            <span class="text-secondary font-semibold">${isSelected ? 'Viewing Details' : 'Inspect →'}</span>
          </div>
        </article>
      `;
    })
    .join('');

  // Base readings for simulator
  const baseReadings = {};
  pollutants.forEach((p) => {
    if (typeof p.concentration === 'number') {
      baseReadings[p.id] = { value: p.concentration, unit: p.unit };
    }
  });

  container.innerHTML = `
    <section class="space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div class="space-y-2">
          <span class="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-micro text-xs uppercase font-semibold">
            8-Parameter Speciation &amp; Standards
          </span>
          <h1 class="font-headline-lg text-headline-md sm:text-headline-lg text-primary font-bold tracking-tight">
            Pollutant Chemistry &amp; AQI Sub-Index Analysis
          </h1>
          ${renderProvenanceStrip({
            dataType: pollPayload.dataType,
            source: pollPayload.source,
            timestamp: pollPayload.timestamp,
            standard: stdLabel,
          })}
        </div>
        <div class="p-3.5 rounded-xl bg-surface-white border border-border-subtle font-label-micro text-xs">
          <span class="text-text-muted block">Selected Station Overall (${escapeHtml(stdLabel)}):</span>
          <strong class="text-primary text-base">${escapeHtml(pollPayload.overallAqi ?? 'N/A')} — ${escapeHtml(pollPayload.overallCategory?.label || 'Unavailable')}</strong>
          <span class="text-text-muted block">Dominant: ${escapeHtml(pollPayload.dominantPollutant || '—')}</span>
        </div>
      </div>

      <div class="p-4 rounded-xl bg-surface-container-low border border-border-subtle font-body-sm text-xs text-on-surface leading-relaxed">
        <strong>Scientific Distinction:</strong> Pollutant <em>concentration</em> (in µg/m³ or mg/m³) measures physical mass in air. The <em>sub-index</em> maps concentration onto a 0–500 scale under either <strong>CPCB NAQI</strong> (8 pollutants; NH₃ and Pb included) or <strong>US EPA</strong> (6 pollutants). <strong>WHO 2021 guidelines</strong> are health-based concentration benchmarks, not an AQI scale.
      </div>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      ${cardsHtml}
    </section>

    <!-- Individual Pollutant Detail View -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-surface-white rounded-2xl p-6 sm:p-8 border border-border-subtle shadow-sm">
      <div class="lg:col-span-5 space-y-4">
        <div class="flex items-center justify-between">
          <span class="font-label-micro text-xs uppercase text-secondary font-bold">Individual Pollutant Detail</span>
          <span class="font-label-micro text-xs text-text-muted">${escapeHtml(activePollutant.averagingPeriod)}</span>
        </div>
        <h2 class="font-headline-md text-2xl font-bold text-primary">
          ${escapeHtml(activePollutant.symbol)} — ${escapeHtml(activePollutant.name)}
        </h2>
        <div class="p-4 rounded-xl bg-pearl-bg border border-border-subtle flex items-baseline justify-between">
          <div>
            <span class="font-label-micro text-xs text-text-muted block">Current Concentration</span>
            <span class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(activePollutant.concentration ?? 'N/A')}</span>
            <span class="font-label-micro text-xs text-text-muted ml-1">${escapeHtml(activePollutant.unit)}</span>
          </div>
          <div class="text-right">
            <span class="font-label-micro text-xs text-text-muted block">${escapeHtml(stdLabel)} Sub-Index</span>
            <strong class="font-telemetry-num-md text-2xl text-primary">${escapeHtml(activePollutant.subIndexAvailable ? activePollutant.subIndex : 'N/A')}</strong>
          </div>
        </div>
        <div class="space-y-2">
          <h3 class="font-title-card text-sm font-bold text-primary">Primary Emission Sources</h3>
          <ul class="list-disc pl-5 text-xs text-text-muted space-y-1">
            ${activePollutant.sources.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
        <div class="space-y-1">
          <h3 class="font-title-card text-sm font-bold text-primary">Health Impact Explanation (General Info)</h3>
          <p class="font-body-sm text-xs text-text-muted leading-relaxed">${escapeHtml(activePollutant.healthEffects)}</p>
        </div>
      </div>

      <div class="lg:col-span-7 flex flex-col justify-between space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-title-card text-sm font-bold text-primary">24-Hour Simulated Concentration Trend (${escapeHtml(activePollutant.symbol)})</h3>
          <span class="font-label-micro text-xs text-text-muted">Unit: ${escapeHtml(activePollutant.unit)}</span>
        </div>
        <div class="w-full h-64 bg-pearl-bg rounded-xl p-3 border border-border-subtle">
          ${detailChart.html}
        </div>
      </div>
    </section>

    <!-- Abatement Simulator -->
    <section class="bg-surface-white rounded-2xl p-6 sm:p-8 border border-border-subtle shadow-sm space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span class="px-2.5 py-1 rounded bg-primary text-aqi-good font-label-micro text-xs font-semibold uppercase">Simulated Scenario Model</span>
          <h2 class="font-headline-md text-xl font-bold text-primary mt-2">Emission Reduction What-If Calculator</h2>
          <p class="font-body-sm text-xs text-text-muted">Applies proportional concentration reductions and recalculates ${escapeHtml(stdLabel)} directly through the official breakpoint engine.</p>
        </div>
        <div class="p-4 rounded-xl bg-primary text-white flex items-center gap-6">
          <div>
            <span class="font-label-micro text-[10px] text-white/70 uppercase block">Simulated AQI</span>
            <span id="simProjectedAqi" class="font-telemetry-num-lg text-3xl font-bold text-aqi-good">${escapeHtml(pollPayload.overallAqi ?? 'N/A')}</span>
          </div>
          <div class="h-10 w-px bg-white/20"></div>
          <div>
            <span class="font-label-micro text-[10px] text-white/70 uppercase block">Category</span>
            <span id="simProjectedCat" class="font-title-card text-sm font-bold text-white">${escapeHtml(pollPayload.overallCategory?.label || '—')}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-2">
          <div class="flex justify-between font-title-card text-xs font-semibold text-primary">
            <label for="simPmSlider">Particulate (PM2.5 &amp; PM10) Reduction</label>
            <span id="simPmVal" class="font-label-micro text-secondary">0%</span>
          </div>
          <input id="simPmSlider" type="range" min="0" max="80" step="5" value="0" class="w-full accent-secondary cursor-pointer" />
        </div>
        <div class="space-y-2">
          <div class="flex justify-between font-title-card text-xs font-semibold text-primary">
            <label for="simGasSlider">Precursor Gas (NO₂, SO₂, CO, O₃) Reduction</label>
            <span id="simGasVal" class="font-label-micro text-secondary">0%</span>
          </div>
          <input id="simGasSlider" type="range" min="0" max="80" step="5" value="0" class="w-full accent-secondary cursor-pointer" />
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll('.pollutant-card').forEach((card) => {
    const selectCard = () => {
      const id = card.getAttribute('data-pollutant-id');
      if (id) {
        appState.setState({ selectedPollutant: id });
        renderPollutants(container);
      }
    };
    card.addEventListener('click', selectCard);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard();
      }
    });
  });

  const pmSlider = container.querySelector('#simPmSlider');
  const gasSlider = container.querySelector('#simGasSlider');
  const updateSim = () => {
    const pmPct = Number(pmSlider?.value || 0);
    const gasPct = Number(gasSlider?.value || 0);
    const pmLabel = container.querySelector('#simPmVal');
    const gasLabel = container.querySelector('#simGasVal');
    if (pmLabel) pmLabel.textContent = `-${pmPct}%`;
    if (gasLabel) gasLabel.textContent = `-${gasPct}%`;

    const adjusted = {};
    for (const [k, v] of Object.entries(baseReadings)) {
      const factor = k === 'pm25' || k === 'pm10' ? 1 - pmPct / 100 : 1 - gasPct / 100;
      adjusted[k] = { value: Number((v.value * factor).toFixed(2)), unit: v.unit };
    }
    const evalRes = calculateAQIByStandard(adjusted, pollPayload.standard);
    const aqiEl = container.querySelector('#simProjectedAqi');
    const catEl = container.querySelector('#simProjectedCat');
    if (aqiEl) aqiEl.textContent = evalRes.aqi ?? 'N/A';
    if (catEl) catEl.textContent = evalRes.category?.label || 'Unavailable';
  };

  pmSlider?.addEventListener('input', updateSim);
  gasSlider?.addEventListener('input', updateSim);

  return () => {};
}
