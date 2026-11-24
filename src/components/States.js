/**
 * Reusable Loading, Error, Empty, and Provenance Badge Components
 */

import { escapeHtml } from '../utils/sanitize.js';
import { renderIcon } from './Icons.js';

export function renderLoadingState(message = 'Loading environmental telemetry...') {
  return `
    <div class="bg-surface-white rounded-2xl p-8 border border-border-subtle shadow-sm flex flex-col items-center justify-center text-center gap-3 min-h-[240px]" role="status" aria-live="polite">
      <div class="w-10 h-10 rounded-full border-3 border-surface-container border-t-secondary animate-spin"></div>
      <p class="font-label-micro text-xs text-text-muted">${escapeHtml(message)}</p>
    </div>
  `;
}

export function renderErrorState({
  title = 'Telemetry Request Failed',
  message = 'Unable to retrieve environmental records right now.',
  retryId = 'retryActionBtn',
} = {}) {
  return `
    <div class="bg-surface-white rounded-2xl p-8 border border-error/20 shadow-sm flex flex-col items-center justify-center text-center gap-3 min-h-[240px]" role="alert">
      <div class="w-11 h-11 rounded-full bg-error-container text-error flex items-center justify-center">
        ${renderIcon('error', 'w-5 h-5')}
      </div>
      <h1 class="font-headline-sm text-primary font-bold">${escapeHtml(title)}</h1>
      <p class="font-body-sm text-text-muted max-w-md">${escapeHtml(message)}</p>
      <button type="button" id="${escapeHtml(retryId)}" class="px-4 py-2 rounded-xl bg-primary text-aqi-good font-title-card text-xs font-semibold hover:bg-abyssal-pine transition-colors">
        Retry Request
      </button>
    </div>
  `;
}

export function renderEmptyState({
  icon = 'wifi_tethering_off',
  title = 'No Matching Records',
  message = 'Adjust your filters or search criteria to inspect available monitoring stations.',
  resetId = '',
  resetLabel = 'Reset Filters',
} = {}) {
  return `
    <div class="py-12 px-4 flex flex-col items-center justify-center text-center space-y-2.5">
      <span class="text-text-muted">${renderIcon(icon, 'w-9 h-9')}</span>
      <div class="font-headline-sm text-primary font-bold">${escapeHtml(title)}</div>
      <p class="font-body-sm text-text-muted max-w-md">${escapeHtml(message)}</p>
      ${
        resetId
          ? `<button type="button" id="${escapeHtml(resetId)}" class="mt-2 px-4 py-2 rounded-lg bg-primary text-aqi-good font-title-card text-xs font-semibold">${escapeHtml(resetLabel)}</button>`
          : ''
      }
    </div>
  `;
}

export function renderProvenanceStrip({ dataType = 'simulated', source = '', timestamp = '', standard = '' } = {}) {
  const isSimulated = dataType === 'simulated';
  const badgeText = isSimulated ? 'SIMULATED DEMO DATA' : 'LIVE TELEMETRY';
  const badgeClass = isSimulated
    ? 'bg-aqi-moderate/25 text-on-surface border border-aqi-moderate/50'
    : 'bg-aqi-good/25 text-primary border border-aqi-good/40';

  return `
    <div class="flex flex-wrap items-center gap-2 font-label-micro text-xs text-text-muted">
      <span class="px-2.5 py-0.5 rounded-full font-semibold ${badgeClass}">${escapeHtml(badgeText)}</span>
      ${standard ? `<span class="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary font-semibold">${escapeHtml(standard)}</span>` : ''}
      ${source ? `<span>Source: <strong class="text-on-surface font-medium">${escapeHtml(source)}</strong></span>` : ''}
      ${timestamp ? `<span>• Timestamp: <strong class="text-on-surface font-medium">${escapeHtml(timestamp)}</strong></span>` : ''}
    </div>
  `;
}
