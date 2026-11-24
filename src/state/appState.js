/**
 * AIRINDX Shared Application State Store
 * Centralized reactive store consumed across all seven pages.
 * Keeps selected city, station, AQI standard, pollutant, historical filters,
 * map filters, city comparison list, AI conversation history, and UI states
 * synchronized across route transitions.
 */

import { AQI_STANDARDS } from '../data/aqiStandards.js';

const DEFAULT_STATE = {
  selectedCityId: 'mumbai-in',
  selectedStationId: 'IND-MH-MUM-BKC04',
  aqiStandard: AQI_STANDARDS.CPCB_NAQI,
  selectedPollutant: 'pm25',
  historicalRange: '24h',
  historicalMetric: 'aqi',
  dateRange: {
    start: '2026-11-18',
    end: '2026-11-25',
  },
  mapFilters: {
    country: 'ALL',
    state: 'ALL',
    city: 'ALL',
    severity: 'ALL',
    searchQuery: '',
    layers: {
      globe3d: true,
      heatmap: true,
      stations: true,
      wind: true,
    },
  },
  comparisonCityIds: ['mumbai-in', 'delhi-in', 'pune-in', 'tokyo-jp'],
  comparisonTimeframe: 'live',
  aiConversation: [],
  uiStatus: {
    loading: false,
    error: null,
    useMock: true,
  },
};

function createStore(initialState = DEFAULT_STATE) {
  let state = structuredClone(initialState);
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(updater) {
    const nextPatch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...nextPatch };
    listeners.forEach((fn) => fn(state));
    return state;
  }

  function updateMapFilters(patch) {
    return setState((prev) => ({
      mapFilters: {
        ...prev.mapFilters,
        ...patch,
        layers: patch.layers
          ? { ...prev.mapFilters.layers, ...patch.layers }
          : prev.mapFilters.layers,
      },
    }));
  }

  function selectCity(cityId, defaultStationId) {
    return setState((prev) => ({
      selectedCityId: cityId,
      selectedStationId: defaultStationId || prev.selectedStationId,
    }));
  }

  function selectStation(stationId, cityId = null) {
    return setState((prev) => ({
      selectedStationId: stationId,
      selectedCityId: cityId || prev.selectedCityId,
    }));
  }

  function setStandard(standard) {
    const valid =
      standard === AQI_STANDARDS.US_EPA ? AQI_STANDARDS.US_EPA : AQI_STANDARDS.CPCB_NAQI;
    return setState({ aqiStandard: valid });
  }

  function addComparisonCity(cityId) {
    return setState((prev) => {
      if (!cityId || prev.comparisonCityIds.includes(cityId)) return prev;
      return { comparisonCityIds: [...prev.comparisonCityIds, cityId] };
    });
  }

  function removeComparisonCity(cityId) {
    return setState((prev) => ({
      comparisonCityIds: prev.comparisonCityIds.filter((id) => id !== cityId),
    }));
  }

  function appendAIMessage(message) {
    return setState((prev) => ({
      aiConversation: [...prev.aiConversation, message],
    }));
  }

  function clearAIConversation() {
    return setState({ aiConversation: [] });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function reset() {
    state = structuredClone(DEFAULT_STATE);
    listeners.forEach((fn) => fn(state));
  }

  return {
    getState,
    setState,
    updateMapFilters,
    selectCity,
    selectStation,
    setStandard,
    addComparisonCity,
    removeComparisonCity,
    appendAIMessage,
    clearAIConversation,
    subscribe,
    reset,
  };
}

export const appState = createStore();
export { createStore };
