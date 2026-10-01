import { describe, expect, it } from 'vitest';
import { parseCoords, roadMi, driveMin } from './geo';

describe('parseCoords', () => {
  it('reads plain pairs, Google Maps links and degree notation', () => {
    expect(parseCoords('40.15512, -74.82881')).toEqual({ lat: 40.15512, lon: -74.82881 });
    expect(parseCoords('https://www.google.com/maps/place/40.1551,-74.8288/@40.1,-74.8,15z')).toEqual({
      lat: 40.1551,
      lon: -74.8288,
    });
    expect(parseCoords('https://maps.google.com/?q=40.1551,-74.8288')).toEqual({
      lat: 40.1551,
      lon: -74.8288,
    });
    expect(parseCoords('40.1551° N, 74.8288° W')).toEqual({ lat: 40.1551, lon: -74.8288 });
  });
  it('rejects a value that only contains a valid-looking suffix', () => {
    expect(parseCoords('140.15512, -74.82881')).toBeNull();
    expect(parseCoords('40.15512, -1174.82881')).toBeNull();
    expect(parseCoords('nothing here')).toBeNull();
  });
});

describe('road math', () => {
  it('scales straight-line miles and never reports a zero-minute drive', () => {
    const a = { lat: 40.16, lon: -74.88 };
    const b = { lat: 40.1796, lon: -74.8747 };
    expect(roadMi(a, b)).toBeGreaterThan(1.5);
    expect(roadMi(a, b)).toBeLessThan(2.5);
    expect(driveMin(0)).toBe(1);
  });
});
