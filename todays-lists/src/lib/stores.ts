import type {
  AppState,
  CatOdds,
  ItemView,
  LatLon,
  Store,
  StoreIndex,
  StoreKind,
  StoreWithCats,
} from '../types';
import { CHAINS, STORES0 } from '../data/catalog';
import { SHELF } from '../calc/laces/data';
import { shoeTitle } from '../calc/laces';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/* ---------------- Store odds ---------------- */
export const KIND_CATS: Record<StoreKind, CatOdds> = {
  bigbox: {
    laces: 0.7,
    groceries: 0.75,
    household: 0.9,
    pharmacy: 0.7,
    pets: 0.7,
    hardware: 0.45,
    auto: 0.45,
  },
  sporting: { laces: 0.7 },
  skate: { laces: 0.6 },
  shoe: { laces: 0.5 },
  repair: { laces: 0.8 },
  variety: { laces: 0.45, household: 0.7, groceries: 0.3, pets: 0.3 },
  dept: { laces: 0.35, household: 0.5 },
  grocery: { groceries: 0.9, household: 0.55, pharmacy: 0.3, pets: 0.45 },
  hardware: { hardware: 0.9, household: 0.5, auto: 0.25 },
  auto: { auto: 0.9 },
  pet: { pets: 0.95 },
  pharmacy: { pharmacy: 0.9, household: 0.5, groceries: 0.2 },
  convenience: { groceries: 0.45, household: 0.3, pharmacy: 0.2 },
  electronics: {},
  other: {},
  custom: {},
};
const LACE_BASE: Partial<Record<StoreKind, number>> = {
  bigbox: 0.72,
  sporting: 0.7,
  skate: 0.72,
  shoe: 0.5,
  repair: 0.8,
  variety: 0.45,
  dept: 0.35,
};
const BASIC_COLOR = /black|white|gr[ae]y|brown|navy/;

export function laceOdds(s: StoreWithCats, it: ItemView): number {
  const c = it.calc;
  if (!c || !c.inches) return 0;
  const spec = it.lace || {};
  const base = LACE_BASE[s.kind];
  if (base == null) return (s.cats && s.cats.laces) || 0;
  let o = base;
  if (s.chain === 'footlocker' || s.chain === 'offbroadway') o -= 0.1;
  if (s.small) o -= 0.15;
  const col = (spec.color || '').toLowerCase();
  const special = !!col && !BASIC_COLOR.test(col);
  if (special) o -= s.kind === 'skate' ? 0.1 : s.kind === 'shoe' || s.kind === 'repair' ? 0.15 : 0.35;
  if (!SHELF.includes(c.inches)) o -= s.kind === 'skate' || s.kind === 'repair' ? 0.08 : 0.15;
  const athletic =
    spec.modelKey === 'nike-metcon' || /slim|oval/.test((spec.laceType || '') + (spec.typeAlt || ''));
  if (athletic) o += s.kind === 'sporting' ? 0.12 : s.kind === 'skate' ? -0.3 : 0;
  if (/vans/i.test(spec.brand || '') && s.kind === 'skate') o += 0.12;
  if (c.type === 'fat' && s.kind !== 'skate' && s.kind !== 'shoe') o -= 0.25;
  return clamp(o, 0.05, 0.95);
}

export function itemOdds(s: StoreWithCats, it: ItemView): number {
  if (s.itemOdds && s.itemOdds[it.id] != null) return s.itemOdds[it.id];
  if (it.cat === 'laces' && it.lace) return laceOdds(s, it);
  return (s.cats && s.cats[it.cat]) || 0;
}

/** Open, not queued for bulk calc, and sized when its category has a calculator. */
export const shoppable = (i: ItemView): boolean =>
  !i.done && !i.queued && (i.cat !== 'laces' || !!(i.calc && i.calc.inches));

export type OddTier = 'good' | 'maybe' | 'long';
export const oddTier = (o: number): OddTier => (o >= 0.65 ? 'good' : o >= 0.45 ? 'maybe' : 'long');
export const oddLabel = (o: number): string => (o >= 0.65 ? 'Good odds' : o >= 0.45 ? 'Maybe' : 'Long shot');

export function itemShort(it: ItemView): string {
  if (it.cat === 'laces' && it.lace) {
    const t = shoeTitle(it.lace)
      .replace(/^Nike SB /, '')
      .replace(/ \(.*\)$/, '');
    return it.calc && it.calc.inches ? `${t} ${it.calc.inches}″` : t;
  }
  return it.text.length > 26 ? it.text.slice(0, 25) + '…' : it.text;
}

/* ---------------- Store universe ---------------- */
export function withCats(s: Store): StoreWithCats {
  const cats = (s.chain && CHAINS[s.chain] && CHAINS[s.chain].cats) || s.cats || KIND_CATS[s.kind] || {};
  return { ...s, cats };
}

type StoreState = Pick<AppState, 'custom' | 'aiStores'> & { fixes?: Record<string, LatLon> };

export function allStores(st: StoreState, imports?: Store[]): StoreWithCats[] {
  const fixes = st.fixes || {};
  const list: Store[] = ([] as Store[]).concat(STORES0, st.custom || [], st.aiStores || [], imports || []);
  const seen = new Set<string>();
  const out: StoreWithCats[] = [];
  for (const raw of list) {
    if (!raw || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const f = fixes[raw.id];
    out.push(withCats(f ? { ...raw, lat: f.lat, lon: f.lon, exact: true } : raw));
  }
  return out;
}

export function storeIndex(st: StoreState, imports?: Store[]): StoreIndex {
  const m: StoreIndex = {};
  for (const s of allStores(st, imports)) m[s.id] = s;
  return m;
}
