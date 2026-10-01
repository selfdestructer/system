import type { Base, ItemView, LatLon, Store } from '../types';
import { getCalculator } from '../calc/registry';

const enc = encodeURIComponent;

type Place = Pick<Store, 'name' | 'addr' | 'city' | 'st' | 'zip'> & LatLon;

export const storeShort = (s: { name?: string }): string =>
  (s.name || '').split(' · ')[0].replace(/\s*\(.*\)$/, '');
export const fullAddr = (s: Pick<Store, 'addr' | 'city' | 'st' | 'zip'>): string =>
  [s.addr, s.city, [s.st, s.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
export const dest = (s: Place): string => (s.addr ? `${storeShort(s)}, ${fullAddr(s)}` : `${s.lat},${s.lon}`);
export const mapsSearch = (s: Place): string =>
  `https://www.google.com/maps/search/?api=1&query=${enc(dest(s))}`;
export const navTo = (s: Place): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${enc(dest(s))}&travelmode=driving`;
export const navHome = (b: Base): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lon}&travelmode=driving`;

/** Google Maps accepts at most this many waypoints between origin and destination. */
export const MAX_WAYPOINTS = 9;

/** A Maps directions link for the loop. Only the first MAX_WAYPOINTS stops fit; callers say so. */
export function fullRouteLink(base: Base, stops: Place[]): string {
  const wp = stops.slice(0, MAX_WAYPOINTS).map(dest).join('|');
  return (
    `https://www.google.com/maps/dir/?api=1&origin=${base.lat},${base.lon}&destination=${base.lat},${base.lon}` +
    (wp ? `&waypoints=${enc(wp)}` : '') +
    '&travelmode=driving'
  );
}

/** What to type into a store search for this item. */
export function itemQuery(it: ItemView): string {
  const pc = getCalculator(it.cat);
  if (pc && it.lace && it.calc) {
    const q = pc.search(it.lace, it.calc);
    if (q) return q;
  }
  return it.text;
}

export function stockLink(s: Pick<Store, 'chain' | 'name' | 'city'>, it?: ItemView): string {
  const q = it ? itemQuery(it) : 'shoelaces';
  switch (s.chain) {
    case 'target':
      return `https://www.target.com/s?searchTerm=${enc(q)}`;
    case 'walmart':
      return `https://www.walmart.com/search?q=${enc(q)}`;
    case 'dicks':
      return `https://www.dickssportinggoods.com/search/SearchDisplay?searchTerm=${enc(q)}`;
    case 'homedepot':
      return `https://www.homedepot.com/s/${enc(q)}`;
    case 'lowes':
      return `https://www.lowes.com/search?searchTerm=${enc(q)}`;
    case 'footlocker':
      return `https://www.footlocker.com/search?query=${enc(q)}`;
    case 'zumiez':
      return `https://www.zumiez.com/catalogsearch/result/?q=${enc(q)}`;
    case 'petsmart':
      return `https://www.petsmart.com/search/?q=${enc(q)}`;
    default:
      return `https://www.google.com/search?q=${enc(storeShort(s) + ' ' + (s.city || '') + ' ' + q)}`;
  }
}

export const amazonLink = (it: ItemView): string => `https://www.amazon.com/s?k=${enc(itemQuery(it))}`;

export interface OnlineLink {
  label: string;
  href: string;
}

/** Online places to buy an item, for when a trip isn't worth it. */
export function onlineLinks(it: ItemView): OnlineLink[] {
  const q = itemQuery(it);
  const out: OnlineLink[] = [
    { label: 'Amazon', href: amazonLink(it) },
    { label: 'Target', href: stockLink({ chain: 'target', name: 'Target', city: '' }, it) },
    { label: 'Walmart', href: stockLink({ chain: 'walmart', name: 'Walmart', city: '' }, it) },
  ];
  if (it.cat === 'laces') {
    out.push({ label: 'Zumiez', href: stockLink({ chain: 'zumiez', name: 'Zumiez', city: '' }, it) });
    out.push({ label: "DICK'S", href: stockLink({ chain: 'dicks', name: "DICK'S", city: '' }, it) });
    out.push({ label: 'Lace Lab', href: `https://www.lacelab.com/search?q=${enc(q)}` });
  }
  if (it.cat === 'hardware') {
    out.push({
      label: 'Home Depot',
      href: stockLink({ chain: 'homedepot', name: 'Home Depot', city: '' }, it),
    });
    out.push({ label: "Lowe's", href: stockLink({ chain: 'lowes', name: "Lowe's", city: '' }, it) });
  }
  if (it.cat === 'pets')
    out.push({ label: 'PetSmart', href: stockLink({ chain: 'petsmart', name: 'PetSmart', city: '' }, it) });
  out.push({ label: 'Google Shopping', href: `https://www.google.com/search?tbm=shop&q=${enc(q)}` });
  return out;
}
