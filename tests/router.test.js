import { describe, it, expect } from 'vitest';
import { ROUTES, normalizeRoute } from '../src/router.js';

describe('AIRINDX router', () => {
  it('supports all seven required application routes', () => {
    expect(ROUTES).toEqual([
      '/',
      '/explore-map',
      '/pollutants',
      '/history',
      '/weather',
      '/ai-assistant',
      '/comparison',
    ]);
  });

  it('normalizes valid and unknown hashes safely', () => {
    expect(normalizeRoute('')).toBe('/');
    expect(normalizeRoute('#/explore-map')).toBe('/explore-map');
    expect(normalizeRoute('#/unknown-route')).toBe('/');
  });
});
