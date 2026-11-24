/**
 * Shared AIRINDX Top Navigation Shell
 * Preserves the Stitch header visual identity across all 7 routes,
 * synchronizes active city/standard from shared state, and provides
 * global search & responsive mobile navigation.
 */

import { escapeHtml } from '../utils/sanitize.js';
import { renderIcon } from './Icons.js';
import { AQI_STANDARDS } from '../data/aqiStandards.js';
import { CITIES, STATIONS, computeStationForStandard } from '../data/mock/index.js';
import { appState } from '../state/appState.js';

export const NAV_ITEMS = [
  { path: '/', label: 'Overview' },
  { path: '/explore-map', label: 'Explore Map' },
  { path: '/pollutants', label: 'Pollutants' },
  { path: '/history', label: 'History' },
  { path: '/weather', label: 'Weather' },
  { path: '/ai-assistant', label: 'AI Assistant', icon: 'auto_awesome' },
  { path: '/comparison', label: 'Comparison' },
];

export function renderNavbar({ currentPath = '/' } = {}) {
  const state = appState.getState();
  const baseStation =
    STATIONS.find((s) => s.stationId === state.selectedStationId) || STATIONS[0];
  const computed = computeStationForStandard(baseStation, state.aqiStandard);
  const dotHex = computed.category?.hex || '#F2994A';
  const aqiText = computed.aqi ?? 'N/A';
  const stdTag = state.aqiStandard === AQI_STANDARDS.US_EPA ? 'EPA' : 'CPCB';

  const desktopLinks = NAV_ITEMS.map((item) => {
    const isActive = item.path === currentPath;
    const classes = isActive
      ? 'px-3.5 py-1.5 rounded-full bg-primary text-aqi-good font-title-card text-xs font-semibold shadow-inner transition-colors flex items-center gap-1 whitespace-nowrap'
      : 'px-3.5 py-1.5 rounded-full text-white/70 hover:text-white font-title-card text-xs hover:bg-white/10 transition-colors flex items-center gap-1 whitespace-nowrap';

    const iconHtml = item.icon
      ? renderIcon(item.icon, 'w-3.5 h-3.5 text-aqi-good')
      : '';

    return `<a href="#${escapeHtml(item.path)}" data-route="${escapeHtml(item.path)}" ${isActive ? 'aria-current="page"' : ''
      } class="${classes}">${iconHtml}<span>${escapeHtml(item.label)}</span></a>`;
  }).join('');

  const mobileLinks = NAV_ITEMS.map((item) => {
    const isActive = item.path === currentPath;
    const classes = isActive
      ? 'px-4 py-2.5 rounded-xl bg-primary text-aqi-good font-title-card text-sm font-semibold flex items-center justify-between'
      : 'px-4 py-2.5 rounded-xl text-on-surface hover:bg-surface-container-low font-title-card text-sm flex items-center justify-between';

    return `<a href="#${escapeHtml(item.path)}" data-route="${escapeHtml(item.path)}" ${isActive ? 'aria-current="page"' : ''
      } class="${classes}"><span>${escapeHtml(item.label)}</span>${renderIcon('chevron_right', 'w-4 h-4')}</a>`;
  }).join('');

  const cityOptions = CITIES.map(
    (c) =>
      `<option value="${escapeHtml(c.cityId)}" ${c.cityId === state.selectedCityId ? 'selected' : ''
      }>${escapeHtml(c.name)}, ${escapeHtml(c.state)}</option>`
  ).join('');

  return `
    <header class="fixed top-0 left-0 right-0 z-50 bg-surface-white/90 backdrop-blur-xl border-b border-border-subtle shadow-[0_2px_12px_rgba(16,37,31,0.03)]">
      <div class="max-w-[1600px] mx-auto h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 lg:gap-5 flex-shrink-0">
          <a href="#/" data-route="/" class="flex items-center gap-2.5 group">
            <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-aqi-good shadow-sm group-hover:scale-105 transition-transform duration-200">
              <svg class="w-6 h-6 stroke-current fill-none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a9 9 0 0 0-9 9c0 4.97 4.03 9 9 9 7 0 9-4.5 9-9 0-4.97-4.03-9-9-9z"></path>
                <path d="M7 14h7a2.5 2.5 0 0 0 0-5H8"></path>
                <path d="M9 9.5h3.5a1.5 1.5 0 0 0 0-3H11"></path>
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="font-headline-sm font-bold tracking-tight text-primary text-xl leading-none">AIRINDX</span>
              <span class="font-label-micro text-[10px] tracking-widest text-secondary font-semibold uppercase mt-0.5">Atmospheric Telemetry</span>
            </div>
          </a>
          <div class="hidden 2xl:flex items-center gap-2 px-3 py-1.5 bg-surface-container-low border border-border-subtle rounded-full">
            <span class="w-2 h-2 rounded-full bg-aqi-moderate"></span>
            <span class="font-label-micro text-[11px] text-text-muted">Simulated Demo Telemetry</span>
          </div>
        </div>

        <div class="hidden lg:flex items-center">
          <nav aria-label="Primary Navigation" class="bg-abyssal-pine/95 p-1.5 rounded-full shadow-[0_4px_20px_-2px_rgba(16,37,31,0.2)] border border-white/10 flex items-center gap-1">
            ${desktopLinks}
          </nav>
        </div>

        <div class="flex items-center gap-2 sm:gap-2.5">
          <label class="sr-only" for="globalCitySelect">Select active city</label>
          <select
            id="globalCitySelect"
            class="hidden md:block bg-pearl-bg border border-border-subtle rounded-full px-3 py-1.5 font-body-sm text-xs text-on-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary/40"
            aria-label="Active City"
          >
            ${cityOptions}
          </select>

          <label class="sr-only" for="globalStandardSelect">Select AQI standard</label>
          <select
            id="globalStandardSelect"
            class="bg-pearl-bg border border-border-subtle rounded-full px-2.5 py-1.5 font-label-micro text-[11px] font-semibold text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary/40"
            aria-label="AQI Methodology"
          >
            <option value="${AQI_STANDARDS.CPCB_NAQI}" ${state.aqiStandard === AQI_STANDARDS.CPCB_NAQI ? 'selected' : ''}>CPCB NAQI</option>
            <option value="${AQI_STANDARDS.US_EPA}" ${state.aqiStandard === AQI_STANDARDS.US_EPA ? 'selected' : ''}>US EPA</option>
          </select>

          <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-white border border-border-subtle shadow-xs">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${escapeHtml(dotHex)};"></span>
            <span class="font-label-micro text-xs text-on-surface font-semibold whitespace-nowrap">${escapeHtml(computed.city)} • ${escapeHtml(aqiText)} ${escapeHtml(stdTag)}</span>
          </div>

          <button
            type="button"
            id="mobileNavToggleBtn"
            aria-expanded="false"
            aria-controls="mobileNavDrawer"
            aria-label="Toggle navigation menu"
            class="lg:hidden min-w-11 min-h-11 flex items-center justify-center rounded-full bg-surface-white border border-border-subtle text-on-surface hover:text-primary hover:bg-surface-container-low transition-colors"
          >
            ${renderIcon('menu', 'w-5 h-5')}
          </button>
        </div>
      </div>

      <div id="mobileNavDrawer" class="hidden lg:hidden bg-surface-white border-t border-border-subtle px-4 py-4 space-y-3 shadow-lg">
        <div class="md:hidden">
          <label class="block font-label-micro text-[10px] text-text-muted uppercase mb-1" for="mobileCitySelect">Active City</label>
          <select id="mobileCitySelect" class="w-full bg-pearl-bg border border-border-subtle rounded-xl px-3 py-2 font-body-sm text-sm text-on-surface">
            ${cityOptions}
          </select>
        </div>
        <nav aria-label="Mobile Navigation" class="flex flex-col gap-1">
          ${mobileLinks}
        </nav>
      </div>
    </header>
  `;
}

export function bindNavbarEvents(root) {
  const toggleBtn = root.querySelector('#mobileNavToggleBtn');
  const drawer = root.querySelector('#mobileNavDrawer');
  const citySelect = root.querySelector('#globalCitySelect');
  const mobileCitySelect = root.querySelector('#mobileCitySelect');
  const standardSelect = root.querySelector('#globalStandardSelect');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = drawer.classList.contains('hidden');
      drawer.classList.toggle('hidden', !isHidden);
      toggleBtn.setAttribute('aria-expanded', String(isHidden));
    });
  }

  const handleCityChange = (cityId) => {
    const city = CITIES.find((c) => c.cityId === cityId);
    if (city) {
      appState.selectCity(city.cityId, city.defaultStationId);
    }
  };

  if (citySelect) {
    citySelect.addEventListener('change', (e) => handleCityChange(e.target.value));
  }
  if (mobileCitySelect) {
    mobileCitySelect.addEventListener('change', (e) => handleCityChange(e.target.value));
  }
  if (standardSelect) {
    standardSelect.addEventListener('change', (e) => appState.setStandard(e.target.value));
  }
}
