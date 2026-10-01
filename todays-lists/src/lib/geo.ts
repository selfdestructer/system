import type { LatLon, Town } from '../types';
import { TOWNS } from '../data/catalog';

export const ROAD = 1.3; // straight-line → road miles (suburban grid)
export const MPH = 27; // average door-to-door driving speed

/** Great-circle distance in miles. */
export function hav(a: LatLon, b: LatLon): number {
  const R = 3958.8;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
export const roadMi = (a: LatLon, b: LatLon): number => hav(a, b) * ROAD;
export const driveMin = (mi: number): number => Math.max(1, Math.round((mi / MPH) * 60 + (mi > 0.4 ? 2 : 0)));
export const fmtMi = (mi: number): string =>
  mi < 0.95 ? mi.toFixed(1) : mi < 10 ? mi.toFixed(1) : Math.round(mi).toString();

/** Pull a lat/lon out of pasted coordinates or a Google Maps link. */
export function parseCoords(text: string): LatLon | null {
  const s = String(text || '').trim();
  if (!s) return null;
  const pats = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /place\/(-?\d{1,2}\.\d+)(?:,|%2C)\s*\+?(-?\d{1,3}\.\d+)/i,
    /[?&](?:q|ll|query|destination|daddr|center|sll)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*\+?(-?\d{1,3}\.\d+)/i,
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /(?<![\d.-])(-?\d{1,2}\.\d{3,})(?![\d.])\s*[,\s]\s*(-?\d{1,3}\.\d{3,})(?![\d.])/,
  ];
  for (const re of pats) {
    const m = s.match(re);
    if (m) {
      const lat = +m[1];
      const lon = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  const dm = s.match(/(\d{1,2}\.\d+)\s*°?\s*([NS])[,\s]+(\d{1,3}\.\d+)\s*°?\s*([EW])/i);
  if (dm) return { lat: +dm[1] * (/s/i.test(dm[2]) ? -1 : 1), lon: +dm[3] * (/w/i.test(dm[4]) ? -1 : 1) };
  return null;
}

export function nearestTown(p: LatLon): { town: Town; mi: number } | null {
  let best: Town | null = null;
  let bd = Infinity;
  for (const t of TOWNS) {
    const d = hav(p, t);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best ? { town: best, mi: bd } : null;
}
