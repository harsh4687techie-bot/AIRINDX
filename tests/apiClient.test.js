import { describe, it, expect, vi } from 'vitest';
import { AirindxApiClient, ApiClientError } from '../src/services/apiClient.js';

describe('AirindxApiClient', () => {
  it('returns simulated demonstration data for all 8 contract methods when useMock is true', async () => {
    const client = new AirindxApiClient({ useMock: true });

    const current = await client.getCurrentAQI();
    expect(current.dataType).toBe('simulated');
    expect(current.station.city).toBe('Mumbai');

    const location = await client.getLocationAQI({ city: 'Tokyo' });
    expect(location.station.city).toBe('Tokyo');

    const pollutants = await client.getPollutants();
    expect(pollutants.pollutants.length).toBe(8);
    expect(pollutants.pollutants[0].concentration).toBeTypeOf('number');

    const history = await client.getHistoricalAQI({ range: '7d' });
    expect(history.range).toBe('7d');
    expect(history.series.length).toBe(7);

    const weather = await client.getWeather();
    expect(weather.weather.temperatureC).toBeTypeOf('number');

    const stations = await client.getMonitoringStations({ query: 'Delhi' });
    expect(stations.count).toBe(1);

    const comparison = await client.compareCities({ cities: ['mumbai-in', 'tokyo-jp'] });
    expect(comparison.cities.length).toBe(2);

    const ai = await client.sendAIMessage({ query: 'What is PM2.5?' });
    expect(ai.sections.observedConditions).toContain('Mumbai');
    expect(ai.sections.dataLimitations).toBeTruthy();
  });

  it('calls FastAPI localhost endpoint when useMock is false and handles HTTP errors safely', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    const client = new AirindxApiClient({
      baseUrl: 'http://localhost:8000',
      useMock: false,
      fetchImpl: mockFetch,
    });

    await expect(client.getCurrentAQI({ stationId: 'IND-MH-BKC-04' })).rejects.toThrow(
      ApiClientError
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/aqi/current?stationId=IND-MH-BKC-04',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
