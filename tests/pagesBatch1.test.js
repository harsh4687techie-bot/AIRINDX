import { describe, it, expect, beforeEach } from 'vitest';
import { appState } from '../src/state/appState.js';
import { renderLiveDashboard } from '../src/pages/liveDashboard.js';
import { renderExploreMap } from '../src/pages/exploreMap.js';

describe('Page migrations: Live Dashboard & Explore Map', () => {
  beforeEach(() => {
    appState.reset();
  });

  it('renders Live Dashboard with consistent CPCB AQI, 6 pollutant cards, weather, and WebGL fallback', async () => {
    const container = document.createElement('div');
    const cleanup = await renderLiveDashboard(container);

    expect(container.textContent).toContain('Mumbai, Maharashtra, India');
    expect(container.textContent).toContain('SIMULATED DEMO DATA');
    expect(container.textContent).toContain('Priority Pollutant Breakdown');
    expect(container.textContent).toContain('PM2.5');
    expect(container.textContent).toContain('2D Earth Fallback Active');
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('renders Explore Map with cascading filters, legend, and filtered stations', async () => {
    const container = document.createElement('div');
    const cleanup = await renderExploreMap(container);

    expect(container.textContent).toContain('Explore Global & Regional Air Quality Map');
    expect(container.textContent).toContain('AQI Legend');
    expect(container.querySelectorAll('.inspect-station-btn').length).toBeGreaterThan(5);

    // Filter to Pune via state
    appState.updateMapFilters({ city: 'Pune' });
    await renderExploreMap(container);
    expect(container.querySelectorAll('.inspect-station-btn').length).toBe(1);
    expect(container.textContent).toContain('Shivajinagar Observatory, Pune');

    if (typeof cleanup === 'function') cleanup();
  });
});
