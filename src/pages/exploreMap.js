/**
 * Page 2 — Explore Map
 * Interactive 3D Three.js Earth + 2D Geospatial Plume Map fallback,
 * Country / State / City cascading filters, severity pills, map layers,
 * clear legend, station inspection drawer, and CSV export.
 */

import { apiClient } from '../services/apiClient.js';
import {
  fetchCopernicusCamsColumn,
  getSentinel5PL2Availability,
} from '../services/satelliteLayer.js';
import { appState } from '../state/appState.js';
import { AQI_STANDARDS } from '../data/aqiStandards.js';
import { renderIcon } from '../components/Icons.js';
import { renderLoadingState, renderErrorState, renderEmptyState, renderProvenanceStrip } from '../components/States.js';
import { escapeHtml } from '../utils/sanitize.js';
import { downloadCsvFile } from '../utils/exportCsv.js';
import { runContainerCleanup, registerContainerCleanup } from '../utils/lifecycle.js';

// Project lat/lon onto the 1000x500 SVG equirectangular viewport
function projectCoords(lat, lon) {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

export async function renderExploreMap(container, { preserveSearchFocus = false } = {}) {
  runContainerCleanup(container);
  container.innerHTML = renderLoadingState('Loading global & regional monitoring network...');
  const state = appState.getState();

  let stationsPayload;
  try {
    stationsPayload = await apiClient.getMonitoringStations({
      standard: state.aqiStandard,
      country: state.mapFilters.country,
      state: state.mapFilters.state,
      city: state.mapFilters.city,
      severity: state.mapFilters.severity,
      query: state.mapFilters.searchQuery,
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Unable to Load Explore Map',
      message: err.message,
      retryId: 'retryMapBtn',
    });
    container.querySelector('#retryMapBtn')?.addEventListener('click', () => renderExploreMap(container));
    return () => { };
  }

  // Fetch unfiltered directory for cascading country/state/city dropdowns
  const allDir = await apiClient.getMonitoringStations({ standard: state.aqiStandard });
  const allStations = allDir.stations || [];
  const filteredStations = stationsPayload.stations || [];
  const activeStation =
    allStations.find((s) => s.stationId === state.selectedStationId) ||
    filteredStations[0] ||
    allStations[0];

  const countries = ['ALL', ...new Set(allStations.map((s) => s.country))];
  const states = [
    'ALL',
    ...new Set(
      allStations
        .filter((s) => state.mapFilters.country === 'ALL' || s.country === state.mapFilters.country)
        .map((s) => s.state)
    ),
  ];
  const cities = [
    'ALL',
    ...new Set(
      allStations
        .filter(
          (s) =>
            (state.mapFilters.country === 'ALL' || s.country === state.mapFilters.country) &&
            (state.mapFilters.state === 'ALL' || s.state === state.mapFilters.state)
        )
        .map((s) => s.city)
    ),
  ];

  const layers = state.mapFilters.layers;
  const stdLabel = state.aqiStandard === AQI_STANDARDS.US_EPA ? 'US EPA AQI' : 'CPCB NAQI';

  const svgMarkersHtml = filteredStations
    .map((st) => {
      const { x, y } = projectCoords(st.lat, st.lon);
      const hex = st.category?.hex || '#237A5B';
      const isSelected = st.stationId === activeStation?.stationId;
      return `
        <g tabindex="0" role="button" aria-label="Select ${escapeHtml(st.name)} (${escapeHtml(st.aqi ?? 'N/A')} AQI)" class="map-pin cursor-pointer" data-station-id="${escapeHtml(st.stationId)}" data-city-id="${escapeHtml(st.cityId)}" transform="translate(${x}, ${y})">
          ${layers.heatmap ? `<circle r="${isSelected ? 34 : 24}" fill="${escapeHtml(hex)}" fill-opacity="0.22"></circle>` : ''}
          ${layers.stations
          ? `<circle r="${isSelected ? 9 : 6.5}" fill="${escapeHtml(hex)}" stroke="#FFFFFF" stroke-width="2"></circle>
                 <rect x="10" y="-11" width="84" height="22" rx="4" fill="#10251F" fill-opacity="0.9"></rect>
                 <text x="16" y="4" fill="#FFFFFF" font-family="JetBrains Mono" font-size="9.5" font-weight="600">${escapeHtml(st.city.slice(0, 8))} • ${escapeHtml(st.aqi ?? 'N/A')}</text>`
          : ''
        }
        </g>
      `;
    })
    .join('');

  const tableRowsHtml = filteredStations
    .map((st) => {
      const hex = st.category?.hex || '#237A5B';
      const isSelected = st.stationId === activeStation?.stationId;
      return `
        <tr class="${isSelected ? 'bg-surface-container-low/70' : 'hover:bg-pearl-bg/60'} transition-colors">
          <td class="py-3 px-4">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${escapeHtml(hex)};"></span>
              <div>
                <span class="font-title-card text-sm text-primary font-bold block">${escapeHtml(st.name)}</span>
                <span class="font-label-micro text-xs text-text-muted">${escapeHtml(st.stationId)} • ${escapeHtml(st.city)}, ${escapeHtml(st.state)}, ${escapeHtml(st.country)}</span>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 font-telemetry-num-md text-lg font-bold text-on-surface">${escapeHtml(st.aqi ?? 'N/A')}</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 rounded-full font-label-micro text-xs font-semibold" style="background-color: ${escapeHtml(hex)}26; color: #172B25;">${escapeHtml(st.category?.label || 'Unavailable')}</span>
          </td>
          <td class="py-3 px-4 font-label-micro text-xs">${escapeHtml(st.pollutants.pm25?.value ?? 'N/A')} µg/m³</td>
          <td class="py-3 px-4 font-label-micro text-xs">${escapeHtml(st.pollutants.pm10?.value ?? 'N/A')} µg/m³</td>
          <td class="py-3 px-4 text-right">
            <button type="button" data-station-id="${escapeHtml(st.stationId)}" data-city-id="${escapeHtml(st.cityId)}" class="inspect-station-btn px-3 py-1.5 rounded-lg font-label-micro text-xs font-semibold transition-colors ${isSelected ? 'bg-primary text-aqi-good' : 'bg-surface-container text-on-surface hover:bg-surface-container-highest'
        }">${isSelected ? 'Inspecting' : 'Inspect'}</button>
          </td>
        </tr>
      `;
    })
    .join('');

  const globeStations = filteredStations.map((s) => ({
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    aqi: s.aqi || 0,
    color: parseInt((s.category?.hex || '#B9ED73').replace('#', ''), 16),
  }));

  container.innerHTML = `
    <section class="flex flex-col gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="font-headline-lg text-headline-md text-primary font-bold tracking-tight">Explore Global &amp; Regional Air Quality Map</h1>
          ${renderProvenanceStrip({
    dataType: 'simulated',
    source: allDir.source,
    timestamp: allDir.timestamp,
    standard: stdLabel,
  })}
        </div>
        <button type="button" id="mapExportCsvBtn" class="px-4 py-2 rounded-full bg-surface-white border border-border-subtle text-primary font-label-micro text-xs font-semibold hover:bg-surface-container-low flex items-center gap-1.5 shadow-xs">
          ${renderIcon('download', 'w-4 h-4')}
          <span>Export Station CSV</span>
        </button>
      </div>

      <div class="bg-surface-white p-4 rounded-2xl border border-border-subtle shadow-sm space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="lg:col-span-2 flex items-center gap-2 bg-pearl-bg px-3.5 py-2 rounded-xl border border-border-subtle">
            <label for="mapSearchInput" class="sr-only">Search monitoring stations</label>
            ${renderIcon('travel_explore', 'w-4 h-4 text-secondary')}
            <input id="mapSearchInput" type="text" value="${escapeHtml(state.mapFilters.searchQuery)}" placeholder="Search station, city, state, or ID..." class="bg-transparent w-full text-sm text-on-surface placeholder:text-text-muted focus:outline-none" />
          </div>
          <select id="mapCountryFilter" aria-label="Filter by country" class="bg-pearl-bg border border-border-subtle rounded-xl px-3 py-2 text-xs font-body-sm text-on-surface">
            ${countries.map((c) => `<option value="${escapeHtml(c)}" ${state.mapFilters.country === c ? 'selected' : ''}>${c === 'ALL' ? 'All Countries' : escapeHtml(c)}</option>`).join('')}
          </select>
          <select id="mapStateFilter" aria-label="Filter by state" class="bg-pearl-bg border border-border-subtle rounded-xl px-3 py-2 text-xs font-body-sm text-on-surface">
            ${states.map((s) => `<option value="${escapeHtml(s)}" ${state.mapFilters.state === s ? 'selected' : ''}>${s === 'ALL' ? 'All States / Regions' : escapeHtml(s)}</option>`).join('')}
          </select>
          <select id="mapCityFilter" aria-label="Filter by city" class="bg-pearl-bg border border-border-subtle rounded-xl px-3 py-2 text-xs font-body-sm text-on-surface">
            ${cities.map((c) => `<option value="${escapeHtml(c)}" ${state.mapFilters.city === c ? 'selected' : ''}>${c === 'ALL' ? 'All Cities' : escapeHtml(c)}</option>`).join('')}
          </select>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-label-micro text-xs text-text-muted uppercase">Severity:</span>
            ${[
      { key: 'ALL', label: 'All' },
      { key: 'GOOD', label: 'Good (0–50)' },
      { key: 'MODERATE', label: '51–100' },
      { key: 'POOR', label: '101–200' },
      { key: 'UNHEALTHY', label: '201–300' },
      { key: 'SEVERE', label: '301+' },
    ]
      .map(
        (p) =>
          `<button type="button" data-severity="${p.key}" class="map-severity-btn px-3 py-1 rounded-full font-label-micro text-xs transition-colors ${state.mapFilters.severity === p.key
            ? 'bg-primary text-aqi-good font-semibold'
            : 'bg-pearl-bg text-on-surface hover:bg-surface-container border border-border-subtle'
          }">${p.label}</button>`
      )
      .join('')}
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-layer="globe3d" class="map-layer-btn px-3 py-1.5 rounded-lg font-title-card text-xs flex items-center gap-1.5 ${layers.globe3d ? 'bg-primary text-aqi-good font-semibold' : 'bg-surface-container text-on-surface'}">
              ${renderIcon('public', 'w-4 h-4')}
              <span>3D Globe</span>
            </button>
            <button type="button" data-layer="heatmap" class="map-layer-btn px-3 py-1.5 rounded-lg font-title-card text-xs flex items-center gap-1.5 ${layers.heatmap ? 'bg-primary text-aqi-good font-semibold' : 'bg-surface-container text-on-surface'}">
              ${renderIcon('blur_on', 'w-4 h-4')}
              <span>Plume Density</span>
            </button>
            <button type="button" data-layer="stations" class="map-layer-btn px-3 py-1.5 rounded-lg font-title-card text-xs flex items-center gap-1.5 ${layers.stations ? 'bg-primary text-aqi-good font-semibold' : 'bg-surface-container text-on-surface'}">
              ${renderIcon('sensors', 'w-4 h-4')}
              <span>Markers</span>
            </button>
            <button type="button" data-layer="wind" class="map-layer-btn px-3 py-1.5 rounded-lg font-title-card text-xs flex items-center gap-1.5 ${layers.wind ? 'bg-primary text-aqi-good font-semibold' : 'bg-surface-container text-on-surface'}">
              ${renderIcon('air', 'w-4 h-4')}
              <span>Wind Vectors</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="relative w-full rounded-2xl overflow-hidden bg-abyssal-pine shadow-xl grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
      <div class="lg:col-span-8 relative flex flex-col justify-between p-4 sm:p-6 min-h-[420px]">
        <div class="flex items-center justify-between z-10">
          <div class="bg-abyssal-pine/85 border border-white/10 px-3 py-1.5 rounded-lg font-label-micro text-xs text-aqi-good">
            ${layers.globe3d ? '3D Interactive Three.js Earth View' : '2D Geospatial Plume Projection'} • ${filteredStations.length} Stations Shown
          </div>
        </div>

        <div id="mapVisualStage" class="relative flex-1 flex items-center justify-center my-2">
          ${layers.globe3d
      ? '<div id="exploreGlobeMount" class="w-full h-[380px] rounded-xl overflow-hidden"></div>'
      : `<svg class="w-full h-[380px]" viewBox="0 0 1000 500" role="img" aria-labelledby="exploreMapSvgTitle exploreMapSvgDesc">
                  <title id="exploreMapSvgTitle">2D Geospatial air quality monitoring station map</title>
                  <desc id="exploreMapSvgDesc">Equirectangular plot showing ${filteredStations.length} filtered air quality monitoring stations under ${escapeHtml(stdLabel)}.</desc>
                  <rect width="1000" height="500" fill="#0B1E18" rx="12"></rect>
                  <g stroke="#237A5B" stroke-opacity="0.2" stroke-width="0.6">
                    <line x1="0" y1="250" x2="1000" y2="250"></line>
                    <line x1="500" y1="0" x2="500" y2="500"></line>
                    <line x1="0" y1="125" x2="1000" y2="125"></line>
                    <line x1="0" y1="375" x2="1000" y2="375"></line>
                  </g>
                  ${layers.wind
        ? '<g stroke="#84d7b2" stroke-opacity="0.35" stroke-dasharray="6 6" fill="none"><path d="M640,210 Q690,195 740,205"></path><path d="M460,120 Q500,110 540,120"></path><path d="M820,160 Q860,150 900,165"></path></g>'
        : ''
      }
                  ${svgMarkersHtml}
                </svg>`
    }
        </div>

        <!-- Clear Map Legend -->
        <div class="z-10 flex flex-wrap items-center justify-between gap-3 bg-abyssal-pine/90 border border-white/10 rounded-xl px-4 py-2.5 text-white font-label-micro text-[11px]">
          <span class="text-white/70 uppercase">AQI Legend (${escapeHtml(stdLabel)}):</span>
          <div class="flex flex-wrap items-center gap-3">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-aqi-good"></span> 0–50</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-aqi-moderate"></span> 51–100</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-aqi-poor"></span> 101–200</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-aqi-unhealthy"></span> 201–300</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-aqi-severe"></span> 301–400</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-aqi-hazardous"></span> 401–500</span>
          </div>
        </div>
      </div>

      <aside class="lg:col-span-4 bg-surface-white/95 p-6 flex flex-col justify-between gap-4 border-t lg:border-t-0 lg:border-l border-border-subtle">
        ${activeStation
      ? `
          <div class="space-y-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${escapeHtml(activeStation.category?.hex || '#237A5B')};"></span>
                <span class="font-label-micro text-xs text-secondary font-bold">${escapeHtml(activeStation.stationId)}</span>
              </div>
              <h2 class="font-headline-sm text-primary font-bold mt-1">${escapeHtml(activeStation.name)}</h2>
              <p class="font-body-sm text-xs text-text-muted">${escapeHtml(activeStation.city)}, ${escapeHtml(activeStation.state)}, ${escapeHtml(activeStation.country)} • ${escapeHtml(activeStation.lat.toFixed(4))}° N, ${escapeHtml(activeStation.lon.toFixed(4))}° E</p>
            </div>

            <div class="p-4 rounded-xl bg-pearl-bg flex items-center justify-between border border-border-subtle">
              <div>
                <span class="font-label-micro text-[10px] text-text-muted uppercase block">${escapeHtml(stdLabel)}</span>
                <span class="font-telemetry-num-lg text-4xl font-bold text-primary">${escapeHtml(activeStation.aqi ?? 'N/A')}</span>
                <span class="block mt-1 font-label-micro text-xs font-semibold">${escapeHtml(activeStation.category?.label || 'Unavailable')}</span>
              </div>
              <div class="text-right font-label-micro text-xs">
                <span class="text-text-muted block">Dominant</span>
                <strong class="text-primary text-sm">${escapeHtml(activeStation.dominantPollutant || '—')}</strong>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="p-2.5 rounded-lg bg-pearl-bg">
                <span class="font-label-micro text-[10px] text-text-muted block">PM2.5</span>
                <span class="font-title-card text-sm font-bold text-primary">${escapeHtml(activeStation.pollutants.pm25?.value ?? 'N/A')}</span>
              </div>
              <div class="p-2.5 rounded-lg bg-pearl-bg">
                <span class="font-label-micro text-[10px] text-text-muted block">Temp</span>
                <span class="font-title-card text-sm font-bold text-primary">${escapeHtml(activeStation.weather.temperatureC)}°C</span>
              </div>
              <div class="p-2.5 rounded-lg bg-pearl-bg">
                <span class="font-label-micro text-[10px] text-text-muted block">Wind</span>
                <span class="font-title-card text-sm font-bold text-primary">${escapeHtml(activeStation.weather.windSpeedKmh)} km/h</span>
              </div>
            </div>
            <p class="font-body-sm text-xs text-text-muted">${escapeHtml(activeStation.sensorType)} • Elevation ${escapeHtml(activeStation.elevationM)} m ASL</p>

            <div id="satelliteColumnBox" class="p-3.5 rounded-xl bg-surface-container-low border border-border-subtle space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="font-label-micro text-[10px] font-bold uppercase text-primary">Atmospheric Column Layer</span>
                <span class="px-2 py-0.5 rounded-full bg-surface-white font-label-micro text-[10px] text-secondary font-semibold border border-border-subtle">Separate from CPCB AQI</span>
              </div>
              <p class="font-body-sm text-[11px] text-text-muted leading-snug">
                Direct Sentinel-5P L2 NO₂ swath: <strong class="text-on-surface">${escapeHtml(getSentinel5PL2Availability().status)}</strong> (requires backend CDSE OAuth2/NetCDF pipeline). Optional keyless Copernicus CAMS 550 nm AOD model can be fetched on demand.
              </p>
              <button type="button" id="fetchCamsAodBtn" class="w-full py-1.5 px-3 rounded-lg bg-surface-white border border-border-subtle hover:bg-surface-container text-primary font-label-micro text-[11px] font-semibold transition-colors">
                Fetch Live Copernicus CAMS AOD (No Key)
              </button>
              <div id="camsAodResult" class="font-label-micro text-[10px] text-text-muted"></div>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <a href="#/" class="w-full py-2.5 px-4 rounded-xl bg-primary text-aqi-good font-title-card text-xs font-semibold text-center hover:bg-abyssal-pine transition-colors">Open Station in Live Dashboard</a>
            <a href="#/history" class="w-full py-2.5 px-4 rounded-xl bg-pearl-bg text-primary font-title-card text-xs font-semibold text-center hover:bg-surface-container transition-colors">Inspect Historical Trends</a>
          </div>
        `
      : '<p class="text-sm text-text-muted">No station selected.</p>'
    }
      </aside>
    </section>

    <section class="bg-surface-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
      <div class="p-5 border-b border-border-subtle flex items-center justify-between">
        <h2 class="font-headline-sm text-primary font-bold">Filtered Monitoring Stations (${filteredStations.length})</h2>
        <span class="font-label-micro text-xs text-text-muted">Click Inspect to focus station across app</span>
      </div>
      ${filteredStations.length === 0
      ? renderEmptyState({
        title: 'No Stations Match Current Filters',
        message: 'Reset country, state, city, or severity filters to view available monitoring nodes.',
        resetId: 'resetMapFiltersBtn',
      })
      : `<div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-pearl-bg/80 text-text-muted font-label-micro text-xs uppercase">
                    <th class="py-3 px-4">Station &amp; Location</th>
                    <th class="py-3 px-4">AQI</th>
                    <th class="py-3 px-4">Category</th>
                    <th class="py-3 px-4">PM2.5</th>
                    <th class="py-3 px-4">PM10</th>
                    <th class="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle">${tableRowsHtml}</tbody>
              </table>
            </div>`
    }
    </section>
  `;

  let globeCleanup = null;
  if (layers.globe3d) {
    const globeMount = container.querySelector('#exploreGlobeMount');
    if (globeMount) {
      const { mountGlobeScene } = await import('../components/GlobeScene.js');
      globeCleanup = mountGlobeScene(globeMount, globeStations, {
        focusLat: activeStation?.lat ?? 19.0657,
        focusLon: activeStation?.lon ?? 72.8687,
      });
    }
  }

  let searchDebounce = null;
  const searchInputEl = container.querySelector('#mapSearchInput');
  if (preserveSearchFocus && searchInputEl) {
    searchInputEl.focus();
    const len = searchInputEl.value.length;
    searchInputEl.setSelectionRange(len, len);
  }

  // Filter & Layer bindings
  searchInputEl?.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      appState.updateMapFilters({ searchQuery: val });
      renderExploreMap(container, { preserveSearchFocus: true });
    }, 180);
  });

  container.querySelector('#mapCountryFilter')?.addEventListener('change', (e) => {
    appState.updateMapFilters({ country: e.target.value, state: 'ALL', city: 'ALL' });
    renderExploreMap(container);
  });

  container.querySelector('#mapStateFilter')?.addEventListener('change', (e) => {
    appState.updateMapFilters({ state: e.target.value, city: 'ALL' });
    renderExploreMap(container);
  });

  container.querySelector('#mapCityFilter')?.addEventListener('change', (e) => {
    appState.updateMapFilters({ city: e.target.value });
    renderExploreMap(container);
  });

  container.querySelectorAll('.map-severity-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.updateMapFilters({ severity: btn.getAttribute('data-severity') });
      renderExploreMap(container);
    });
  });

  container.querySelectorAll('.map-layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = btn.getAttribute('data-layer');
      const currentVal = appState.getState().mapFilters.layers[layer];
      appState.updateMapFilters({ layers: { [layer]: !currentVal } });
      renderExploreMap(container);
    });
  });

  container.querySelectorAll('.inspect-station-btn, .map-pin').forEach((el) => {
    const triggerSelect = () => {
      const stId = el.getAttribute('data-station-id');
      const cId = el.getAttribute('data-city-id');
      if (stId) appState.selectStation(stId, cId);
    };
    el.addEventListener('click', triggerSelect);
    if (el.classList.contains('map-pin')) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerSelect();
        }
      });
    }
  });

  container.querySelector('#resetMapFiltersBtn')?.addEventListener('click', () => {
    appState.updateMapFilters({
      country: 'ALL',
      state: 'ALL',
      city: 'ALL',
      severity: 'ALL',
      searchQuery: '',
    });
    renderExploreMap(container);
  });

  container.querySelector('#mapExportCsvBtn')?.addEventListener('click', () => {
    const headers = ['Station ID', 'Name', 'City', 'State', 'Country', 'Latitude', 'Longitude', 'Standard', 'AQI', 'Category', 'PM2.5', 'PM10', 'Data Type'];
    const rows = filteredStations.map((s) => [
      s.stationId,
      s.name,
      s.city,
      s.state,
      s.country,
      s.lat,
      s.lon,
      s.methodology,
      s.aqi ?? 'N/A',
      s.category?.label || 'Unavailable',
      s.pollutants.pm25?.value ?? 'N/A',
      s.pollutants.pm10?.value ?? 'N/A',
      s.dataType,
    ]);
    downloadCsvFile('airindx-stations-map.csv', headers, rows);
  });

  container.querySelector('#fetchCamsAodBtn')?.addEventListener('click', async () => {
    const resultEl = container.querySelector('#camsAodResult');
    if (!resultEl || !activeStation) return;
    resultEl.textContent = 'Querying Copernicus CAMS atmospheric column via Open-Meteo...';
    const cams = await fetchCopernicusCamsColumn({
      lat: activeStation.lat,
      lon: activeStation.lon,
    });
    if (!cams.available) {
      resultEl.replaceChildren();
      const p = document.createElement('p');
      p.className = 'text-error font-semibold';
      p.textContent = `Unavailable (${cams.code}): ${cams.message}`;
      resultEl.appendChild(p);
      return;
    }
    resultEl.replaceChildren();
    const lines = [
      `AOD (550 nm column): ${cams.aod550nm} — ${cams.aodClassification.label}`,
      `Source: ${cams.source}`,
      `Resolution: ${cams.spatialResolution} • Time: ${cams.timestamp}`,
      `Note: ${cams.scientificBoundary}`,
    ];
    lines.forEach((line, idx) => {
      const div = document.createElement('div');
      if (idx === 0) div.className = 'text-primary font-bold';
      div.textContent = line;
      resultEl.appendChild(div);
    });
  });

  const cleanup = () => {
    clearTimeout(searchDebounce);
    if (typeof globeCleanup === 'function') globeCleanup();
  };
  registerContainerCleanup(container, cleanup);
  return cleanup;
}
