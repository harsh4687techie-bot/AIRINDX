/**
 * Page 6 — AI Environmental Assistant
 * Grounded in the selected city/station's actual telemetry via apiClient.sendAIMessage().
 * Enforces structured sections (Observed Conditions, Interpretation, Recommendations,
 * Data Limitations), non-medical disclaimer, loading/error/retry/empty states,
 * and zero exposed LLM credentials.
 */

import { apiClient } from '../services/apiClient.js';
import { ENV } from '../config/env.js';
import { appState } from '../state/appState.js';
import { AQI_STANDARDS } from '../data/aqiStandards.js';
import { STATIONS, QUICK_PROMPTS } from '../data/mock/index.js';
import { renderLoadingState, renderProvenanceStrip } from '../components/States.js';
import { renderIcon } from '../components/Icons.js';
import { escapeHtml, sanitizeUserInput } from '../utils/sanitize.js';

function renderAssistantCards(conversation) {
  if (!conversation || conversation.length === 0) {
    return `
      <div class="p-8 rounded-2xl bg-pearl-bg border border-border-subtle text-center space-y-2 my-6" data-empty-chat>
        <span class="text-secondary inline-flex justify-center">${renderIcon('psychology_alt', 'w-8 h-8')}</span>
        <h2 class="font-headline-sm text-primary font-bold">Start a Grounded Environmental Inquiry</h2>
        <p class="font-body-sm text-xs text-text-muted max-w-md mx-auto">
          Ask about the attached station's AQI, dominant pollutant, exercise safety, 24-hour trends, or indoor exposure reduction. Responses cite observed simulated figures and do not invent readings.
        </p>
      </div>
    `;
  }

  return conversation
    .map((entry, idx) => {
      if (entry.role === 'user') {
        return `
          <div class="flex items-start justify-end gap-3">
            <div class="max-w-[82%] bg-surface-container-high rounded-2xl rounded-tr-none p-4 shadow-sm">
              <div class="flex items-center justify-between gap-4 mb-1">
                <span class="font-label-micro text-[11px] font-bold text-secondary uppercase">You</span>
                <span class="font-label-micro text-[10px] text-text-muted">${escapeHtml(entry.timeLabel)}</span>
              </div>
              <p class="font-body-md text-sm text-on-surface">${escapeHtml(entry.text)}</p>
            </div>
          </div>
        `;
      }

      if (entry.role === 'error') {
        return `
          <div class="flex items-start gap-3" role="alert">
            <div class="w-9 h-9 rounded-xl bg-error-container text-error flex items-center justify-center flex-shrink-0">
              ${renderIcon('error', 'w-5 h-5')}
            </div>
            <div class="max-w-[88%] bg-surface-white rounded-2xl rounded-tl-none p-4 border border-error/25 shadow-sm space-y-2">
              <p class="font-body-sm text-xs text-error font-semibold">${escapeHtml(entry.message)}</p>
              <button type="button" data-retry-query="${escapeHtml(entry.failedQuery)}" class="ai-retry-btn px-3 py-1 rounded-lg bg-primary text-aqi-good font-label-micro text-xs font-semibold">Retry Query</button>
            </div>
          </div>
        `;
      }

      const s = entry.response.sections;
      const ctx = entry.response.groundedContext;
      return `
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary text-aqi-good flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
            ${renderIcon('air', 'w-5 h-5')}
          </div>
          <div class="max-w-[92%] bg-surface-white rounded-2xl rounded-tl-none p-5 border border-border-subtle shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-label-micro text-xs font-semibold">
                Grounded: ${escapeHtml(ctx.city)} (${escapeHtml(ctx.aqi ?? 'N/A')} ${escapeHtml(ctx.standard)})
              </span>
              <button type="button" data-copy-idx="${idx}" aria-label="Copy response" class="ai-copy-btn px-2 py-1 text-text-muted hover:text-primary rounded hover:bg-surface-container-low font-label-micro text-[11px] inline-flex items-center gap-1" title="Copy response">
                ${renderIcon('content_copy', 'w-4 h-4')}
                <span class="ai-copy-label sr-only">Copy</span>
              </button>
            </div>

            <div class="grid grid-cols-1 gap-2.5 text-xs leading-relaxed">
              <div class="p-3 rounded-xl bg-surface-container-low">
                <strong class="font-label-micro uppercase text-secondary block mb-1">1. Observed Conditions</strong>
                <p class="text-on-surface">${escapeHtml(s.observedConditions)}</p>
              </div>
              <div class="p-3 rounded-xl bg-pearl-bg">
                <strong class="font-label-micro uppercase text-primary block mb-1">2. Interpretation</strong>
                <p class="text-on-surface-variant">${escapeHtml(s.interpretation)}</p>
              </div>
              <div class="p-3 rounded-xl bg-pearl-bg">
                <strong class="font-label-micro uppercase text-primary block mb-1">3. Recommendations</strong>
                <p class="text-on-surface-variant">${escapeHtml(s.recommendations)}</p>
              </div>
              <div class="p-3 rounded-xl bg-surface-white border border-border-subtle">
                <strong class="font-label-micro uppercase text-text-muted block mb-1">4. Data Limitations</strong>
                <p class="text-text-muted">${escapeHtml(s.dataLimitations)}</p>
              </div>
            </div>

            <p class="font-label-micro text-[10px] text-text-muted pt-1 border-t border-border-subtle">
              ${escapeHtml(entry.response.disclaimer || 'General environmental info only, not medical advice.')}
            </p>
          </div>
        </div>
      `;
    })
    .join('');
}

export async function renderAiAssistant(container) {
  container.innerHTML = renderLoadingState('Synchronizing grounding telemetry for AI Copilot...');
  const state = appState.getState();

  let currentPayload;
  try {
    currentPayload = await apiClient.getCurrentAQI({
      stationId: state.selectedStationId,
      cityId: state.selectedCityId,
      standard: state.aqiStandard,
    });
  } catch {
    currentPayload = null;
  }

  const station = currentPayload?.station;
  const stdLabel = state.aqiStandard === AQI_STANDARDS.US_EPA ? 'US EPA AQI' : 'India CPCB NAQI';
  const stationOptions = STATIONS.map(
    (st) =>
      `<option value="${escapeHtml(st.stationId)}" ${
        st.stationId === state.selectedStationId ? 'selected' : ''
      }>${escapeHtml(st.city)} — ${escapeHtml(st.name)}</option>`
  ).join('');

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 pb-2">
      <div class="space-y-1">
        <h1 class="font-headline-lg text-headline-md text-primary font-bold tracking-tight">AIRINDX Environmental AI Assistant</h1>
        ${renderProvenanceStrip({
          dataType: 'simulated',
          source: station?.source || 'Simulated Telemetry',
          timestamp: station?.timestamp || '',
          standard: stdLabel,
        })}
      </div>
      <div class="flex items-center gap-2">
        <button type="button" id="aiBackendToggleBtn" class="px-3.5 py-1.5 rounded-full bg-surface-white border border-border-subtle font-label-micro text-xs text-primary hover:bg-surface-container-low shadow-xs">
          Provider: <strong id="aiProviderLabel">${apiClient.useMock ? 'Mock Grounded Engine' : `FastAPI (${escapeHtml(ENV.API_BASE_URL)})`}</strong>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <aside class="lg:col-span-4 space-y-4">
        <div class="bg-surface-white rounded-2xl p-5 border border-border-subtle shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <span class="font-title-card text-sm text-primary font-bold">Attached Grounding Station</span>
            <span class="px-2 py-0.5 rounded-full bg-aqi-moderate/20 font-label-micro text-[10px] font-semibold text-on-surface">Simulated</span>
          </div>

          <div>
            <label for="aiStationSelect" class="sr-only">Select Grounding Station</label>
            <select id="aiStationSelect" class="w-full bg-pearl-bg border border-border-subtle rounded-xl px-3 py-2 text-xs text-on-surface">
              ${stationOptions}
            </select>
          </div>

          ${
            station
              ? `
            <div class="p-3.5 bg-surface-container-low rounded-xl space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-headline-sm text-base font-bold text-primary block">${escapeHtml(station.city)}</span>
                  <span class="font-label-micro text-[11px] text-text-muted">${escapeHtml(station.stationId)}</span>
                </div>
                <div class="text-right">
                  <span class="font-telemetry-num-md text-2xl font-bold text-primary">${escapeHtml(station.aqi ?? 'N/A')}</span>
                  <span class="font-label-micro text-[10px] block text-secondary uppercase">${escapeHtml(station.category?.label || 'Unavailable')}</span>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="p-2 bg-surface-white rounded-md">
                  <span class="font-label-micro text-[10px] text-text-muted block">PM2.5</span>
                  <span class="font-label-micro text-xs font-bold text-on-surface">${escapeHtml(station.pollutants.pm25?.value ?? 'N/A')}</span>
                </div>
                <div class="p-2 bg-surface-white rounded-md">
                  <span class="font-label-micro text-[10px] text-text-muted block">PBLH</span>
                  <span class="font-label-micro text-xs font-bold text-on-surface">${escapeHtml(station.weather.pblHeightM)} m</span>
                </div>
                <div class="p-2 bg-surface-white rounded-md">
                  <span class="font-label-micro text-[10px] text-text-muted block">Wind</span>
                  <span class="font-label-micro text-xs font-bold text-on-surface">${escapeHtml(station.weather.windSpeedKmh)} km/h</span>
                </div>
              </div>
            </div>
          `
              : '<p class="text-xs text-error">Station context unavailable.</p>'
          }
        </div>

        <div class="p-4 rounded-2xl bg-primary text-white space-y-2 shadow-sm">
          <div class="font-label-micro text-xs text-aqi-good font-bold uppercase">Gemini FastAPI Readiness</div>
          <p class="font-body-sm text-xs text-white/80 leading-relaxed">
            Server-side Gemini reasoning integrates via <code class="text-aqi-good">POST /api/v1/assistant/chat</code> on FastAPI. No API keys are stored in the browser.
          </p>
        </div>
      </aside>

      <section class="lg:col-span-8 flex flex-col bg-surface-white rounded-2xl border border-border-subtle shadow-sm min-h-[640px] overflow-hidden">
        <div class="px-6 py-4 bg-surface-white border-b border-border-subtle flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-aqi-good">
              ${renderIcon('psychology_alt', 'w-5 h-5')}
            </div>
            <div>
              <h2 class="font-headline-sm text-base text-primary font-bold">AIRINDX Grounded Copilot</h2>
              <p class="font-label-micro text-xs text-text-muted">Context: ${escapeHtml(station?.name || 'Unavailable')}</p>
            </div>
          </div>
          <button type="button" id="aiClearChatBtn" class="px-3 py-1.5 rounded-lg hover:bg-surface-container-low text-text-muted hover:text-primary font-label-micro text-xs flex items-center gap-1">
            ${renderIcon('delete_sweep', 'w-4 h-4')}
            <span>Clear</span>
          </button>
        </div>

        <div id="aiChatThread" class="flex-1 p-6 space-y-5 overflow-y-auto max-h-[520px]">
          ${renderAssistantCards(state.aiConversation)}
        </div>

        <div id="aiTypingIndicator" class="hidden px-6 pb-3 items-center gap-2 font-label-micro text-xs text-secondary" role="status" aria-live="polite">
          <span class="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
          <span>Evaluating station telemetry &amp; generating grounded briefing...</span>
        </div>

        <div class="px-6 pt-3 pb-2 border-t border-border-subtle flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span class="font-label-micro text-[10px] text-text-muted uppercase flex-shrink-0">Prompts:</span>
          ${QUICK_PROMPTS.map(
            (q) =>
              `<button type="button" data-ai-prompt="${escapeHtml(q)}" class="ai-quick-prompt px-3 py-1.5 rounded-full font-label-micro text-xs bg-pearl-bg hover:bg-surface-container text-on-surface whitespace-nowrap border border-border-subtle">${escapeHtml(q)}</button>`
          ).join('')}
        </div>

        <div class="p-4 sm:p-6 bg-surface-white space-y-2">
          <form id="aiPromptForm" class="flex items-center bg-pearl-bg rounded-2xl p-2 border border-border-subtle focus-within:border-secondary">
            <label for="aiPromptInput" class="sr-only">Ask AIRINDX Copilot</label>
            <input id="aiPromptInput" type="text" maxlength="600" placeholder="Ask about AQI, pollutant risks, trends, or exposure steps..." class="flex-1 bg-transparent border-0 outline-none px-3 py-2 text-sm text-on-surface placeholder:text-text-muted" />
            <button type="submit" id="aiSendBtn" class="px-4 py-2 rounded-xl bg-primary text-aqi-good font-title-card text-xs font-semibold hover:bg-abyssal-pine transition-colors flex items-center gap-1.5">
              <span>Analyze</span>
              ${renderIcon('send', 'w-4 h-4')}
            </button>
          </form>
          <p class="font-label-micro text-[11px] text-text-muted">
            Disclaimer: Informational environmental guidance only — not personal medical advice.
          </p>
        </div>
      </section>
    </div>
  `;

  const threadEl = container.querySelector('#aiChatThread');
  const typingEl = container.querySelector('#aiTypingIndicator');
  const inputEl = container.querySelector('#aiPromptInput');

  const refreshThread = () => {
    if (!threadEl) return;
    threadEl.innerHTML = renderAssistantCards(appState.getState().aiConversation);
    threadEl.scrollTop = threadEl.scrollHeight;
    bindThreadActions();
  };

  const submitQuery = async (rawText) => {
    const clean = sanitizeUserInput(rawText, 600);
    if (!clean) return;

    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appState.appendAIMessage({ role: 'user', text: clean, timeLabel: nowLabel });
    refreshThread();

    if (typingEl) {
      typingEl.classList.remove('hidden');
      typingEl.classList.add('flex');
    }

    try {
      const curState = appState.getState();
      const response = await apiClient.sendAIMessage({
        query: clean,
        stationId: curState.selectedStationId,
        standard: curState.aqiStandard,
        history: curState.aiConversation.slice(-6),
      });

      if (response.status === 'error') {
        appState.appendAIMessage({
          role: 'error',
          message: response.message || 'Assistant could not process request.',
          failedQuery: clean,
        });
      } else {
        appState.appendAIMessage({ role: 'assistant', response });
      }
    } catch (err) {
      appState.appendAIMessage({
        role: 'error',
        message: err.message || 'Backend unavailable. Retry or switch to local grounded mode.',
        failedQuery: clean,
      });
    } finally {
      if (typingEl) {
        typingEl.classList.add('hidden');
        typingEl.classList.remove('flex');
      }
      refreshThread();
    }
  };

  function bindThreadActions() {
    threadEl?.querySelectorAll('.ai-retry-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        submitQuery(btn.getAttribute('data-retry-query'));
      });
    });

    threadEl?.querySelectorAll('.ai-copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-copy-idx'));
        const item = appState.getState().aiConversation[idx];
        if (item?.response?.sections && navigator.clipboard) {
          const s = item.response.sections;
          navigator.clipboard
            .writeText(
              `Observed Conditions: ${s.observedConditions}\nInterpretation: ${s.interpretation}\nRecommendations: ${s.recommendations}\nData Limitations: ${s.dataLimitations}`
            )
            .then(() => {
              const lbl = btn.querySelector('.ai-copy-label');
              if (lbl) {
                lbl.textContent = 'Copied';
                lbl.classList.remove('sr-only');
                setTimeout(() => {
                  lbl.textContent = 'Copy';
                  lbl.classList.add('sr-only');
                }, 1500);
              }
            })
            .catch(() => {});
        }
      });
    });
  }

  bindThreadActions();

  container.querySelector('#aiPromptForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = inputEl?.value || '';
    if (inputEl) inputEl.value = '';
    submitQuery(val);
  });

  container.querySelectorAll('.ai-quick-prompt').forEach((btn) => {
    btn.addEventListener('click', () => {
      submitQuery(btn.getAttribute('data-ai-prompt'));
    });
  });

  container.querySelector('#aiClearChatBtn')?.addEventListener('click', () => {
    appState.clearAIConversation();
    refreshThread();
  });

  container.querySelector('#aiStationSelect')?.addEventListener('change', (e) => {
    const st = STATIONS.find((s) => s.stationId === e.target.value);
    if (st) appState.selectStation(st.stationId, st.cityId);
  });

  container.querySelector('#aiBackendToggleBtn')?.addEventListener('click', () => {
    apiClient.setUseMock(!apiClient.useMock);
    const label = container.querySelector('#aiProviderLabel');
    if (label) {
      label.textContent = apiClient.useMock
        ? 'Mock Grounded Engine'
        : `FastAPI (${ENV.API_BASE_URL})`;
    }
  });

  return () => {};
}
