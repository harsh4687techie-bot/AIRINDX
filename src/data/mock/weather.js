/**
 * AIRINDX Demonstration Weather & Boundary Layer Dynamics Dataset
 * Explicitly separates meteorological telemetry from air quality AQI records.
 * Clearly labels simulated outlooks and washout scenario models.
 */

import { STATIONS } from './stations.js';
import { DEMO_SOURCE, DEMO_TIMESTAMP } from './cities.js';

export function getWeatherForStation(stationId = 'IND-MH-MUM-BKC04') {
  const station = STATIONS.find((s) => s.stationId === stationId) || STATIONS[0];
  const w = station.weather;

  // Deterministic 24-hour boundary layer & wind correlation points derived from station weather
  const hourlyCorrelation = [
    { hour: '02:00', windKmh: Math.max(4, Math.round(w.windSpeedKmh * 0.55)), pblM: Math.round(w.pblHeightM * 0.48), pm25: Number((station.pollutants.pm25.value * 1.12).toFixed(1)) },
    { hour: '06:00', windKmh: Math.max(4, Math.round(w.windSpeedKmh * 0.5)), pblM: Math.round(w.pblHeightM * 0.42), pm25: Number((station.pollutants.pm25.value * 1.24).toFixed(1)) },
    { hour: '10:00', windKmh: Math.max(5, Math.round(w.windSpeedKmh * 0.72)), pblM: Math.round(w.pblHeightM * 0.78), pm25: Number((station.pollutants.pm25.value * 1.08).toFixed(1)) },
    { hour: '14:00', windKmh: Math.round(w.windSpeedKmh * 1.05), pblM: Math.round(w.pblHeightM * 1.25), pm25: Number((station.pollutants.pm25.value * 0.85).toFixed(1)) },
    { hour: '17:00', windKmh: Math.round(w.windSpeedKmh * 1.28), pblM: Math.round(w.pblHeightM * 1.18), pm25: Number((station.pollutants.pm25.value * 0.74).toFixed(1)) },
    { hour: '20:00', windKmh: Math.round(w.windSpeedKmh * 1.0), pblM: Math.round(w.pblHeightM * 0.88), pm25: Number((station.pollutants.pm25.value * 0.92).toFixed(1)) },
    { hour: '23:00', windKmh: Math.max(5, Math.round(w.windSpeedKmh * 0.68)), pblM: Math.round(w.pblHeightM * 0.62), pm25: Number((station.pollutants.pm25.value * 1.04).toFixed(1)) },
  ];

  // Ventilation coefficient = wind speed (m/s) * mixing height (m)
  const windMs = Number((w.windSpeedKmh / 3.6).toFixed(2));
  const ventilationCoefficient = Math.round(windMs * w.pblHeightM);

  const dispersionStatus =
    ventilationCoefficient >= 6000
      ? 'High Dispersion Capacity'
      : ventilationCoefficient >= 3000
      ? 'Moderate Dispersion Capacity'
      : 'Low Dispersion / Stagnation Risk';

  // Clearly labeled simulated 5-day outlook (not a live meteorological forecast feed)
  const simulatedOutlook = [
    { day: 'Day 1', tempHighC: Math.round(w.temperatureC + 1), tempLowC: Math.round(w.temperatureC - 5), windKmh: w.windSpeedKmh, windCardinal: w.windCardinal, condition: w.condition },
    { day: 'Day 2', tempHighC: Math.round(w.temperatureC + 2), tempLowC: Math.round(w.temperatureC - 4), windKmh: Math.max(4, w.windSpeedKmh - 2), windCardinal: w.windCardinal, condition: 'Warm Haze' },
    { day: 'Day 3', tempHighC: Math.round(w.temperatureC + 1), tempLowC: Math.round(w.temperatureC - 5), windKmh: w.windSpeedKmh + 2, windCardinal: w.windCardinal, condition: 'Partly Cloudy' },
    { day: 'Day 4', tempHighC: Math.round(w.temperatureC - 1), tempLowC: Math.round(w.temperatureC - 6), windKmh: w.windSpeedKmh + 6, windCardinal: w.windCardinal, condition: 'Breezy Clearing' },
    { day: 'Day 5', tempHighC: Math.round(w.temperatureC), tempLowC: Math.round(w.temperatureC - 5), windKmh: w.windSpeedKmh + 3, windCardinal: w.windCardinal, condition: 'Fair' },
  ];

  return {
    cityId: station.cityId,
    stationId: station.stationId,
    city: station.city,
    state: station.state,
    country: station.country,
    stationName: station.name,
    timestamp: DEMO_TIMESTAMP,
    source: DEMO_SOURCE,
    dataType: 'simulated',
    forecastAvailable: false,
    forecastNotice:
      'Live meteorological forecast feed is not connected. Scenario outlook and rain washout models below are labeled simulated demonstrations.',
    weather: {
      ...w,
      windSpeedMs: windMs,
      ventilationCoefficientM2s: ventilationCoefficient,
      dispersionStatus,
    },
    hourlyCorrelation,
    simulatedOutlook,
  };
}
