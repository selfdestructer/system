/* Shared domain types for Today's Lists. */

export type Tone = 'sun' | 'mint' | 'sky';

export interface Category {
  id: string;
  name: string;
  short: string;
  tone: Tone;
  /** Can this category be shopped for (vs. a plain to-do)? */
  shop: boolean;
}

/** Rough odds (0–1) that a store carries a category of goods, keyed by category id. */
export type CatOdds = Record<string, number>;

export interface Chain {
  label: string;
  cats: CatOdds;
}

export type StoreKind =
  | 'bigbox'
  | 'sporting'
  | 'skate'
  | 'shoe'
  | 'repair'
  | 'variety'
  | 'dept'
  | 'grocery'
  | 'hardware'
  | 'auto'
  | 'pet'
  | 'pharmacy'
  | 'convenience'
  | 'electronics'
  | 'other'
  | 'custom';

export type StoreSource = 'seed' | 'custom' | 'ai' | 'import';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Store extends LatLon {
  id: string;
  chain: string;
  name: string;
  kind: StoreKind;
  addr: string;
  city: string;
  st: string;
  zip: string;
  phone: string;
  src: StoreSource;
  /** Coordinates are a real pin, not a shopping-center guess. */
  exact?: boolean;
  /** Small-format store (less stock). */
  small?: boolean;
  /** Per-category odds for stores that don't belong to a known chain. */
  cats?: CatOdds;
  /** Per-item odds, used for Claude-suggested stores. */
  itemOdds?: Record<string, number>;
  why?: string;
}

/** A store after `withCats` has filled in its category odds. */
export interface StoreWithCats extends Store {
  cats: CatOdds;
}

/** A store scored against the items being hunted. */
export interface Candidate extends StoreWithCats {
  /** Odds per item id. */
  od: Record<string, number>;
  best: number;
  sum: number;
  /** Road miles from the home base. */
  dist: number;
  /** Picked for the route (map dot styling). */
  pk?: boolean;
  /** Stop was added mid-trip. */
  added?: boolean;
}

export interface Town extends LatLon {
  label: string;
}

export interface Base extends LatLon {
  id: string;
  label: string;
  /** True while the base is a town center rather than the user's real spot. */
  approx: boolean;
}

/* ---------------- Laces ---------------- */

export type LaceType = 'flat' | 'slim' | 'oval' | 'round' | 'fat' | 'waxed';
export type LacingStyle = 'criss' | 'bar' | 'hidden' | 'heel' | 'skip';
export type BowKey = 'short' | 'std' | 'big';
export type SizeSystem = 'M' | 'W';

export interface LaceSpec {
  raw?: string;
  eyelets?: number;
  size?: number;
  sizeSys?: SizeSystem;
  brand?: string;
  modelKey?: string;
  modelText?: string;
  color?: string;
  laceType?: LaceType;
  typeAlt?: LaceType;
  style?: LacingStyle;
  bow?: BowKey;
  notes?: string;
  /** Eyelet pairs Claude guessed for an unknown shoe. */
  aiPairs?: number;
  /** Stock lace length Claude guessed for an unknown shoe. */
  aiStock?: number;
}

export interface ShoeModel {
  key: string;
  brand: string;
  name: string;
  re: RegExp;
  profile: 'low' | 'mid' | 'high';
  /** Typical eyelet pairs for a men's size (null when unknown). */
  pairs: (sizeM: number | null) => number;
  /** Stock lace length in inches by eyelet pairs. */
  stock: Record<number, number>;
  width: string;
  type: LaceType;
  src: string;
  tip?: string;
  needVans?: boolean;
  needNike?: boolean;
  noLaces?: boolean;
}

export interface LaceAlt {
  label: string;
  inches: number;
}

export type LaceConfidence = 'spec' | 'model' | 'est' | 'chart';

export interface LaceSized {
  noLaces?: undefined;
  need?: undefined;
  inches: number;
  cm: number;
  target: number;
  pairs: number;
  lo: number;
  hi: number;
  /** A more common shelf length when `inches` is an odd size. */
  shelf: number | null;
  alts: LaceAlt[];
  typeLabel: string;
  altType: string | null;
  type: LaceType;
  conf: LaceConfidence;
  why: string[];
  src: string[];
  tip: string | null;
  needs: string[];
  search: string;
}

export interface LaceNoLaces {
  noLaces: true;
  need?: undefined;
  inches?: undefined;
  why: string[];
}

export interface LaceNeed {
  noLaces?: undefined;
  need: string[];
  inches?: undefined;
}

export type LaceCalc = LaceSized | LaceNoLaces | LaceNeed;

/* ---------------- Items & lists ---------------- */

export interface Item {
  id: string;
  cat: string;
  text: string;
  done: boolean;
  qty: number;
  at: number;
  /** Parsed spec for a lace item (the field name is kept for saved-state compatibility). */
  lace?: LaceSpec;
  /** Waiting for a bulk calculation. */
  queued?: boolean;
  foundAt?: string;
  missedAt?: string[];
}

/** An item with its calculator result attached (derived, never saved). */
export interface ItemView extends Item {
  calc?: LaceCalc;
}

/* ---------------- Trips ---------------- */

export type StopState = 'pending' | 'here' | 'done' | 'skipped';
export type FindResult = 'found' | 'missing';

export interface TripStop {
  sid: string;
  state: StopState;
  res: Record<string, FindResult>;
  added?: boolean;
  forItem?: string;
}

export interface DetourOption {
  sid: string;
  add: number;
  pos: number;
  o: number;
}

export type Notice =
  | { kind: 'later'; itemId: string; sid: string; msg: string }
  | { kind: 'none'; itemId: string; msg: string }
  | { kind: 'inserted'; itemId?: string; sid: string; at: number; next: boolean; msg: string }
  | { kind: 'options'; itemId: string; options: DetourOption[]; msg: string }
  | { kind: 'skipped'; msg: string };

export interface Trip {
  id: string;
  status: 'planned' | 'active' | 'done';
  baseId: string;
  items: string[];
  stops: TripStop[];
  cur: number;
  notice: Notice | null;
  created: number;
  started?: number;
  ended?: number;
}

export type View = 'lists' | 'stores' | 'trip';

export interface AppState {
  v: 2;
  updatedAt: number;
  items: Item[];
  cats: Category[];
  bulk: boolean;
  shopCats: string[];
  chains: string[];
  bases: Base[];
  baseId: string;
  radius: number;
  picks: string[];
  custom: Store[];
  aiStores: Store[];
  fixes: Record<string, LatLon>;
  trip: Trip | null;
  view: View;
  lastBatch: string[] | null;
}

export type StoreIndex = Record<string, StoreWithCats>;
