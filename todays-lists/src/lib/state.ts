import type { AppState, Item } from '../types';
import { CATS0, CHAINS, DEFAULT_BASES, SEED_LACES } from '../data/catalog';
import { parseLace } from '../calc/laces';

export const uid = (): string => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);

export function seedState(): AppState {
  const now = Date.now();
  const items: Item[] = SEED_LACES.map((text, i) => ({
    id: 'seed-' + (i + 1),
    cat: 'laces',
    text,
    done: false,
    qty: 1,
    lace: parseLace(text),
    at: now - (10 - i) * 1000,
  }));
  return {
    v: 2,
    updatedAt: 0,
    items,
    cats: CATS0.slice(),
    bulk: false,
    shopCats: ['laces'],
    chains: [],
    bases: DEFAULT_BASES.map((b) => ({ ...b })),
    baseId: DEFAULT_BASES[0].id,
    radius: 10,
    picks: [],
    custom: [],
    aiStores: [],
    fixes: {},
    trip: null,
    view: 'lists',
    lastBatch: null,
  };
}

/** Make any saved blob safe to use: fill gaps with defaults, add new categories. */
const withIds = <T extends { id: string }>(v: unknown): T[] =>
  Array.isArray(v)
    ? v.filter((x): x is T => !!x && typeof x === 'object' && typeof (x as T).id === 'string')
    : [];

const strings = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fallback;

export function normalizeState(s: unknown): AppState {
  const d = seedState();
  if (!s || typeof s !== 'object' || (s as { v?: unknown }).v !== 2) return d;
  const out: AppState = { ...d, ...(s as Partial<AppState>) };
  // Saved collections can be anything (hand-edited cookie, older build): keep only rows with an id.
  out.cats = withIds(out.cats);
  const have = new Set(out.cats.map((c) => c.id));
  out.cats = out.cats.concat(CATS0.filter((c) => !have.has(c.id)));
  out.bases = withIds(out.bases);
  if (!out.bases.length) out.bases = d.bases;
  if (!out.bases.some((b) => b.id === out.baseId)) out.baseId = out.bases[0].id;
  out.items = withIds(out.items);
  // String lists: drop anything that is not a string, and chain filters the app no longer knows.
  out.shopCats = strings(out.shopCats, d.shopCats);
  out.chains = strings(out.chains, d.chains).filter((k) => k in CHAINS);
  out.picks = strings(out.picks, d.picks);
  if (!Array.isArray(out.custom)) out.custom = d.custom;
  if (!Array.isArray(out.aiStores)) out.aiStores = d.aiStores;
  if (!out.fixes || typeof out.fixes !== 'object') out.fixes = {};
  return out;
}
