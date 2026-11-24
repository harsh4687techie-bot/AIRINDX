import { describe, it, expect, beforeEach } from 'vitest';
import { appState } from '../src/state/appState.js';
import { AQI_STANDARDS } from '../src/data/aqiStandards.js';
import { renderPollutants } from '../src/pages/pollutants.js';
import { renderHistoricalAnalysis } from '../src/pages/historicalAnalysis.js';
import { renderWeather } from '../src/pages/weather.js';

describe('Page migrations: Pollutants, Historical Analysis & Weather', () => {
  beforeEach(() => {
    appState.reset();
  });

  it('renders all 8 CPCB pollutants and handles US EPA unsupported NH3/Pb cleanly', async () => {
    const container = document.createElement('div');
    await renderPollutants(container);

    expect(container.querySelectorAll('.pollutant-card').length).toBe(8);
    expect(container.textContent).toContain('NH3');
    expect(container.textContent).toContain('Pb');

    appState.setStandard(AQI_STANDARDS.US_EPA);
    await renderPollutants(container);
    expect(container.textContent).toContain('Not in US EPA');
  });

  it('renders Historical Analysis with all 5 timeframes, date picker, and anomalies', async () => {
    const container = document.createElement('div');
    await renderHistoricalAnalysis(container);

    expect(container.querySelectorAll('.hist-tf-btn').length).toBe(5);
    expect(container.querySelector('#histStartDate')).not.toBeNull();
    expect(container.querySelector('#histEndDate')).not.toBeNull();
    expect(container.querySelector('#histExportCsvBtn')).not.toBeNull();
    expect(container.textContent).toContain('Detected Historical Anomalies');
  });

  it('renders Weather cleanly without broken HTML entities or forecast fabrication', async () => {
    const container = document.createElement('div');
    await renderWeather(container);

    expect(container.textContent).not.toContain('O&sub3');
    expect(container.textContent).not.toContain('NO&sub2');
    expect(container.textContent).toContain('NOT A LIVE FORECAST FEED');
    expect(container.textContent).toContain('METEOROLOGICAL OBSERVATIONS (SEPARATE FROM AQI)');
  });
});
