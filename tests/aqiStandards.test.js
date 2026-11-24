import { describe, it, expect } from 'vitest';
import {
  AQI_STANDARDS,
  calculateCPCBSubIndex,
  calculateCPCBAQI,
  calculateEPASubIndex,
  calculateAQIByStandard,
  convertConcentration,
  getCategoryByAQI,
} from '../src/data/aqiStandards.js';

describe('CPCB National Air Quality Index (India)', () => {
  it('computes exact CPCB breakpoint boundaries across all 6 categories for PM2.5', () => {
    expect(calculateCPCBSubIndex('pm25', 0).subIndex).toBe(0);
    expect(calculateCPCBSubIndex('pm25', 30).subIndex).toBe(50);
    expect(calculateCPCBSubIndex('pm25', 30).category.label).toBe('Good');

    expect(calculateCPCBSubIndex('pm25', 31).subIndex).toBe(51);
    expect(calculateCPCBSubIndex('pm25', 60).subIndex).toBe(100);
    expect(calculateCPCBSubIndex('pm25', 60).category.label).toBe('Satisfactory');

    expect(calculateCPCBSubIndex('pm25', 61).subIndex).toBe(101);
    expect(calculateCPCBSubIndex('pm25', 90).subIndex).toBe(200);
    expect(calculateCPCBSubIndex('pm25', 90).category.label).toBe('Moderately Polluted');

    expect(calculateCPCBSubIndex('pm25', 91).subIndex).toBe(201);
    expect(calculateCPCBSubIndex('pm25', 120).subIndex).toBe(300);
    expect(calculateCPCBSubIndex('pm25', 120).category.label).toBe('Poor');

    expect(calculateCPCBSubIndex('pm25', 121).subIndex).toBe(301);
    expect(calculateCPCBSubIndex('pm25', 250).subIndex).toBe(400);
    expect(calculateCPCBSubIndex('pm25', 250).category.label).toBe('Very Poor');

    expect(calculateCPCBSubIndex('pm25', 251).subIndex).toBe(401);
    expect(calculateCPCBSubIndex('pm25', 251).category.label).toBe('Severe');
  });

  it('supports all 8 CPCB pollutants including NH3 and Pb', () => {
    const readings = {
      pm25: { value: 75, unit: 'µg/m³' }, // (200-101)/(90-61)*(75-61)+101 = 149
      pm10: { value: 142, unit: 'µg/m³' },
      no2: { value: 50, unit: 'µg/m³' },
      so2: { value: 18, unit: 'µg/m³' },
      co: { value: 1.5, unit: 'mg/m³' },
      o3: { value: 45, unit: 'µg/m³' },
      nh3: { value: 120, unit: 'µg/m³' },
      pb: { value: 0.4, unit: 'µg/m³' },
    };
    const result = calculateCPCBAQI(readings);
    expect(result.available).toBe(true);
    expect(result.validPollutantCount).toBe(8);
    expect(result.dominantPollutant).toBe('PM25');
    expect(result.aqi).toBe(calculateCPCBSubIndex('pm25', 75).subIndex);
    expect(result.category.label).toBe('Moderately Polluted');
    expect(result.subIndices.nh3.subIndex).toBe(30);
    expect(result.subIndices.pb.subIndex).toBe(40);
  });

  it('enforces CPCB sufficiency rule (>=3 pollutants AND PM2.5 or PM10 present)', () => {
    const noParticulate = calculateCPCBAQI({
      no2: { value: 60, unit: 'µg/m³' },
      so2: { value: 25, unit: 'µg/m³' },
      co: { value: 1.2, unit: 'mg/m³' },
    });
    expect(noParticulate.available).toBe(false);
    expect(noParticulate.reason).toBe('INSUFFICIENT_DATA');
    expect(noParticulate.aqi).toBeNull();

    const fewerThanThree = calculateCPCBAQI({
      pm25: { value: 80, unit: 'µg/m³' },
      no2: { value: 40, unit: 'µg/m³' },
    });
    expect(fewerThanThree.available).toBe(false);
    expect(fewerThanThree.reason).toBe('INSUFFICIENT_DATA');
  });

  it('rejects negative, NaN, or missing pollutant values without substituting 0', () => {
    expect(calculateCPCBSubIndex('pm25', -5).available).toBe(false);
    expect(calculateCPCBSubIndex('pm25', Number.NaN).available).toBe(false);
    expect(calculateCPCBSubIndex('pm25', null).available).toBe(false);

    const mixed = calculateCPCBAQI({
      pm25: { value: null, unit: 'µg/m³' },
      pm10: { value: 80, unit: 'µg/m³' },
      no2: { value: -10, unit: 'µg/m³' },
      so2: { value: 20, unit: 'µg/m³' },
    });
    expect(mixed.available).toBe(false);
    expect(mixed.subIndices.pm25).toBeUndefined();
    expect(mixed.subIndices.no2.available).toBe(false);
  });
});

describe('US EPA Air Quality Index (EPA-454/B-24-002, May 2024)', () => {
  it('uses updated 2024 PM2.5 breakpoints and truncation rules', () => {
    expect(calculateEPASubIndex('pm25', 9.04).subIndex).toBe(50); // truncates to 9.0
    expect(calculateEPASubIndex('pm25', 9.04).category.label).toBe('Good');

    expect(calculateEPASubIndex('pm25', 9.1).subIndex).toBe(51);
    expect(calculateEPASubIndex('pm25', 35.4).subIndex).toBe(100);
    expect(calculateEPASubIndex('pm25', 35.5).subIndex).toBe(101);
    expect(calculateEPASubIndex('pm25', 35.5).category.label).toBe('Unhealthy for Sensitive Groups');
    expect(calculateEPASubIndex('pm25', 225.5).subIndex).toBe(301);
    expect(calculateEPASubIndex('pm25', 225.5).category.label).toBe('Hazardous');
  });

  it('computes EPA AQI independently from CPCB for identical PM2.5 concentrations', () => {
    // 50 µg/m³ PM2.5: CPCB = Satisfactory (83), US EPA 2024 = USG (138)
    const sample = {
      pm25: { value: 50, unit: 'µg/m³' },
      pm10: { value: 60, unit: 'µg/m³' },
      no2: { value: 20, unit: 'ppb' },
    };
    const cpcb = calculateAQIByStandard(sample, AQI_STANDARDS.CPCB_NAQI);
    const epa = calculateAQIByStandard(sample, AQI_STANDARDS.US_EPA);

    expect(cpcb.aqi).toBeLessThan(101);
    expect(cpcb.category.label).toBe('Satisfactory');

    expect(epa.aqi).toBeGreaterThan(100);
    expect(epa.category.label).toBe('Unhealthy for Sensitive Groups');
  });

  it('converts ppb/ppm and µg/m³/mg/m³ units accurately', () => {
    // O3 60 ppb == 0.060 ppm -> EPA Moderate
    const o3Sub = calculateEPASubIndex('o3', 60, 'ppb');
    expect(o3Sub.available).toBe(true);
    expect(o3Sub.unit).toBe('ppm');
    expect(o3Sub.subIndex).toBeGreaterThanOrEqual(51);

    const no2Ug = convertConcentration('no2', 53, 'ppb', 'µg/m³');
    expect(no2Ug).toBeCloseTo(99.74, 1);
  });

  it('returns null category for invalid AQI values and flags EPA O3/SO2 upper averaging rules', () => {
    expect(getCategoryByAQI(null, AQI_STANDARDS.CPCB_NAQI)).toBeNull();
    expect(getCategoryByAQI(-1, AQI_STANDARDS.US_EPA)).toBeNull();

    const o3High = calculateEPASubIndex('o3', 0.25, 'ppm');
    expect(o3High.available).toBe(false);
    expect(o3High.reason).toBe('REQUIRES_1HR_O3_ABOVE_300');

    const so2High = calculateEPASubIndex('so2', 350, 'ppb');
    expect(so2High.available).toBe(false);
    expect(so2High.reason).toBe('REQUIRES_24HR_SO2_ABOVE_200');
  });
});
