/**
 * AIRINDX Grounded AI Assistant Demonstration Scenarios & Safe Responder
 * Strictly uses the active station's computed telemetry and refuses to invent
 * measurements, stations, or forecasts. Enforces prompt-injection resistance.
 */

import {
  AQI_STANDARDS,
  POLLUTANT_METADATA,
  WHO_2021_GUIDELINES,
} from '../aqiStandards.js';
import { STATIONS, computeStationForStandard } from './stations.js';
import { getHistoricalSeries } from './history.js';
import { sanitizeUserInput } from '../../utils/sanitize.js';

export const QUICK_PROMPTS = [
  'Is it safe to exercise outdoors right now?',
  'Explain the dominant pollutant and current AQI value.',
  'What are the 24-hour historical trends for this station?',
  'Compare this station with nearby cities.',
  'What practical steps reduce indoor particulate exposure?',
];

const INJECTION_PATTERNS = [
  /ignore (all|previous|prior) instructions/i,
  /reveal (your|the) system prompt/i,
  /system\s*:/i,
  /api[_\s-]?key/i,
  /execute\s+(shell|code|tool)/i,
];

export function detectPromptInjection(query) {
  return INJECTION_PATTERNS.some((rx) => rx.test(query));
}

export function generateGroundedResponse({
  query,
  stationId = 'IND-MH-MUM-BKC04',
  standard = AQI_STANDARDS.CPCB_NAQI,
} = {}) {
  const cleanQuery = sanitizeUserInput(query, 600);
  const rawStation = STATIONS.find((s) => s.stationId === stationId) || STATIONS[0];
  const station = computeStationForStandard(rawStation, standard);
  const history = getHistoricalSeries({ stationId: station.stationId, range: '24h', standard });
  const domKey = (station.dominantPollutant || 'PM25').toLowerCase();
  const domReading = station.pollutants[domKey] || station.pollutants.pm25;
  const domMeta = POLLUTANT_METADATA[domKey] || POLLUTANT_METADATA.pm25;
  const who24h = WHO_2021_GUIDELINES.pm25.guideline24h;
  const pm25Val = station.pollutants.pm25?.value;
  const pm25Ratio = typeof pm25Val === 'number' ? (pm25Val / who24h).toFixed(1) : null;

  if (!cleanQuery) {
    return {
      status: 'error',
      message: 'Please enter a valid air quality question.',
    };
  }

  if (detectPromptInjection(cleanQuery)) {
    return {
      status: 'ok',
      provider: 'mock-grounded',
      dataType: 'simulated',
      stationId: station.stationId,
      timestamp: station.timestamp,
      groundedContext: {
        city: station.city,
        stationName: station.name,
        aqi: station.aqi,
        standard: station.methodology,
        category: station.category?.label || 'Unavailable',
        dominantPollutant: station.dominantPollutant,
      },
      sections: {
        observedConditions: `${station.city} (${station.name}) shows a simulated ${station.methodology} reading of ${station.aqi ?? 'Unavailable'} (${station.category?.label || 'Unknown'}).`,
        interpretation:
          'Your input included instruction-override phrasing. AIRINDX treats retrieved telemetry and user queries strictly as environmental data and does not expose system instructions or execute commands.',
        recommendations:
          'Ask a direct question about pollutant levels, historical trends, weather dispersion, or exposure precautions for the selected station.',
        dataLimitations:
          'Running in local simulated demonstration mode. General environmental information only — not medical advice.',
      },
      disclaimer:
        'General environmental information only; consult a qualified healthcare professional for personal medical advice.',
    };
  }

  const qLower = cleanQuery.toLowerCase();
  const aqiLabel = station.category?.label || 'Unavailable';
  const aqiVal = station.aqi ?? 'Unavailable';
  const stdLabel =
    station.methodology === AQI_STANDARDS.US_EPA ? 'US EPA (May 2024)' : 'India CPCB NAQI';

  const observedConditions =
    `Selected station: ${station.name}, ${station.city}, ${station.state} (${station.stationId}). ` +
    `Simulated ${stdLabel} AQI is ${aqiVal} (${aqiLabel}), driven by ${domMeta.symbol} (${domMeta.name}) at ${domReading?.value ?? 'N/A'} ${domReading?.unit || ''}. ` +
    `PM2.5 is ${pm25Val ?? 'N/A'} µg/m³${pm25Ratio ? ` (${pm25Ratio}× the WHO 2021 24-hour guideline of ${who24h} µg/m³)` : ''}, ` +
    `PM10 is ${station.pollutants.pm10?.value ?? 'N/A'} µg/m³, with ${station.weather.windSpeedKmh} km/h ${station.weather.windCardinal} wind and ${station.weather.humidityPct}% relative humidity.`;

  let interpretation;
  let recommendations;

  if (qLower.includes('exercise') || qLower.includes('run') || qLower.includes('jog') || qLower.includes('outdoor')) {
    const isHigh = typeof station.aqi === 'number' && station.aqi > 150;
    const isModerate = typeof station.aqi === 'number' && station.aqi > 100 && station.aqi <= 150;
    interpretation = isHigh
      ? `At ${aqiVal} (${aqiLabel}), breathing rates during vigorous outdoor exercise substantially increase inhaled ${domMeta.symbol} dosage. Simulated 24h peak occurs around ${history.summary.peakLabel} (${history.summary.max} AQI), while the lowest window is around ${history.summary.minLabel} (${history.summary.min} AQI).`
      : isModerate
      ? `At ${aqiVal} (${aqiLabel}), moderate outdoor activity is tolerable for most healthy adults, though sensitive groups (asthma, cardiovascular or respiratory conditions) may experience mild symptoms.`
      : `At ${aqiVal} (${aqiLabel}), ambient particulate and gas concentrations are within lower risk tiers in the current simulated snapshot.`;
    recommendations = isHigh
      ? 'Shift vigorous cardio indoors to a well-ventilated or HEPA-filtered space; if commuting outdoors, consider a well-fitted N95/FFP2 respirator and check lower-AQI windows.'
      : isModerate
      ? 'Prefer lower-traffic routes away from arterial roads and schedule longer workouts during the cleaner diurnal window around ' + history.summary.minLabel + '.'
      : 'Outdoor exercise is generally favorable under these simulated conditions; stay alert to local dust or traffic corridors.';
  } else if (qLower.includes('trend') || qLower.includes('history') || qLower.includes('24') || qLower.includes('spike')) {
    interpretation =
      `Across the simulated 24-hour series for ${station.city}, AQI ranges from a low of ${history.summary.min} around ${history.summary.minLabel} ` +
      `to a peak of ${history.summary.max} around ${history.summary.peakLabel}, with a 24-hour mean of ${history.summary.mean}. ` +
      `Lower planetary boundary layer height (${station.weather.pblHeightM} m) and lighter morning winds tend to trap primary emissions near ground level.`;
    recommendations =
      'Use the Historical Analysis page to inspect 7-day, 30-day, and seasonal windows or export CSV records for detailed comparison.';
  } else if (qLower.includes('compare') || qLower.includes('city') || qLower.includes('cleaner') || qLower.includes('nearby')) {
    const peers = STATIONS.filter((s) => s.stationId !== station.stationId)
      .slice(0, 3)
      .map((s) => computeStationForStandard(s, standard))
      .map((s) => `${s.city} (${s.aqi} ${s.methodology})`)
      .join(', ');
    interpretation =
      `Within the demonstration dataset using ${stdLabel}, ${station.city} (${aqiVal}) can be benchmarked directly against ${peers}. ` +
      `Regional differences reflect coastal vs. inland basin dispersion, traffic density, and boundary layer depth.`;
    recommendations =
      'Open the City Comparison page to benchmark up to multiple cities side-by-side under a consistent AQI methodology.';
  } else if (qLower.includes('mask') || qLower.includes('indoor') || qLower.includes('reduce') || qLower.includes('precaution')) {
    interpretation =
      `${domMeta.symbol} (${domMeta.name}) originates primarily from ${domMeta.sources.slice(0, 2).join(' and ').toLowerCase()}. ` +
      `Fine particles (<2.5 µm) bypass simple cloth coverings and remain suspended indoors without filtration.`;
    recommendations =
      'Keep windows closed during peak traffic/inversion hours, run a true HEPA (H13) purifier indoors when AQI exceeds 100, use recirculate mode in vehicles, and wear a certified N95/FFP2 respirator with a tight facial seal during elevated outdoor exposure.';
  } else {
    interpretation =
      `${domMeta.symbol} is currently the dominant driver of the ${aqiVal} (${aqiLabel}) index at ${station.name}. ` +
      `${domMeta.healthEffects} Primary regional sources include ${domMeta.sources.join(', ').toLowerCase()}.`;
    recommendations =
      station.category?.healthImplication ||
      'Monitor local conditions and reduce prolonged outdoor exertion near heavy traffic when AQI exceeds 100.';
  }

  return {
    status: 'ok',
    provider: 'mock-grounded',
    dataType: 'simulated',
    stationId: station.stationId,
    timestamp: station.timestamp,
    groundedContext: {
      city: station.city,
      stationName: station.name,
      aqi: station.aqi,
      standard: station.methodology,
      category: aqiLabel,
      dominantPollutant: station.dominantPollutant,
    },
    sections: {
      observedConditions,
      interpretation,
      recommendations,
      dataLimitations:
        'All measurements shown are simulated demonstration records (dataType: "simulated") calibrated to CPCB/OpenAQ schemas. Live sensor telemetry, real-time forecasts, and Gemini LLM inference require connecting the FastAPI backend.',
    },
    disclaimer:
      'General environmental health guidance only — not personal medical advice. Consult a qualified clinician for respiratory or cardiovascular conditions.',
  };
}
