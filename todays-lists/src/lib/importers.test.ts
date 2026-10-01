import { describe, expect, it } from 'vitest';
import { finishImport, importRecords, kindFromTags, packImports, unpackImports } from './importers';
import { DEFAULT_BASES } from '../data/catalog';

const overpass = JSON.stringify({
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 40.18,
      lon: -74.87,
      tags: {
        name: 'Zumiez',
        shop: 'clothes',
        'addr:housenumber': '2300',
        'addr:street': 'E Lincoln Hwy',
        'addr:city': 'Langhorne',
        'addr:state': 'PA',
        'addr:postcode': '19047',
        phone: '+1 215 757 3951',
      },
    },
    {
      type: 'way',
      id: 2,
      center: { lat: 40.17, lon: -74.86 },
      tags: { name: 'Mike’s Shoe Repair', shop: 'shoe_repair' },
    },
    { type: 'node', id: 3, lat: 40.17, lon: -74.86, tags: { shop: 'shoes' } }, // no name: skipped
    { type: 'node', id: 4, lat: 40.1, lon: -74.9, tags: { name: 'Best Buy', shop: 'electronics' } },
    { type: 'node', id: 5, lat: 45.0, lon: -70.0, tags: { name: 'Far Away Shoes', shop: 'shoes' } },
  ],
});

describe('importRecords', () => {
  it('reads Overpass JSON with nodes and way centers', () => {
    const recs = importRecords(overpass);
    expect(recs.map((r) => r.name)).toEqual(['Zumiez', 'Mike’s Shoe Repair', 'Best Buy', 'Far Away Shoes']);
    expect(recs[0]).toMatchObject({
      kind: 'skate',
      chain: 'zumiez',
      addr: '2300 E Lincoln Hwy',
      city: 'Langhorne',
      st: 'PA',
      zip: '19047',
    });
    expect(recs[1].kind).toBe('repair');
  });
  it('reads GeoJSON points and skips other geometries', () => {
    const geo = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-74.95, 40.13] },
          properties: { name: 'Target', shop: 'department_store' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[[-74.9, 40.1]]] },
          properties: { name: 'Mall', shop: 'mall' },
        },
      ],
    });
    const recs = importRecords(geo);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      name: 'Target',
      kind: 'bigbox',
      chain: 'target',
      lat: 40.13,
      lon: -74.95,
    });
  });
  it('reads All The Places NDJSON (one feature per line)', () => {
    const nd = [
      JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-74.86, 40.18] },
        properties: {
          name: "DICK'S Sporting Goods",
          brand: "Dick's Sporting Goods",
          'addr:street_address': '150 Commerce Blvd',
        },
      }),
      'garbage line',
      JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-74.9, 40.1] },
        properties: { name: 'ShopRite' },
      }),
    ].join('\n');
    const recs = importRecords(nd);
    expect(recs.map((r) => r.kind)).toEqual(['sporting', 'grocery']);
    expect(recs[0].addr).toBe('150 Commerce Blvd');
  });
  it('returns nothing for empty or unparseable input', () => {
    expect(importRecords('')).toEqual([]);
    expect(importRecords('not json')).toEqual([]);
  });
});

describe('kindFromTags', () => {
  it('maps OSM shop tags to store kinds', () => {
    expect(kindFromTags({ shop: 'supermarket' }, 'Giant').kind).toBe('grocery');
    expect(kindFromTags({ amenity: 'pharmacy' }, 'CVS').kind).toBe('pharmacy');
    expect(kindFromTags({ shop: 'hardware' }, 'Ace').kind).toBe('hardware');
    expect(kindFromTags({}, 'Nowhere').kind).toBe('other');
  });
  it('recognises chains by name or brand', () => {
    expect(kindFromTags({ brand: 'Walmart' }, 'Supercenter')).toEqual({ kind: 'bigbox', chain: 'walmart' });
    expect(kindFromTags({}, 'Dollar Tree')).toEqual({ kind: 'variety', chain: '' });
  });
});

describe('finishImport', () => {
  it('keeps shops within 40 miles, drops electronics, de-duplicates and packs round-trip', () => {
    const recs = importRecords(overpass);
    const kept = finishImport(recs, DEFAULT_BASES, []);
    // nearest to a home base first
    expect(kept.map((s) => s.name)).toEqual(['Mike’s Shoe Repair', 'Zumiez']);
    expect(kept.every((s) => s.src === 'import' && s.id.startsWith('imp-'))).toBe(true);
    const again = finishImport(recs, DEFAULT_BASES, kept);
    expect(again).toHaveLength(2);
    expect(unpackImports(packImports(kept))).toEqual(kept);
  });
});
