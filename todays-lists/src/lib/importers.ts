/* Import stores from open data: OpenStreetMap Overpass JSON, GeoJSON, or
   All The Places NDJSON. Nothing here touches the network; the user fetches
   the file (see ImportPanel for the curl command) and drops it in. */
import type { LatLon, Store, StoreKind } from '../types';
import { hav } from './geo';

const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);

type Tags = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? '' : String(v));

export function kindFromTags(tags: Tags, name: string): { kind: StoreKind; chain?: string } {
  const nb = ((name || '') + ' ' + str(tags.brand) + ' ' + str(tags.operator)).toLowerCase();
  const brandHit: [RegExp, StoreKind, string][] = [
    [/\btarget\b/, 'bigbox', 'target'],
    [/walmart/, 'bigbox', 'walmart'],
    [/dick'?s sporting|dicks sporting/, 'sporting', 'dicks'],
    [/zumiez/, 'skate', 'zumiez'],
    [/journeys/, 'shoe', 'journeys'],
    [/famous footwear/, 'shoe', 'famous'],
    [/foot ?locker/, 'shoe', 'footlocker'],
    [/off broadway/, 'shoe', 'offbroadway'],
    [/home depot/, 'hardware', 'homedepot'],
    [/\blowe'?s\b/, 'hardware', 'lowes'],
    [/shop ?rite/, 'grocery', 'shoprite'],
    [/\baldi\b/, 'grocery', 'aldi'],
    [/petsmart/, 'pet', 'petsmart'],
    [/\bdsw\b|shoe carnival|finish line|jd sports|champs|skechers/, 'shoe', ''],
    [/tillys|skate ?shop|skateshop|skateboard/, 'skate', ''],
    [/dollar tree|five below|dollar general|family dollar/, 'variety', ''],
  ];
  for (const [re, kind, chain] of brandHit) if (re.test(nb)) return { kind, chain };
  const shop = tags.shop;
  const amen = tags.amenity;
  const craft = tags.craft;
  if (shop === 'shoe_repair' || craft === 'shoemaker') return { kind: 'repair' };
  if (shop === 'shoes') return { kind: 'shoe' };
  if (shop === 'sports' || shop === 'outdoor') return { kind: 'sporting' };
  if (shop === 'department_store') return { kind: 'dept' };
  if (shop === 'variety_store' || shop === 'general') return { kind: 'variety' };
  if (shop === 'supermarket' || shop === 'greengrocer' || shop === 'wholesale') return { kind: 'grocery' };
  if (shop === 'convenience') return { kind: 'convenience' };
  if (shop === 'hardware' || shop === 'doityourself' || shop === 'trade') return { kind: 'hardware' };
  if (shop === 'car_parts' || shop === 'tyres') return { kind: 'auto' };
  if (shop === 'pet') return { kind: 'pet' };
  if (amen === 'pharmacy' || shop === 'chemist') return { kind: 'pharmacy' };
  if (shop === 'electronics') return { kind: 'electronics' };
  return { kind: 'other' };
}

export type ImportRecord = Omit<Store, 'id' | 'src'>;

interface RawRecord {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Tags;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Tags;
  [k: string]: unknown;
}

export function importRecords(text: string): ImportRecord[] {
  const t = String(text || '').trim();
  if (!t) return [];
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    const lines = t.split(/\r?\n/).filter((l) => l.trim().startsWith('{'));
    const arr: unknown[] = [];
    for (const l of lines) {
      try {
        arr.push(JSON.parse(l));
      } catch {
        /* skip bad line */
      }
    }
    data = arr;
  }
  let recs: RawRecord[] = [];
  const d = data as { elements?: unknown; features?: unknown } | unknown[] | null;
  if (d && !Array.isArray(d) && Array.isArray(d.elements)) recs = d.elements as RawRecord[];
  else if (d && !Array.isArray(d) && Array.isArray(d.features)) recs = d.features as RawRecord[];
  else if (Array.isArray(d)) recs = d as RawRecord[];
  else if (d && !Array.isArray(d) && (d as RawRecord).type === 'Feature') recs = [d as RawRecord];
  const out: ImportRecord[] = [];
  for (const r of recs) {
    if (!r || typeof r !== 'object') continue;
    let lat = NaN;
    let lon = NaN;
    let tags: Tags;
    if (r.type === 'Feature' || r.geometry) {
      const g = r.geometry || {};
      let c = g.coordinates as unknown[] | null | undefined;
      if (g.type && g.type !== 'Point') c = null;
      if (c && c.length >= 2) {
        lon = +String(c[0]);
        lat = +String(c[1]);
      }
      tags = r.properties || {};
    } else {
      lat = r.lat != null ? +String(r.lat) : r.center ? +String(r.center.lat) : NaN;
      lon = r.lon != null ? +String(r.lon) : r.center ? +String(r.center.lon) : NaN;
      tags = r.tags || (r as Tags);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const name = str(tags.name || tags.brand);
    if (!name) continue;
    const street =
      str(tags['addr:street_address']) ||
      [str(tags['addr:housenumber']), str(tags['addr:street'])].filter(Boolean).join(' ');
    const k = kindFromTags(tags, name);
    out.push({
      name: name.slice(0, 60),
      kind: k.kind,
      chain: k.chain || '',
      addr: street.slice(0, 60),
      city: str(tags['addr:city']).slice(0, 30),
      st: str(tags['addr:state']).slice(0, 3),
      zip: str(tags['addr:postcode']).slice(0, 10),
      phone: str(tags.phone || tags['contact:phone']).slice(0, 20),
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
    });
  }
  return out;
}

const nameKey = (s: { name: string; lat: number; lon: number }) =>
  s.name.toLowerCase() + '|' + s.lat.toFixed(3) + '|' + s.lon.toFixed(3);

/** Same chain within about a third of a mile of a store we already know: the seed list names
    stores by mall ("Zumiez · Oxford Valley Mall") while OSM says "Zumiez", so names alone miss. */
const sameChainNearby = (r: ImportRecord, known: Store[]): boolean =>
  !!r.chain && known.some((s) => s.chain === r.chain && hav(s, r) < 0.35);

/** Keep records near the bases, drop duplicates of prior imports and of any store the app
    already knows (`universe`: seed + custom + Claude), cap the list. Returns imports only. */
export function finishImport(
  recs: ImportRecord[],
  bases: LatLon[],
  existing: Store[] = [],
  universe: Store[] = [],
): Store[] {
  const keep: (Store & { near: number })[] = [];
  const seen = new Set(existing.concat(universe).map(nameKey));
  const known = universe.filter((s) => s.chain);
  for (const r of recs) {
    if (r.kind === 'other' || r.kind === 'electronics') continue;
    const near = bases.length ? Math.min(...bases.map((b) => hav(b, r))) : 0;
    if (near > 40) continue;
    const key = nameKey(r);
    if (seen.has(key) || sameChainNearby(r, known)) continue;
    seen.add(key);
    keep.push({ id: 'imp-' + uid(), src: 'import', near, ...r });
  }
  keep.sort((a, b) => a.near - b.near);
  const merged: Store[] = existing.concat(keep.map(({ near: _near, ...s }) => s));
  return merged.slice(0, 1500);
}

export type PackedStore = [
  string,
  string,
  string,
  StoreKind,
  string,
  string,
  string,
  string,
  string,
  number,
  number,
];
export const packImports = (list: Store[]): PackedStore[] =>
  list.map((s) => [
    s.id,
    s.chain || '',
    s.name,
    s.kind,
    s.addr || '',
    s.city || '',
    s.st || '',
    s.zip || '',
    s.phone || '',
    s.lat,
    s.lon,
  ]);
export const unpackImports = (rows: PackedStore[] | null | undefined): Store[] =>
  (rows || []).map((r) => ({
    id: r[0],
    chain: r[1],
    name: r[2],
    kind: r[3],
    addr: r[4],
    city: r[5],
    st: r[6],
    zip: r[7],
    phone: r[8],
    lat: r[9],
    lon: r[10],
    src: 'import',
  }));
