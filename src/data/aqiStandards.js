/**
 * AIRINDX Environmental Science & AQI Calculation Engine
 *
 * Implements two strictly independent AQI methodologies plus WHO 2021 health-based
 * reference guidelines (which are NOT an AQI index):
 *
 * 1. India — CPCB National Air Quality Index (NAQI)
 *    Reference: Central Pollution Control Board (CPCB), Ministry of Environment,
 *    Forest and Climate Change, Government of India — "National Air Quality Index" (2014).
 *    Scale: 0–500 across 6 categories (Good, Satisfactory, Moderately Polluted,
 *           Poor, Very Poor, Severe).
 *    Pollutants (8): PM2.5, PM10, NO2, SO2, CO, O3, NH3, Pb.
 *    Sufficiency rule: Minimum 3 valid pollutant readings, with at least one of PM2.5 or PM10.
 *
 * 2. United States — US EPA Air Quality Index (Revised May 2024)
 *    Reference: U.S. EPA-454/B-24-002, "Technical Assistance Document for the Reporting
 *    of Daily Air Quality – the Air Quality Index (AQI)" (May 2024).
 *    Scale: 0–500 across 6 categories (Good, Moderate, Unhealthy for Sensitive Groups,
 *           Unhealthy, Very Unhealthy, Hazardous).
 *    Pollutants (6): PM2.5, PM10, O3, CO, SO2, NO2.
 *
 * 3. WHO Global Air Quality Guidelines (2021)
 *    Reference: World Health Organization (2021) Global Air Quality Guidelines.
 *    Used strictly as health-based guideline concentration benchmarks, never as an AQI scale.
 */

export const AQI_STANDARDS = Object.freeze({
  CPCB_NAQI: 'CPCB_NAQI',
  US_EPA: 'US_EPA',
});

export const CPCB_CATEGORIES = Object.freeze([
  {
    key: 'GOOD',
    label: 'Good',
    min: 0,
    max: 50,
    colorToken: 'aqi-good',
    hex: '#B9ED73',
    healthImplication: 'Minimal impact.',
  },
  {
    key: 'SATISFACTORY',
    label: 'Satisfactory',
    min: 51,
    max: 100,
    colorToken: 'aqi-moderate',
    hex: '#A3D65F',
    healthImplication: 'May cause minor breathing discomfort to sensitive people.',
  },
  {
    key: 'MODERATE',
    label: 'Moderately Polluted',
    min: 101,
    max: 200,
    colorToken: 'aqi-poor',
    hex: '#F2994A',
    healthImplication:
      'May cause breathing discomfort to people with lung disease such as asthma, and discomfort to people with heart disease, children and older adults.',
  },
  {
    key: 'POOR',
    label: 'Poor',
    min: 201,
    max: 300,
    colorToken: 'aqi-unhealthy',
    hex: '#EB5757',
    healthImplication:
      'May cause breathing discomfort to people on prolonged exposure, and discomfort to people with heart disease.',
  },
  {
    key: 'VERY_POOR',
    label: 'Very Poor',
    min: 301,
    max: 400,
    colorToken: 'aqi-severe',
    hex: '#9B51E0',
    healthImplication:
      'May cause respiratory illness to the people on prolonged exposure. Effect may be more pronounced in people with lung and heart diseases.',
  },
  {
    key: 'SEVERE',
    label: 'Severe',
    min: 401,
    max: 500,
    colorToken: 'aqi-hazardous',
    hex: '#5A1A40',
    healthImplication:
      'May cause respiratory impact even on healthy people, and serious health impacts on people with lung/heart disease. The health impacts may be experienced even during light physical activity.',
  },
]);

export const EPA_CATEGORIES = Object.freeze([
  {
    key: 'GOOD',
    label: 'Good',
    min: 0,
    max: 50,
    colorToken: 'aqi-good',
    hex: '#B9ED73',
    healthImplication: 'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  {
    key: 'MODERATE',
    label: 'Moderate',
    min: 51,
    max: 100,
    colorToken: 'aqi-moderate',
    hex: '#F2C94C',
    healthImplication:
      'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
  },
  {
    key: 'USG',
    label: 'Unhealthy for Sensitive Groups',
    min: 101,
    max: 150,
    colorToken: 'aqi-poor',
    hex: '#F2994A',
    healthImplication:
      'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
  },
  {
    key: 'UNHEALTHY',
    label: 'Unhealthy',
    min: 151,
    max: 200,
    colorToken: 'aqi-unhealthy',
    hex: '#EB5757',
    healthImplication:
      'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
  },
  {
    key: 'VERY_UNHEALTHY',
    label: 'Very Unhealthy',
    min: 201,
    max: 300,
    colorToken: 'aqi-severe',
    hex: '#9B51E0',
    healthImplication: 'Health alert: The risk of health effects is increased for everyone.',
  },
  {
    key: 'HAZARDOUS',
    label: 'Hazardous',
    min: 301,
    max: 500,
    colorToken: 'aqi-hazardous',
    hex: '#5A1A40',
    healthImplication: 'Health warning of emergency conditions: everyone is more likely to be affected.',
  },
]);

/**
 * WHO 2021 Global Air Quality Guidelines (concentration benchmarks, NOT an AQI index).
 */
export const WHO_2021_GUIDELINES = Object.freeze({
  pm25: { guideline24h: 15, guidelineAnnual: 5, unit: 'µg/m³', averagingPeriod: '24-hour / Annual' },
  pm10: { guideline24h: 45, guidelineAnnual: 15, unit: 'µg/m³', averagingPeriod: '24-hour / Annual' },
  no2: { guideline24h: 25, guidelineAnnual: 10, unit: 'µg/m³', averagingPeriod: '24-hour / Annual' },
  so2: { guideline24h: 40, guidelineAnnual: null, unit: 'µg/m³', averagingPeriod: '24-hour' },
  co: { guideline24h: 4, guidelineAnnual: null, unit: 'mg/m³', averagingPeriod: '24-hour' },
  o3: { guideline8h: 100, guidelinePeakSeason: 60, unit: 'µg/m³', averagingPeriod: '8-hour' },
});

export const POLLUTANT_METADATA = Object.freeze({
  pm25: {
    id: 'pm25',
    symbol: 'PM2.5',
    name: 'Fine Particulate Matter',
    unit: 'µg/m³',
    cpcbPeriod: '24-hour',
    epaPeriod: '24-hour',
    sources: ['Vehicular exhaust', 'Fossil fuel & biomass combustion', 'Secondary sulfate/nitrate aerosols', 'Industrial emissions'],
    healthEffects: 'Penetrates deep into lung alveoli and enters the bloodstream, elevating cardiopulmonary and respiratory risks.',
  },
  pm10: {
    id: 'pm10',
    symbol: 'PM10',
    name: 'Particulate Matter (≤10 µm)',
    unit: 'µg/m³',
    cpcbPeriod: '24-hour',
    epaPeriod: '24-hour',
    sources: ['Road & construction dust', 'Industrial crushing/grinding', 'Sea salt aerosols', 'Agricultural tillage'],
    healthEffects: 'Deposits in upper airways and bronchi, triggering airway irritation, coughing, and asthma aggravation.',
  },
  no2: {
    id: 'no2',
    symbol: 'NO2',
    name: 'Nitrogen Dioxide',
    unit: 'µg/m³ (CPCB) / ppb (EPA)',
    cpcbPeriod: '24-hour',
    epaPeriod: '1-hour',
    sources: ['Diesel & petrol traffic', 'Thermal power plants', 'Industrial boilers'],
    healthEffects: 'Inflames airways, reduces lung immunity, and acts as a key precursor to ground-level ozone and secondary particulates.',
  },
  so2: {
    id: 'so2',
    symbol: 'SO2',
    name: 'Sulfur Dioxide',
    unit: 'µg/m³ (CPCB) / ppb (EPA)',
    cpcbPeriod: '24-hour',
    epaPeriod: '1-hour (24-hour ≥200 AQI)',
    sources: ['Coal power generation', 'Petroleum refineries', 'Smelting & maritime bunker fuels'],
    healthEffects: 'Constricts bronchial passages rapidly, especially impacting people with asthma during outdoor exertion.',
  },
  co: {
    id: 'co',
    symbol: 'CO',
    name: 'Carbon Monoxide',
    unit: 'mg/m³ (CPCB) / ppm (EPA)',
    cpcbPeriod: '8-hour',
    epaPeriod: '8-hour',
    sources: ['Incomplete vehicular combustion', 'Idling traffic', 'Biomass burning & generators'],
    healthEffects: 'Binds to hemoglobin to form carboxyhemoglobin, reducing oxygen delivery to organs and myocardial tissue.',
  },
  o3: {
    id: 'o3',
    symbol: 'O3',
    name: 'Ground-Level Ozone',
    unit: 'µg/m³ (CPCB) / ppm (EPA)',
    cpcbPeriod: '8-hour',
    epaPeriod: '8-hour',
    sources: ['Photochemical reaction of NOx and VOCs under sunlight (secondary pollutant)'],
    healthEffects: 'Oxidizes lung lining tissue, causes chest pain, throat irritation, and reduced pulmonary function.',
  },
  nh3: {
    id: 'nh3',
    symbol: 'NH3',
    name: 'Ammonia',
    unit: 'µg/m³',
    cpcbPeriod: '24-hour',
    epaPeriod: 'Not in US EPA AQI',
    sources: ['Agricultural fertilizers & livestock', 'Waste decomposition', 'Chemical manufacturing'],
    healthEffects: 'Irritates eyes and respiratory tract at elevated levels and reacts with acids to form secondary PM2.5.',
  },
  pb: {
    id: 'pb',
    symbol: 'Pb',
    name: 'Lead',
    unit: 'µg/m³',
    cpcbPeriod: '24-hour',
    epaPeriod: 'Not in US EPA AQI',
    sources: ['Battery recycling & smelting', 'Metal processing', 'Legacy contaminated dust resuspension'],
    healthEffects: 'Bioaccumulates in the body, impairing neurological development, renal function, and cardiovascular health.',
  },
});

/**
 * Official CPCB NAQI Breakpoints.
 * Units: PM10, PM2.5, NO2, O3, SO2, NH3, Pb in µg/m³; CO in mg/m³.
 * For open-ended Severe (> B_400) ranges, CPCB upper slope extension up to 500 is bounded explicitly.
 */
export const CPCB_BREAKPOINTS = Object.freeze({
  pm10: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    precision: 0,
    tiers: [
      { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
      { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
      { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
      { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
      { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
      { cLow: 431, cHigh: 510, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  pm25: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    precision: 0,
    tiers: [
      { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
      { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
      { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
      { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
      { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
      { cLow: 251, cHigh: 380, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  no2: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    precision: 0,
    tiers: [
      { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
      { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
      { cLow: 81, cHigh: 180, iLow: 101, iHigh: 200 },
      { cLow: 181, cHigh: 280, iLow: 201, iHigh: 300 },
      { cLow: 281, cHigh: 400, iLow: 301, iHigh: 400 },
      { cLow: 401, cHigh: 520, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  o3: {
    unit: 'µg/m³',
    averagingPeriod: '8-hour',
    precision: 0,
    tiers: [
      { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
      { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
      { cLow: 101, cHigh: 168, iLow: 101, iHigh: 200 },
      { cLow: 169, cHigh: 208, iLow: 201, iHigh: 300 },
      { cLow: 209, cHigh: 748, iLow: 301, iHigh: 400 },
      { cLow: 749, cHigh: 1000, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  co: {
    unit: 'mg/m³',
    averagingPeriod: '8-hour',
    precision: 1,
    tiers: [
      { cLow: 0.0, cHigh: 1.0, iLow: 0, iHigh: 50 },
      { cLow: 1.1, cHigh: 2.0, iLow: 51, iHigh: 100 },
      { cLow: 2.1, cHigh: 10.0, iLow: 101, iHigh: 200 },
      { cLow: 10.1, cHigh: 17.0, iLow: 201, iHigh: 300 },
      { cLow: 17.1, cHigh: 34.0, iLow: 301, iHigh: 400 },
      { cLow: 34.1, cHigh: 50.0, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  so2: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    precision: 0,
    tiers: [
      { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
      { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
      { cLow: 81, cHigh: 380, iLow: 101, iHigh: 200 },
      { cLow: 381, cHigh: 800, iLow: 201, iHigh: 300 },
      { cLow: 801, cHigh: 1600, iLow: 301, iHigh: 400 },
      { cLow: 1601, cHigh: 2400, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  nh3: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    precision: 0,
    tiers: [
      { cLow: 0, cHigh: 200, iLow: 0, iHigh: 50 },
      { cLow: 201, cHigh: 400, iLow: 51, iHigh: 100 },
      { cLow: 401, cHigh: 800, iLow: 101, iHigh: 200 },
      { cLow: 801, cHigh: 1200, iLow: 201, iHigh: 300 },
      { cLow: 1201, cHigh: 1800, iLow: 301, iHigh: 400 },
      { cLow: 1801, cHigh: 2400, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
  pb: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    precision: 2,
    tiers: [
      { cLow: 0.0, cHigh: 0.5, iLow: 0, iHigh: 50 },
      { cLow: 0.51, cHigh: 1.0, iLow: 51, iHigh: 100 },
      { cLow: 1.01, cHigh: 2.0, iLow: 101, iHigh: 200 },
      { cLow: 2.01, cHigh: 3.0, iLow: 201, iHigh: 300 },
      { cLow: 3.01, cHigh: 3.5, iLow: 301, iHigh: 400 },
      { cLow: 3.51, cHigh: 5.0, iLow: 401, iHigh: 500, openEnded: true },
    ],
  },
});

/**
 * Official U.S. EPA AQI Breakpoints (EPA-454/B-24-002, May 2024 Revision).
 */
export const EPA_BREAKPOINTS = Object.freeze({
  pm25: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    truncateDecimals: 1,
    tiers: [
      { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
      { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
      { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
      { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
      { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
      { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500 },
    ],
  },
  pm10: {
    unit: 'µg/m³',
    averagingPeriod: '24-hour',
    truncateDecimals: 0,
    tiers: [
      { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
      { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
      { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
      { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
      { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
      { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
    ],
  },
  o3: {
    unit: 'ppm',
    averagingPeriod: '8-hour',
    truncateDecimals: 3,
    tiers: [
      { cLow: 0.0, cHigh: 0.054, iLow: 0, iHigh: 50 },
      { cLow: 0.055, cHigh: 0.07, iLow: 51, iHigh: 100 },
      { cLow: 0.071, cHigh: 0.085, iLow: 101, iHigh: 150 },
      { cLow: 0.086, cHigh: 0.105, iLow: 151, iHigh: 200 },
      { cLow: 0.106, cHigh: 0.2, iLow: 201, iHigh: 300 },
    ],
  },
  co: {
    unit: 'ppm',
    averagingPeriod: '8-hour',
    truncateDecimals: 1,
    tiers: [
      { cLow: 0.0, cHigh: 4.4, iLow: 0, iHigh: 50 },
      { cLow: 4.5, cHigh: 9.4, iLow: 51, iHigh: 100 },
      { cLow: 9.5, cHigh: 12.4, iLow: 101, iHigh: 150 },
      { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
      { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
      { cLow: 30.5, cHigh: 50.4, iLow: 301, iHigh: 500 },
    ],
  },
  so2: {
    unit: 'ppb',
    averagingPeriod: '1-hour',
    truncateDecimals: 0,
    tiers: [
      { cLow: 0, cHigh: 35, iLow: 0, iHigh: 50 },
      { cLow: 36, cHigh: 75, iLow: 51, iHigh: 100 },
      { cLow: 76, cHigh: 185, iLow: 101, iHigh: 150 },
      { cLow: 186, cHigh: 304, iLow: 151, iHigh: 200 },
      // Note: Per EPA TAD, >=200 AQI uses 24-hr SO2 (305–604 -> 201–300, 605–1004 -> 301–500)
      { cLow: 305, cHigh: 604, iLow: 201, iHigh: 300, requires24hNotice: true },
      { cLow: 605, cHigh: 1004, iLow: 301, iHigh: 500, requires24hNotice: true },
    ],
  },
  no2: {
    unit: 'ppb',
    averagingPeriod: '1-hour',
    truncateDecimals: 0,
    tiers: [
      { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
      { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
      { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
      { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
      { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
      { cLow: 1250, cHigh: 2049, iLow: 301, iHigh: 500 },
    ],
  },
});

function truncateToDecimals(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor + 1e-9) / factor;
}

function roundToDecimals(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isValidConcentration(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

/**
 * Standard unit conversions at 25 °C and 1 atm (24.45 L/mol molar volume)
 * for translating between gravimetric (µg/m³ or mg/m³) and volumetric (ppb/ppm) units.
 */
const MOLAR_MASS = Object.freeze({
  no2: 46.01,
  so2: 64.07,
  o3: 48.0,
  co: 28.01,
});

export function convertConcentration(pollutantId, value, fromUnit, toUnit) {
  if (!isValidConcentration(value)) return null;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return value;

  const p = pollutantId.toLowerCase();
  const molar = MOLAR_MASS[p];

  // Mass unit scaling
  if (fromUnit === 'mg/m³' && toUnit === 'µg/m³') return value * 1000;
  if (fromUnit === 'µg/m³' && toUnit === 'mg/m³') return value / 1000;
  if (fromUnit === 'ppb' && toUnit === 'ppm') return value / 1000;
  if (fromUnit === 'ppm' && toUnit === 'ppb') return value * 1000;

  if (!molar) return null;

  // ppb <-> µg/m³ (at 25 °C, 1 atm: µg/m³ = ppb * M / 24.45)
  if (fromUnit === 'ppb' && toUnit === 'µg/m³') return (value * molar) / 24.45;
  if (fromUnit === 'µg/m³' && toUnit === 'ppb') return (value * 24.45) / molar;

  // ppm <-> mg/m³ (at 25 °C, 1 atm: mg/m³ = ppm * M / 24.45)
  if (fromUnit === 'ppm' && toUnit === 'mg/m³') return (value * molar) / 24.45;
  if (fromUnit === 'mg/m³' && toUnit === 'ppm') return (value * 24.45) / molar;

  // ppm <-> µg/m³
  if (fromUnit === 'ppm' && toUnit === 'µg/m³') return ((value * 1000) * molar) / 24.45;
  if (fromUnit === 'µg/m³' && toUnit === 'ppm') return ((value * 24.45) / molar) / 1000;

  return null;
}

function interpolateLinear(conc, tier) {
  if (tier.cHigh === tier.cLow) return tier.iLow;
  const raw = ((tier.iHigh - tier.iLow) / (tier.cHigh - tier.cLow)) * (conc - tier.cLow) + tier.iLow;
  return Math.round(raw);
}

/**
 * Calculates an individual CPCB sub-index for one pollutant.
 */
export function calculateCPCBSubIndex(pollutantId, concentration, unit = null) {
  const id = String(pollutantId || '').toLowerCase();
  const spec = CPCB_BREAKPOINTS[id];
  if (!spec) {
    return { available: false, reason: 'UNSUPPORTED_POLLUTANT', pollutantId: id };
  }
  if (!isValidConcentration(concentration)) {
    return { available: false, reason: 'INVALID_OR_MISSING_VALUE', pollutantId: id };
  }

  let normalizedValue = concentration;
  if (unit && unit !== spec.unit) {
    normalizedValue = convertConcentration(id, concentration, unit, spec.unit);
    if (!isValidConcentration(normalizedValue)) {
      return { available: false, reason: 'INCOMPATIBLE_UNIT', pollutantId: id, unit };
    }
  }

  // Round to CPCB reporting precision so continuous decimal inputs align cleanly with discrete breakpoint edges
  const rounded = roundToDecimals(normalizedValue, spec.precision);

  const matchedTier = spec.tiers.find((t) => rounded >= t.cLow && rounded <= t.cHigh);
  if (!matchedTier) {
    // Handle values above the highest defined ceiling (clamped to 500 Severe)
    const lastTier = spec.tiers[spec.tiers.length - 1];
    if (rounded > lastTier.cHigh) {
      return {
        available: true,
        standard: AQI_STANDARDS.CPCB_NAQI,
        pollutantId: id,
        concentration: roundToDecimals(normalizedValue, 2),
        unit: spec.unit,
        averagingPeriod: spec.averagingPeriod,
        subIndex: 500,
        category: getCategoryByAQI(500, AQI_STANDARDS.CPCB_NAQI),
        cappedAtMax: true,
      };
    }
    return { available: false, reason: 'OUT_OF_RANGE', pollutantId: id };
  }

  const subIndex = Math.max(0, Math.min(500, interpolateLinear(rounded, matchedTier)));
  return {
    available: true,
    standard: AQI_STANDARDS.CPCB_NAQI,
    pollutantId: id,
    concentration: roundToDecimals(normalizedValue, 2),
    unit: spec.unit,
    averagingPeriod: spec.averagingPeriod,
    subIndex,
    category: getCategoryByAQI(subIndex, AQI_STANDARDS.CPCB_NAQI),
    cappedAtMax: false,
  };
}

/**
 * Calculates overall CPCB NAQI across available pollutant concentrations.
 * Official CPCB rule: minimum 3 pollutants required, at least 1 must be PM2.5 or PM10.
 * Never substitutes missing pollutants with 0.
 */
export function calculateCPCBAQI(pollutantReadings = {}) {
  const subIndices = {};
  const validResults = [];

  for (const id of Object.keys(CPCB_BREAKPOINTS)) {
    const entry = pollutantReadings[id];
    if (entry === undefined || entry === null) continue;

    const value = typeof entry === 'object' ? entry.value : entry;
    const unit = typeof entry === 'object' ? entry.unit : null;

    if (value === undefined || value === null) continue;
    const result = calculateCPCBSubIndex(id, value, unit);
    subIndices[id] = result;
    if (result.available) {
      validResults.push(result);
    }
  }

  const hasParticulate = Boolean(subIndices.pm25?.available || subIndices.pm10?.available);

  if (validResults.length < 3 || !hasParticulate) {
    return {
      available: false,
      standard: AQI_STANDARDS.CPCB_NAQI,
      methodologyName: 'India CPCB National Air Quality Index (NAQI)',
      reason: 'INSUFFICIENT_DATA',
      message:
        'CPCB NAQI requires at least 3 valid pollutant measurements, including either PM2.5 or PM10.',
      validPollutantCount: validResults.length,
      hasParticulate,
      aqi: null,
      category: null,
      dominantPollutant: null,
      subIndices,
    };
  }

  let dominant = validResults[0];
  for (const r of validResults) {
    if (r.subIndex > dominant.subIndex) {
      dominant = r;
    }
  }

  return {
    available: true,
    standard: AQI_STANDARDS.CPCB_NAQI,
    methodologyName: 'India CPCB National Air Quality Index (NAQI)',
    aqi: dominant.subIndex,
    category: getCategoryByAQI(dominant.subIndex, AQI_STANDARDS.CPCB_NAQI),
    dominantPollutant: dominant.pollutantId.toUpperCase(),
    dominantSubIndex: dominant.subIndex,
    validPollutantCount: validResults.length,
    subIndices,
  };
}

/**
 * Calculates an individual US EPA sub-index (EPA-454/B-24-002, May 2024).
 */
export function calculateEPASubIndex(pollutantId, concentration, unit = null, { averagingPeriod = null } = {}) {
  const id = String(pollutantId || '').toLowerCase();
  const spec = EPA_BREAKPOINTS[id];
  if (!spec) {
    return { available: false, reason: 'UNSUPPORTED_POLLUTANT', pollutantId: id };
  }
  if (!isValidConcentration(concentration)) {
    return { available: false, reason: 'INVALID_OR_MISSING_VALUE', pollutantId: id };
  }

  let normalizedValue = concentration;
  if (unit && unit !== spec.unit) {
    normalizedValue = convertConcentration(id, concentration, unit, spec.unit);
    if (!isValidConcentration(normalizedValue)) {
      return { available: false, reason: 'INCOMPATIBLE_UNIT', pollutantId: id, unit };
    }
  }

  const truncated = truncateToDecimals(normalizedValue, spec.truncateDecimals);
  const matchedTier = spec.tiers.find((t) => truncated >= t.cLow && truncated <= t.cHigh);

  if (matchedTier?.requires24hNotice && averagingPeriod !== '24-hour') {
    return {
      available: false,
      reason: 'REQUIRES_24HR_SO2_ABOVE_200',
      pollutantId: id,
    };
  }

  if (!matchedTier) {
    if (id === 'o3' && truncated > 0.2) {
      return {
        available: false,
        reason: 'REQUIRES_1HR_O3_ABOVE_300',
        pollutantId: id,
      };
    }
    if (id === 'so2' && truncated > 304) {
      return {
        available: false,
        reason: 'REQUIRES_24HR_SO2_ABOVE_200',
        pollutantId: id,
      };
    }
    const lastTier = spec.tiers[spec.tiers.length - 1];
    if (truncated > lastTier.cHigh) {
      return {
        available: true,
        standard: AQI_STANDARDS.US_EPA,
        pollutantId: id,
        concentration: truncated,
        unit: spec.unit,
        averagingPeriod: spec.averagingPeriod,
        subIndex: 500,
        category: getCategoryByAQI(500, AQI_STANDARDS.US_EPA),
        cappedAtMax: true,
      };
    }
    return { available: false, reason: 'OUT_OF_RANGE', pollutantId: id };
  }

  const subIndex = Math.max(0, Math.min(500, interpolateLinear(truncated, matchedTier)));
  return {
    available: true,
    standard: AQI_STANDARDS.US_EPA,
    pollutantId: id,
    concentration: truncated,
    unit: spec.unit,
    averagingPeriod: spec.averagingPeriod,
    subIndex,
    category: getCategoryByAQI(subIndex, AQI_STANDARDS.US_EPA),
    cappedAtMax: false,
  };
}

/**
 * Calculates overall US EPA AQI across available criteria pollutant readings.
 * Returns unavailable if no valid EPA criteria pollutants are provided.
 */
export function calculateEPAAQI(pollutantReadings = {}) {
  const subIndices = {};
  const validResults = [];

  for (const id of Object.keys(EPA_BREAKPOINTS)) {
    const entry = pollutantReadings[id];
    if (entry === undefined || entry === null) continue;

    const value = typeof entry === 'object' ? entry.value : entry;
    const unit = typeof entry === 'object' ? entry.unit : null;

    if (value === undefined || value === null) continue;
    const result = calculateEPASubIndex(id, value, unit);
    subIndices[id] = result;
    if (result.available) {
      validResults.push(result);
    }
  }

  if (validResults.length === 0) {
    return {
      available: false,
      standard: AQI_STANDARDS.US_EPA,
      methodologyName: 'US EPA Air Quality Index (EPA-454/B-24-002)',
      reason: 'INSUFFICIENT_DATA',
      message: 'US EPA AQI requires at least one valid criteria pollutant reading.',
      validPollutantCount: 0,
      aqi: null,
      category: null,
      dominantPollutant: null,
      subIndices,
    };
  }

  let dominant = validResults[0];
  for (const r of validResults) {
    if (r.subIndex > dominant.subIndex) {
      dominant = r;
    }
  }

  return {
    available: true,
    standard: AQI_STANDARDS.US_EPA,
    methodologyName: 'US EPA Air Quality Index (EPA-454/B-24-002)',
    aqi: dominant.subIndex,
    category: getCategoryByAQI(dominant.subIndex, AQI_STANDARDS.US_EPA),
    dominantPollutant: dominant.pollutantId.toUpperCase(),
    dominantSubIndex: dominant.subIndex,
    validPollutantCount: validResults.length,
    subIndices,
  };
}

/**
 * Dispatches to the requested independent AQI methodology.
 */
export function calculateAQIByStandard(pollutantReadings, standard = AQI_STANDARDS.CPCB_NAQI) {
  if (standard === AQI_STANDARDS.US_EPA) {
    return calculateEPAAQI(pollutantReadings);
  }
  return calculateCPCBAQI(pollutantReadings);
}

/**
 * Maps a numeric AQI value (0-500) to its methodology-specific category.
 */
export function getCategoryByAQI(aqi, standard = AQI_STANDARDS.CPCB_NAQI) {
  if (!isValidConcentration(aqi)) return null;
  const categories = standard === AQI_STANDARDS.US_EPA ? EPA_CATEGORIES : CPCB_CATEGORIES;
  const clamped = Math.min(500, Math.round(aqi));
  return categories.find((c) => clamped >= c.min && clamped <= c.max) || categories[categories.length - 1];
}
