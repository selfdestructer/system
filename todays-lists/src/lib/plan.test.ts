import { describe, expect, it } from 'vitest';
import type { ItemView, LatLon, Trip } from '../types';
import { DEFAULT_BASES, SEED_LACES } from '../data/catalog';
import { calcLace, parseLace } from '../calc/laces';
import { roadMi } from './geo';
import { allStores, storeIndex } from './stores';
import { bestInsertion, candidates, orderStops, rerouteFor, suggestPicks, tourLen, tripLegs } from './plan';

const lowerBucks = DEFAULT_BASES[0];
const seedItems: ItemView[] = SEED_LACES.map((text, i) => {
  const lace = parseLace(text);
  return {
    id: 'seed-' + (i + 1),
    cat: 'laces',
    text,
    done: false,
    qty: 1,
    at: i,
    lace,
    calc: calcLace(lace),
  };
});
const empty = { custom: [], aiStores: [], fixes: {} };

/** Brute-force shortest loop, for checking orderStops on small sets. */
function bruteForce<T extends LatLon>(base: LatLon, stops: T[]): number {
  let best = Infinity;
  const perm = (arr: T[], rest: T[]) => {
    if (!rest.length) {
      best = Math.min(best, tourLen(base, arr));
      return;
    }
    rest.forEach((s, i) =>
      perm(
        arr.concat([s]),
        rest.filter((_, j) => j !== i),
      ),
    );
  };
  perm([], stops);
  return best;
}

describe('orderStops', () => {
  const stores = allStores(empty).slice(0, 12);
  it('returns the same stops, each once', () => {
    const out = orderStops(lowerBucks, stores.slice(0, 5));
    expect(out.map((s) => s.id).sort()).toEqual(
      stores
        .slice(0, 5)
        .map((s) => s.id)
        .sort(),
    );
  });
  it('finds the true shortest loop for small sets', () => {
    for (const n of [3, 5, 7]) {
      const set = stores.slice(0, n);
      expect(tourLen(lowerBucks, orderStops(lowerBucks, set))).toBeCloseTo(bruteForce(lowerBucks, set), 6);
    }
  });
  it('is never worse than nearest-neighbour order on bigger sets', () => {
    const set = stores.slice(0, 12);
    const nn = [...set].sort((a, b) => roadMi(lowerBucks, a) - roadMi(lowerBucks, b));
    expect(tourLen(lowerBucks, orderStops(lowerBucks, set))).toBeLessThanOrEqual(
      tourLen(lowerBucks, nn) + 1e-9,
    );
  });
});

describe('candidates + suggestPicks', () => {
  it('covers all four pairs from Lower Bucks with a short loop', () => {
    const cands = candidates(allStores(empty), seedItems, lowerBucks, 10);
    expect(cands.length).toBeGreaterThan(3);
    expect(cands[0].dist).toBeLessThanOrEqual(cands[cands.length - 1].dist);
    const s = suggestPicks(cands, seedItems, lowerBucks);
    expect(s.uncovered).toEqual([]);
    expect(s.picks.length).toBeLessThanOrEqual(3);
    expect(s.miles).toBeLessThan(15);
    const names = s.picks.map((p) => p.name).join(' ');
    expect(names).toMatch(/Zumiez|DICK'S|Target|Walmart/);
  });
  it('respects a chain filter', () => {
    const cands = candidates(allStores(empty), seedItems, lowerBucks, 25, ['zumiez']);
    expect(cands.every((c) => c.chain === 'zumiez')).toBe(true);
  });
});

describe('tripLegs', () => {
  it('ends with a leg home', () => {
    const stores = allStores(empty).slice(0, 2);
    const legs = tripLegs(lowerBucks, stores);
    expect(legs).toHaveLength(3);
    expect(legs[2].to).toBeNull();
    expect(legs.every((l) => l.min >= 1)).toBe(true);
  });
});

describe('rerouteFor', () => {
  const sm = storeIndex(empty);
  const all = allStores(empty);
  const item = seedItems[0]; // maroon 36″ flat: any skate shop, big box or sporting goods is a maybe
  const makeTrip = (sids: string[]): Trip => ({
    id: 't',
    status: 'active',
    baseId: lowerBucks.id,
    items: seedItems.map((i) => i.id),
    stops: sids.map((sid) => ({ sid, state: 'pending', res: {} })),
    cur: 0,
    notice: null,
    created: 0,
  });
  it('points at a later planned stop that is likely to have it', () => {
    const d = { bases: DEFAULT_BASES, radius: 10, trip: makeTrip(['jny-oxford', 'zum-oxford']) };
    rerouteFor(d, item, sm, all);
    expect(d.trip.notice?.kind).toBe('later');
    expect(d.trip.stops).toHaveLength(2);
  });
  it('inserts a nearby store on the way when nothing later covers it', () => {
    const d = { bases: DEFAULT_BASES, radius: 10, trip: makeTrip(['jny-oxford']) };
    rerouteFor(d, item, sm, all);
    expect(d.trip.notice?.kind).toBe('inserted');
    expect(d.trip.stops).toHaveLength(2);
    expect(d.trip.stops[1].added).toBe(true);
    expect(d.trip.stops[1].forItem).toBe(item.id);
  });
  it('offers detours instead when every option is a real detour', () => {
    const far = all.filter((s) => s.id === 'zum-willowgrove'); // in range, but well off the Oxford Valley → home path
    const d = { bases: DEFAULT_BASES, radius: 5, trip: makeTrip(['jny-oxford']) };
    rerouteFor(d, item, sm, far);
    expect(d.trip.notice?.kind).toBe('options');
    expect(d.trip.stops).toHaveLength(1);
  });
  it('says so when nothing in range could have it', () => {
    const d = { bases: DEFAULT_BASES, radius: 5, trip: makeTrip(['jny-oxford']) };
    rerouteFor(d, item, sm, []);
    expect(d.trip.notice?.kind).toBe('none');
  });
});

describe('bestInsertion', () => {
  it('picks the cheapest gap', () => {
    const pts: LatLon[] = [
      { lat: 40.0, lon: -75.0 },
      { lat: 40.1, lon: -75.0 },
      { lat: 40.2, lon: -75.0 },
    ];
    const r = bestInsertion(pts, { lat: 40.15, lon: -75.0 });
    expect(r.pos).toBe(2);
    expect(r.add).toBeCloseTo(0, 6);
  });
});
