/* Route planning: pick stores that cover the list, order them as the shortest
   loop out and back home, and re-route when something isn't on the shelf. */
import type {
  AppState,
  Base,
  Candidate,
  DetourOption,
  ItemView,
  LatLon,
  StoreIndex,
  StoreWithCats,
  Trip,
  TripStop,
} from '../types';
import { driveMin, fmtMi, roadMi } from './geo';
import { itemOdds, itemShort } from './stores';

export function tourLen(base: LatLon, stops: LatLon[]): number {
  if (!stops.length) return 0;
  let len = roadMi(base, stops[0]);
  for (let i = 1; i < stops.length; i++) len += roadMi(stops[i - 1], stops[i]);
  return len + roadMi(stops[stops.length - 1], base);
}

/** Shortest out-and-back order: exhaustive for ≤7 stops, nearest-neighbour + 2-opt above. */
export function orderStops<T extends LatLon>(base: LatLon, stops: T[]): T[] {
  const n = stops.length;
  if (n < 2) return stops.slice();
  const pts: LatLon[] = [base, ...stops];
  const D = pts.map((a) => pts.map((b) => roadMi(a, b)));
  if (n <= 7) {
    const idx = stops.map((_, i) => i + 1);
    let best = idx.slice();
    let bestLen = Infinity;
    const c = new Array<number>(n).fill(0);
    const evalP = (p: number[]) => {
      let len = D[0][p[0]];
      for (let i = 1; i < n; i++) len += D[p[i - 1]][p[i]];
      len += D[p[n - 1]][0];
      if (len < bestLen - 1e-9) {
        bestLen = len;
        best = p.slice();
      }
    };
    evalP(idx);
    let i = 0;
    while (i < n) {
      if (c[i] < i) {
        const j = i % 2 === 0 ? 0 : c[i];
        const tmp = idx[j];
        idx[j] = idx[i];
        idx[i] = tmp;
        evalP(idx);
        c[i]++;
        i = 0;
      } else {
        c[i] = 0;
        i++;
      }
    }
    return best.map((k) => stops[k - 1]);
  }
  const left = new Set(stops.map((_, i) => i + 1));
  const tour: number[] = [];
  let cur = 0;
  while (left.size) {
    let bj = -1;
    let bd = Infinity;
    for (const j of left)
      if (D[cur][j] < bd) {
        bd = D[cur][j];
        bj = j;
      }
    tour.push(bj);
    left.delete(bj);
    cur = bj;
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < tour.length - 1; a++) {
      for (let b = a + 1; b < tour.length; b++) {
        const pa = a === 0 ? 0 : tour[a - 1];
        const na = tour[a];
        const pb = tour[b];
        const nb = b === tour.length - 1 ? 0 : tour[b + 1];
        if (D[pa][pb] + D[na][nb] < D[pa][na] + D[pb][nb] - 1e-9) {
          const seg = tour.slice(a, b + 1).reverse();
          tour.splice(a, seg.length, ...seg);
          improved = true;
        }
      }
    }
  }
  return tour.map((k) => stops[k - 1]);
}

/** Stores within range that are at least a maybe for one item, nearest first. */
export function candidates(
  stores: StoreWithCats[],
  items: ItemView[],
  base: LatLon | null,
  radius: number,
  chains?: string[],
): Candidate[] {
  if (!items.length) return [];
  const out: Candidate[] = [];
  for (const s of stores) {
    if (chains && chains.length && !chains.includes(s.chain)) continue;
    const od: Record<string, number> = {};
    let best = 0;
    let sum = 0;
    for (const it of items) {
      const o = itemOdds(s, it);
      if (o > 0) {
        od[it.id] = o;
        best = Math.max(best, o);
        if (o >= 0.45) sum += o;
      }
    }
    if (best < 0.3) continue;
    const dist = base ? roadMi(base, s) : 0;
    if (base && dist > radius) continue;
    out.push({ ...s, od, best, sum, dist });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

export interface Suggestion {
  picks: Candidate[];
  uncovered: string[];
  miles: number;
}

/** Greedy set cover weighted by detour cost: the fewest, closest stops that cover the list. */
export function suggestPicks(cands: Candidate[], items: ItemView[], base: LatLon, max = 4): Suggestion {
  const picks: Candidate[] = [];
  const uncovered = new Set(items.map((i) => i.id));
  for (let k = 0; k < max && uncovered.size; k++) {
    let best: Candidate | null = null;
    let bestScore = 0;
    const baseLen = tourLen(base, orderStops(base, picks));
    for (const s of cands) {
      if (picks.includes(s)) continue;
      let gain = 0;
      for (const id of uncovered) {
        const o = s.od[id] || 0;
        if (o >= 0.5) gain += o;
      }
      if (gain <= 0) continue;
      const cost = tourLen(base, orderStops(base, picks.concat([s]))) - baseLen;
      const score = gain - cost * 0.06;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) break;
    picks.push(best);
    for (const id of Array.from(uncovered)) if ((best.od[id] || 0) >= 0.5) uncovered.delete(id);
  }
  const ordered = orderStops(base, picks);
  return { picks: ordered, uncovered: Array.from(uncovered), miles: tourLen(base, ordered) };
}

/* ---------------- Trip ---------------- */
export interface Leg<T> {
  to: T | null;
  mi: number;
  min: number;
}

export function tripLegs<T extends LatLon>(base: LatLon, stores: T[]): Leg<T>[] {
  const legs: Leg<T>[] = [];
  let prev: LatLon = base;
  for (const s of stores) {
    const mi = roadMi(prev, s);
    legs.push({ to: s, mi, min: driveMin(mi) });
    prev = s;
  }
  if (stores.length) {
    const mi = roadMi(prev, base);
    legs.push({ to: null, mi, min: driveMin(mi) });
  }
  return legs;
}

export interface LookRow {
  it: ItemView;
  o: number;
  r?: 'found' | 'missing';
}

/** What to look for at stop `idx`: items planned here, plus others worth a glance. */
export function lookFor(
  trip: Trip,
  idx: number,
  items: ItemView[],
  sm: StoreIndex,
): { primary: LookRow[]; also: LookRow[] } {
  const stop = trip.stops[idx];
  const s = stop && sm[stop.sid];
  if (!s) return { primary: [], also: [] };
  const resAt = stop.res || {};
  const open = items.filter((i) => trip.items.includes(i.id) && (!i.done || resAt[i.id]));
  const primary: LookRow[] = [];
  const also: LookRow[] = [];
  for (const it of open) {
    const o = itemOdds(s, it);
    if (resAt[it.id]) {
      primary.push({ it, o, r: resAt[it.id] });
      continue;
    }
    if (o < 0.4) continue;
    let planned = -1;
    for (let j = trip.cur; j < trip.stops.length; j++) {
      const sj = sm[trip.stops[j].sid];
      if (!sj || trip.stops[j].state === 'done' || trip.stops[j].state === 'skipped') continue;
      if (trip.stops[j].res && trip.stops[j].res[it.id] === 'missing') continue;
      if (itemOdds(sj, it) >= 0.5) {
        planned = j;
        break;
      }
    }
    (planned === idx || planned === -1 ? primary : also).push({ it, o });
  }
  return { primary, also };
}

/** Indexes and points of the stops still ahead (current first), ending at home. */
export function pendingSeq(trip: Trip, base: LatLon, sm: StoreIndex): { idx: number[]; pts: LatLon[] } {
  const idx = [trip.cur];
  for (let j = trip.cur + 1; j < trip.stops.length; j++) if (trip.stops[j].state === 'pending') idx.push(j);
  const pts: LatLon[] = idx.map((j) => sm[trip.stops[j].sid] as LatLon).concat([base]);
  return { idx, pts };
}

export function bestInsertion(pts: LatLon[], cand: LatLon): { pos: number; add: number } {
  let best = { pos: -1, add: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const add = roadMi(pts[i], cand) + roadMi(cand, pts[i + 1]) - roadMi(pts[i], pts[i + 1]);
    if (add < best.add) best = { pos: i + 1, add };
  }
  return best;
}

type Draft = Pick<AppState, 'bases' | 'radius'> & { trip: Trip };

/** Called when an item isn't at the current stop. Mutates the draft trip:
    points at a later planned stop, inserts a close store on the way, or lists detours. */
export function rerouteFor(d: Draft, it: ItemView, sm: StoreIndex, allList: StoreWithCats[]): void {
  const trip = d.trip;
  const base: Base = d.bases.find((b) => b.id === trip.baseId) || d.bases[0];
  const label = itemShort(it);
  for (let j = trip.cur + 1; j < trip.stops.length; j++) {
    const sj = sm[trip.stops[j].sid];
    if (sj && trip.stops[j].state === 'pending' && itemOdds(sj, it) >= 0.45) {
      trip.notice = {
        kind: 'later',
        itemId: it.id,
        sid: sj.id,
        msg: `Next chance for ${label}: ${sj.name}, stop ${j + 1}.`,
      };
      return;
    }
  }
  const inTrip = new Set(trip.stops.map((x) => x.sid));
  const { idx, pts } = pendingSeq(trip, base, sm);
  let remaining = 0;
  for (let i = 0; i < pts.length - 1; i++) remaining += roadMi(pts[i], pts[i + 1]);
  const opts: DetourOption[] = allList
    .filter(
      (s) => !inTrip.has(s.id) && itemOdds(s, it) >= 0.45 && roadMi(base, s) <= Math.max(d.radius, 10) + 8,
    )
    .map((s) => {
      const ins = bestInsertion(pts, s);
      return { sid: s.id, add: ins.add, pos: ins.pos, o: itemOdds(s, it) };
    })
    .sort((a, b) => a.add - b.add || b.o - a.o)
    .slice(0, 4);
  if (!opts.length) {
    trip.notice = { kind: 'none', itemId: it.id, msg: `No other store in range is likely to have ${label}.` };
    return;
  }
  const thr = Math.max(2.5, remaining * 0.2);
  const best = opts[0];
  if (best.add <= thr) {
    const at = best.pos < idx.length ? idx[best.pos] : trip.stops.length;
    const stop: TripStop = { sid: best.sid, state: 'pending', res: {}, added: true, forItem: it.id };
    trip.stops.splice(at, 0, stop);
    const s = sm[best.sid];
    const next = at === trip.cur + 1;
    const after =
      at < trip.stops.length - 1 ? sm[trip.stops[at + 1].sid]?.name || 'the next stop' : 'heading home';
    trip.notice = {
      kind: 'inserted',
      itemId: it.id,
      sid: best.sid,
      at,
      next,
      msg:
        `${s.name} is on the way (+${fmtMi(Math.max(best.add, 0))} mi, ~${driveMin(Math.max(best.add, 0.1))} min). ` +
        (next ? 'It’s your next stop.' : `Added before ${after}.`),
    };
  } else {
    trip.notice = {
      kind: 'options',
      itemId: it.id,
      options: opts,
      msg: `Nothing for ${label} right on your path. Closest detours:`,
    };
  }
}

/** Which planned stop each open item is expected at (first stop with good odds). */
export function planAssign(trip: Trip, items: ItemView[], sm: StoreIndex): ItemView[][] {
  const out: ItemView[][] = trip.stops.map(() => []);
  for (const id of trip.items) {
    const it = items.find((i) => i.id === id);
    if (!it || it.done) continue;
    let bi = -1;
    let bo = 0;
    for (let j = 0; j < trip.stops.length; j++) {
      const s = sm[trip.stops[j].sid];
      if (!s) continue;
      const o = itemOdds(s, it);
      if (o >= 0.5) {
        bi = j;
        break;
      }
      if (o > bo) {
        bo = o;
        bi = j;
      }
    }
    if (bi >= 0) out[bi].push(it);
  }
  return out;
}
