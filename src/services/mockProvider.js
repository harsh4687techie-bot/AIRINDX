/**
 * AIRINDX Mock Data Provider
 * Backs all 8 service contract methods with consistent, deterministic simulated records.
 * Every payload is tagged with dataType: 'simulated'.
 */

import { AQI_STANDARDS, POLLUTANT_METADATA, WHO_2021_GUIDELINES } from '../data/aqiStandards.js';
import {
  CITIES,
  STATIONS,
  DEMO_SOURCE,
  DEMO_TIMESTAMP,
  computeStationForStandard,
  getHistoricalSeries,
  getWeatherForStation,
  generateGroundedResponse,
} from '../data/mock/index.js';

function resolveStation({ stationId, cityId, city, standard } = {}) {
  let found = null;
  if (stationId) {
    found = STATIONS.find((s) => s.stationId === stationId);
  }
  if (!found && cityId) {
    found = STATIONS.find((s) => s.cityId === cityId);
  }
  if (!found && city) {
    const q = String(city).toLowerCase();
    found = STATIONS.find(
      (s) => s.city.toLowerCase().includes(q) || s.cityId.toLowerCase() === q
    );
  }
  const base = found || STATIONS[0];
  return computeStationForStandard(base, standard || base.methodology);
}

export const mockProvider = {
  async getCurrentAQI({ stationId, cityId, standard } = {}) {
    const station = resolveStation({ stationId, cityId, standard });
    const cityStations = STATIONS.filter((s) => s.cityId === station.cityId).map((s) =>
      computeStationForStandard(s, station.methodology)
    );
    return {
      status: 'ok',
      provider: 'mock',
      dataType: 'simulated',
      source: DEMO_SOURCE,
      timestamp: DEMO_TIMESTAMP,
      standard: station.methodology,
      station,
      cityStations,
      cities: CITIES,
    };
  },

  async getLocationAQI({ cityId, city, stationId, standard } = {}) {
    const station = resolveStation({ stationId, cityId, city, standard });
    return {
      status: 'ok',
      provider: 'mock',
      dataType: 'simulated',
      source: DEMO_SOURCE,
      timestamp: DEMO_TIMESTAMP,
      standard: station.methodology,
      station,
    };
  },

  async getPollutants({ stationId, cityId, standard } = {}) {
    const station = resolveStation({ stationId, cityId, standard });
    const items = Object.keys(POLLUTANT_METADATA).map((id) => {
      const meta = POLLUTANT_METADATA[id];
      const reading = station.pollutants[id] || null;
      const sub = station.subIndices?.[id] || null;
      const who = WHO_2021_GUIDELINES[id] || null;

      return {
        id,
        symbol: meta.symbol,
        name: meta.name,
        concentration: reading?.value ?? null,
        unit: reading?.unit ?? meta.unit,
        trendPct24h: reading?.trendPct24h ?? null,
        subIndex: sub?.available ? sub.subIndex : null,
        subIndexCategory: sub?.available ? sub.category : null,
        subIndexAvailable: Boolean(sub?.available),
        subIndexReason: sub?.available ? null : sub?.reason || 'UNAVAILABLE',
        averagingPeriod:
          station.methodology === AQI_STANDARDS.US_EPA ? meta.epaPeriod : meta.cpcbPeriod,
        whoGuideline: who,
        sources: meta.sources,
        healthEffects: meta.healthEffects,
      };
    });

    return {
      status: 'ok',
      provider: 'mock',
      dataType: 'simulated',
      source: DEMO_SOURCE,
      timestamp: DEMO_TIMESTAMP,
      cityId: station.cityId,
      stationId: station.stationId,
      stationName: station.name,
      city: station.city,
      standard: station.methodology,
      overallAqi: station.aqi,
      overallCategory: station.category,
      dominantPollutant: station.dominantPollutant,
      pollutants: items,
    };
  },

  async getHistoricalAQI({
    stationId = 'IND-MH-MUM-BKC04',
    range = '24h',
    standard = AQI_STANDARDS.CPCB_NAQI,
    metric = 'aqi',
    startDate = null,
    endDate = null,
  } = {}) {
    const payload = getHistoricalSeries({ stationId, range, standard, metric });
    let filteredSeries = payload.series;
    if (startDate && endDate && (range === '30d' || range === '90d' || range === '365d')) {
      const subset = payload.series.filter(
        (p) => p.dateIso >= startDate && p.dateIso <= endDate
      );
      if (subset.length > 0) {
        filteredSeries = subset;
      }
    }
    return {
      status: 'ok',
      provider: 'mock',
      ...payload,
      series: filteredSeries,
    };
  },

  async getWeather({ stationId = 'IND-MH-MUM-BKC04' } = {}) {
    const data = getWeatherForStation(stationId);
    return {
      status: 'ok',
      provider: 'mock',
      ...data,
    };
  },

  async getMonitoringStations({
    severity = 'ALL',
    query = '',
    country = 'ALL',
    state = 'ALL',
    city = 'ALL',
    standard = AQI_STANDARDS.CPCB_NAQI,
  } = {}) {
    const q = String(query || '').trim().toLowerCase();
    const stations = STATIONS.map((s) => computeStationForStandard(s, standard)).filter((st) => {
      if (country !== 'ALL' && st.country !== country) return false;
      if (state !== 'ALL' && st.state !== state) return false;
      if (city !== 'ALL' && st.city !== city) return false;
      if (q) {
        const hit =
          st.name.toLowerCase().includes(q) ||
          st.city.toLowerCase().includes(q) ||
          st.state.toLowerCase().includes(q) ||
          st.country.toLowerCase().includes(q) ||
          st.stationId.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (severity !== 'ALL') {
        const catKey = st.category?.key || '';
        if (severity === 'GOOD') return st.aqi <= 50;
        if (severity === 'MODERATE') return st.aqi > 50 && st.aqi <= 100;
        if (severity === 'POOR') return st.aqi > 100 && st.aqi <= 200;
        if (severity === 'UNHEALTHY') return st.aqi > 200 && st.aqi <= 300;
        if (severity === 'SEVERE') return st.aqi > 300 || catKey === 'VERY_POOR' || catKey === 'SEVERE';
      }
      return true;
    });

    return {
      status: 'ok',
      provider: 'mock',
      dataType: 'simulated',
      source: DEMO_SOURCE,
      timestamp: DEMO_TIMESTAMP,
      standard,
      count: stations.length,
      stations,
      cities: CITIES,
    };
  },

  async compareCities({
    cities = ['mumbai-in', 'delhi-in', 'pune-in', 'tokyo-jp'],
    timeframe = 'live',
    standard = AQI_STANDARDS.CPCB_NAQI,
  } = {}) {
    const factor =
      timeframe === '24h' ? 0.94 : timeframe === '7d' ? 0.89 : timeframe === '30d' ? 0.84 : 1.0;

    const selected = cities
      .map((cityKey) => {
        const keyLower = String(cityKey).toLowerCase();
        const cityObj = CITIES.find(
          (c) => c.cityId.toLowerCase() === keyLower || c.name.toLowerCase() === keyLower
        );
        if (!cityObj) return null;
        const baseStation = STATIONS.find((s) => s.stationId === cityObj.defaultStationId);
        if (!baseStation) return null;

        const scaledPollutants = {};
        for (const [k, v] of Object.entries(baseStation.pollutants)) {
          scaledPollutants[k] = {
            value: Number((v.value * factor).toFixed(2)),
            unit: v.unit,
          };
        }
        const computed = computeStationForStandard(
          { ...baseStation, pollutants: scaledPollutants },
          standard
        );
        const history = getHistoricalSeries({
          stationId: baseStation.stationId,
          range: timeframe === '7d' ? '7d' : timeframe === '30d' ? '30d' : '24h',
          standard,
        });

        return {
          cityId: cityObj.cityId,
          city: cityObj.name,
          state: cityObj.state,
          country: cityObj.country,
          stationId: baseStation.stationId,
          stationName: baseStation.name,
          regionLabel: cityObj.regionLabel,
          aqi: computed.aqi,
          category: computed.category,
          dominantPollutant: computed.dominantPollutant,
          pollutants: scaledPollutants,
          weather: baseStation.weather,
          historySummary: history.summary,
          historySeries: history.series,
          methodology: standard,
          source: DEMO_SOURCE,
          timestamp: DEMO_TIMESTAMP,
          dataType: 'simulated',
        };
      })
      .filter(Boolean);

    // Rank cleanly from lowest (best air quality) to highest AQI when all records share the same standard
    const ranked = [...selected]
      .sort((a, b) => (a.aqi ?? 9999) - (b.aqi ?? 9999))
      .map((item, index) => ({
        ...item,
        rankBestToWorst: index + 1,
      }));

    return {
      status: 'ok',
      provider: 'mock',
      dataType: 'simulated',
      source: DEMO_SOURCE,
      timestamp: DEMO_TIMESTAMP,
      timeframe,
      standard,
      rankingMethodology: `Cities are ranked ascending by ${
        standard === AQI_STANDARDS.US_EPA ? 'US EPA AQI (May 2024)' : 'India CPCB NAQI'
      } under unified gravimetric units (µg/m³ for particulates/gases, mg/m³ for CO). Lower index = better air quality.`,
      bestCity: ranked[0] || null,
      worstCity: ranked[ranked.length - 1] || null,
      cities: selected,
      ranked,
      availableCities: CITIES,
    };
  },

  async sendAIMessage({ query, stationId = 'IND-MH-MUM-BKC04', standard = AQI_STANDARDS.CPCB_NAQI } = {}) {
    return generateGroundedResponse({ query, stationId, standard });
  },
};
