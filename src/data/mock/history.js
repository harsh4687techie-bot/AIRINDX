/**
 * AIRINDX Deterministic Historical Demonstration Series
 * Generates consistent 24h, 7d, 30d, 90d, and 365d series derived from each
 * station's baseline pollutant concentrations and calculated via aqiStandards.js.
 */

import { calculateAQIByStandard, AQI_STANDARDS } from '../aqiStandards.js';
import { STATIONS, computeStationForStandard } from './stations.js';
import { DEMO_SOURCE, DEMO_TIMESTAMP } from './cities.js';

// Deterministic diurnal multiplier profile (00:00 -> 23:00 IST)
const DIURNAL_FACTORS = [
  0.76, 0.72, 0.68, 0.64, 0.62, 0.60,
  0.74, 0.92, 1.08, 1.18, 1.24, 1.20,
  1.06, 0.96, 0.90, 0.82, 0.72, 0.64,
  0.58, 0.56, 0.64, 0.72, 0.78, 0.80,
];

function deterministicWave(index, seed) {
  const val = Math.sin(index * 0.85 + seed * 1.37) * 0.14 + Math.cos(index * 0.42 + seed) * 0.08;
  return 1 + val;
}

function scalePollutants(basePollutants, factor) {
  const scaled = {};
  for (const [key, entry] of Object.entries(basePollutants)) {
    scaled[key] = {
      value: Number((entry.value * factor).toFixed(2)),
      unit: entry.unit,
    };
  }
  return scaled;
}

const RANGE_SPECS = {
  '24h': { count: 24, stepLabel: (i) => `${String(i).padStart(2, '0')}:00`, period: '1-hour simulated interval' },
  '7d': { count: 7, stepLabel: (i) => `Day -${6 - i === 0 ? 'Today' : `${6 - i}d`}`, period: '24-hour daily mean' },
  '30d': { count: 30, stepLabel: (i) => `D-${29 - i}`, period: '24-hour daily mean' },
  '90d': { count: 18, stepLabel: (i) => `W-${17 - i}`, period: '5-day rolling mean' },
  '365d': { count: 12, stepLabel: (i) => ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][i], period: 'Monthly mean' },
};

export function getHistoricalSeries({
  stationId = 'IND-MH-MUM-BKC04',
  range = '24h',
  standard = AQI_STANDARDS.CPCB_NAQI,
  metric = 'aqi',
} = {}) {
  const baseStation = STATIONS.find((s) => s.stationId === stationId) || STATIONS[0];
  const resolvedStation = computeStationForStandard(baseStation, standard);
  const spec = RANGE_SPECS[range] || RANGE_SPECS['24h'];
  const seed = stationId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const points = [];
  for (let i = 0; i < spec.count; i++) {
    let factor;
    if (range === '24h') {
      factor = DIURNAL_FACTORS[i];
    } else if (range === '365d') {
      // Seasonal India monsoon dip (Jun-Sep) & winter peak (Nov-Feb)
      const seasonal = [1.28, 1.24, 1.08, 0.96, 0.92, 0.65, 0.48, 0.46, 0.58, 0.92, 1.16, 1.22];
      factor = seasonal[i] * deterministicWave(i, seed);
    } else {
      factor = deterministicWave(i, seed);
    }

    const scaledPollutants = scalePollutants(baseStation.pollutants, factor);
    const evalResult = calculateAQIByStandard(scaledPollutants, standard);
    const windSpeedKmh = Math.max(
      3,
      Math.round(baseStation.weather.windSpeedKmh * (range === '24h' && i >= 16 && i <= 20 ? 1.35 : 1 / Math.max(0.65, factor)))
    );

    const dayDate = new Date('2026-11-25T01:00:00+05:30');
    if (range === '24h') {
      dayDate.setHours(dayDate.getHours() - (spec.count - 1 - i));
    } else if (range === '7d' || range === '30d') {
      dayDate.setDate(dayDate.getDate() - (spec.count - 1 - i));
    } else if (range === '90d') {
      dayDate.setDate(dayDate.getDate() - (spec.count - 1 - i) * 5);
    } else {
      dayDate.setMonth(dayDate.getMonth() - (spec.count - 1 - i));
    }

    points.push({
      index: i,
      label: spec.stepLabel(i),
      dateIso: dayDate.toISOString().slice(0, 10),
      timestamp: dayDate.toISOString(),
      cityId: baseStation.cityId,
      stationId: baseStation.stationId,
      source: DEMO_SOURCE,
      methodology: standard,
      dataType: 'simulated',
      averagingPeriod: spec.period,
      pollutants: scaledPollutants,
      aqi: evalResult.aqi,
      category: evalResult.category,
      windSpeedKmh,
      value:
        metric === 'aqi'
          ? evalResult.aqi
          : metric === 'wind'
          ? windSpeedKmh
          : scaledPollutants[metric]?.value ?? evalResult.aqi,
      unit:
        metric === 'aqi'
          ? standard === AQI_STANDARDS.US_EPA
            ? 'US EPA AQI'
            : 'CPCB NAQI'
          : metric === 'wind'
          ? 'km/h'
          : scaledPollutants[metric]?.unit || 'µg/m³',
    });
  }

  const values = points.map((p) => p.value).filter((v) => typeof v === 'number');
  const mean = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
  const maxVal = values.length ? Math.max(...values) : null;
  const minVal = values.length ? Math.min(...values) : null;
  const peakPoint = points.find((p) => p.value === maxVal) || null;
  const minPoint = points.find((p) => p.value === minVal) || null;

  // Identify deterministic anomalies (> 1.25 * mean)
  const anomalies = mean
    ? points
        .filter((p) => p.value >= mean * 1.22)
        .slice(0, 3)
        .map((p) => ({
          label: p.label,
          dateIso: p.dateIso,
          value: p.value,
          unit: p.unit,
          note: `Elevated spike (+${Math.round(((p.value - mean) / mean) * 100)}% vs series mean)`,
        }))
    : [];

  return {
    cityId: baseStation.cityId,
    stationId: baseStation.stationId,
    stationName: baseStation.name,
    cityName: baseStation.city,
    range,
    metric,
    standard,
    dataType: 'simulated',
    source: DEMO_SOURCE,
    timestamp: DEMO_TIMESTAMP,
    averagingPeriod: spec.period,
    currentStation: resolvedStation,
    summary: {
      mean,
      min: minVal,
      max: maxVal,
      peakLabel: peakPoint?.label || '—',
      minLabel: minPoint?.label || '—',
    },
    anomalies,
    series: points,
  };
}
