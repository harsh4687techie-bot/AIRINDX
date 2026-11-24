import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/state/appState.js';
import { AQI_STANDARDS } from '../src/data/aqiStandards.js';

describe('shared application state', () => {
  it('updates selected city, station, and AQI standard and notifies subscribers', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.selectCity('pune-in', 'IND-MH-PUN-SHV01');
    expect(store.getState().selectedCityId).toBe('pune-in');
    expect(store.getState().selectedStationId).toBe('IND-MH-PUN-SHV01');

    store.setStandard(AQI_STANDARDS.US_EPA);
    expect(store.getState().aqiStandard).toBe(AQI_STANDARDS.US_EPA);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.setStandard(AQI_STANDARDS.CPCB_NAQI);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('adds and removes comparison cities without duplicates', () => {
    const store = createStore();
    const initialCount = store.getState().comparisonCityIds.length;
    store.addComparisonCity('mumbai-in'); // duplicate ignored
    expect(store.getState().comparisonCityIds.length).toBe(initialCount);

    store.addComparisonCity('nagpur-in');
    expect(store.getState().comparisonCityIds).toContain('nagpur-in');

    store.removeComparisonCity('nagpur-in');
    expect(store.getState().comparisonCityIds).not.toContain('nagpur-in');
  });
});
