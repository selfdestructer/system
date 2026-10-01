/* ---------- Lace sizing data ----------
   Retail lengths sold in the US; SHELF = the ones big-box stores stock most. */
import type { BowKey, LaceType, LacingStyle, ShoeModel } from '../../types';

export const RETAIL = [24, 27, 30, 36, 40, 45, 48, 54, 60, 63, 72, 84];
export const SHELF = [27, 36, 45, 54, 63, 72];
/* Nike Help Center chart (eyelet pairs → inches). 1–3 pairs extrapolated. */
export function chartLength(p: number): number {
  if (p <= 3) return 24;
  if (p === 4) return 27;
  if (p === 5) return 36;
  if (p <= 7) return 45;
  if (p === 8) return 54;
  if (p <= 10) return 60;
  return 72;
}
export const MODELS: ShoeModel[] = [
  {
    key: 'vans-half-cab',
    brand: 'Vans',
    name: 'Half Cab',
    re: /half[\s-]*cab/,
    profile: 'mid',
    pairs: () => 7,
    stock: { 7: 54 },
    width: '3/8″ (10 mm)',
    type: 'flat',
    src: '818 Skate, measuring the laces in the Vans box: Half Cabs ship with 54″ in every size.',
    tip: 'Lacing a true low-cut 7-eye, or skipping the top collar eyelet? 45″ is plenty.',
  },
  {
    key: 'vans-old-skool',
    brand: 'Vans',
    name: 'Old Skool',
    re: /old\s*sk(?:oo|u)l|old\s*school/,
    profile: 'low',
    pairs: (sz) => (sz && sz <= 6.5 ? 7 : 8),
    stock: { 7: 45, 8: 54 },
    width: '3/8″ (10 mm)',
    type: 'flat',
    src: '818 Skate chart: 45″ for 7 pairs (men’s 3.5–6.5), 54″ for 8 pairs (men’s 7–13).',
  },
  {
    key: 'vans-sk8-hi',
    brand: 'Vans',
    name: 'Sk8-Hi',
    re: /sk8[\s-]*hi|skate[\s-]*hi/,
    profile: 'high',
    pairs: () => 8,
    stock: { 8: 54 },
    width: '3/8″ (10 mm)',
    type: 'flat',
    src: '818 Skate chart: 54″ in all sizes.',
  },
  {
    key: 'vans-slip-on',
    brand: 'Vans',
    name: 'Slip-On',
    re: /slip[\s-]*on/,
    profile: 'low',
    needVans: true,
    noLaces: true,
    pairs: () => 0,
    stock: {},
    width: '',
    type: 'flat',
    src: 'Vans Slip-Ons have no laces.',
  },
  {
    key: 'nike-sb-janoski',
    brand: 'Nike SB',
    name: 'Stefan Janoski',
    re: /janoski/,
    profile: 'low',
    pairs: () => 4,
    stock: { 4: 36, 5: 40 },
    width: '5/16″ (8 mm)',
    type: 'flat',
    src: 'Slickies fits Janoskis with 90 cm (≈35″) laces and factory Janoski laces run about 39″. Nike’s generic 27″ for 4 eyelets leaves almost no bow on this wide lacing.',
    tip: 'Want the factory look with longer loops? Grab 40″.',
  },
  {
    key: 'nike-sb-dunk-low',
    brand: 'Nike SB',
    name: 'Dunk Low',
    re: /\bdunks?\b/,
    profile: 'low',
    pairs: () => 7,
    stock: { 7: 54 },
    width: 'fat 5/8″ (16 mm) or oval',
    type: 'fat',
    src: 'Shoe Lace Supply: 7 eyelets take 54″ laced all the way, 48″ laced loose.',
  },
  {
    key: 'nike-metcon',
    brand: 'Nike',
    name: 'Metcon (training)',
    re: /metcon|cross\s*-?\s*fit|\btraining\b|\btrainers?\b/,
    profile: 'low',
    needNike: true,
    pairs: () => 5,
    stock: { 4: 36, 5: 36, 6: 45 },
    width: '5/16″ (8 mm)',
    type: 'flat',
    src: 'Nike Help Center chart: 5 eyelets take 36″. DoctorLaces lists 36″ for the Metcon too.',
    tip: 'Running a heel-lock loop through the top eyelet? Go 45″.',
  },
  {
    key: 'vans-era',
    brand: 'Vans',
    name: 'Era',
    re: /\bera\b/,
    profile: 'low',
    needVans: true,
    pairs: (sz) => (sz && sz <= 6 ? 4 : 5),
    stock: { 4: 28, 5: 36 },
    width: '3/8″ (10 mm)',
    type: 'flat',
    src: '818 Skate chart: Authentics and Eras share the lace — 36″ for 5 pairs, 28″ for 4.',
    tip: 'Slickies sizes the Era at 100 cm (≈40″) if you like a bigger knot.',
  },
  {
    key: 'vans-authentic',
    brand: 'Vans',
    name: 'Authentic (Classic)',
    re: /\bauthentic\b|\bclassics?\b/,
    profile: 'low',
    needVans: true,
    pairs: (sz) => (sz && sz <= 6 ? 4 : 5),
    stock: { 4: 28, 5: 36 },
    width: '3/8″ (10 mm)',
    type: 'flat',
    src: '818 Skate, measuring the laces in the Vans box: 36″ on 5-eyelet Authentics (men’s 6.5–13), 28″ on the 4-eyelet small sizes.',
    tip: 'Want a roomier bow? Slickies sizes 5-eyelet Vans at 100 cm (≈40″).',
  },
];
export const STYLES: Record<LacingStyle, { label: string; d: number }> = {
  criss: { label: 'Criss-cross', d: 0 },
  bar: { label: 'Bar lacing', d: 2 },
  hidden: { label: 'Hidden knot', d: -9 },
  heel: { label: 'Heel lock', d: 5 },
  skip: { label: 'Skip top eyelet', d: -5 },
};
export const BOWS: Record<BowKey, { label: string; d: number }> = {
  short: { label: 'Short bow', d: -4 },
  std: { label: 'Standard bow', d: 0 },
  big: { label: 'Big loops', d: 5 },
};
export const TYPES: Record<LaceType, { label: string; d: number; width?: string }> = {
  flat: { label: 'Flat', d: 0 },
  slim: { label: 'Slim flat', d: 0, width: '1/4″ (6 mm)' },
  oval: { label: 'Oval', d: 0, width: '1/4″ oval' },
  round: { label: 'Round', d: 1, width: '4 mm round' },
  fat: { label: 'Fat flat', d: 4, width: '5/8″ (16 mm)' },
  waxed: { label: 'Waxed', d: 0, width: '3 mm waxed' },
};
export const COLORS: [string, string][] = [
  ['Black', '#16181B'],
  ['White', '#F4F4F0'],
  ['Gray', '#8C949C'],
  ['Maroon', '#7A1F2E'],
  ['Navy', '#1F2F5C'],
  ['Red', '#D6343C'],
  ['Brown', '#6B4A2E'],
  ['Tan', '#C8A57A'],
  ['Green', '#3E8E5A'],
  ['Royal blue', '#2F5FD0'],
];
