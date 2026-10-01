/* Lace parsing and sizing. Inputs: free text like "Vans Old Skool white, 8 eyelets, size 10".
   Output: the lace length to buy, in inches, with the reasoning and sources. */
import type {
  LaceCalc,
  LaceConfidence,
  LaceSized,
  LaceSpec,
  LaceType,
  LacingStyle,
  ShoeModel,
} from '../../types';
import { BOWS, COLORS, MODELS, RETAIL, SHELF, STYLES, TYPES, chartLength } from './data';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const sgn = (n: number) => (n > 0 ? '+' : '−') + Math.abs(n);
export const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const COLOR_WORDS: [RegExp, string][] = [
  [/\bmar+o+n\b/, 'Maroon'],
  [/\bburgundy\b|\bwine\b|\boxblood\b/, 'Burgundy'],
  [/\bblack\b/, 'Black'],
  [/\boff[-\s]?white\b|\bcream\b|\bbone\b/, 'Cream'],
  [/\bwhite\b/, 'White'],
  [/\bgr[ae]y\b|\bcharcoal\b/, 'Gray'],
  [/\bnavy\b/, 'Navy'],
  [/\bred\b/, 'Red'],
  [/\bbrown\b|\bchocolate\b/, 'Brown'],
  [/\btan\b|\bkhaki\b/, 'Tan'],
  [/\bgreen\b|\bolive\b/, 'Green'],
  [/\broyal\s*blue\b|\broyal\b/, 'Royal blue'],
  [/\bblue\b/, 'Blue'],
  [/\bpink\b/, 'Pink'],
  [/\bpurple\b/, 'Purple'],
  [/\byellow\b/, 'Yellow'],
  [/\borange\b/, 'Orange'],
  [/\breflective\b/, 'Reflective'],
];

export function detectBrand(t: string): string {
  if (/\bvans\b/.test(t)) return 'Vans';
  if (/\bnike\b|\bsb\b|\bjordan\b/.test(t)) return 'Nike';
  if (/\badidas\b/.test(t)) return 'Adidas';
  if (/\bconverse\b|\bchucks?\b/.test(t)) return 'Converse';
  if (/new\s*balance|\bnb\b/.test(t)) return 'New Balance';
  if (/\breebok\b/.test(t)) return 'Reebok';
  if (/\basics\b/.test(t)) return 'ASICS';
  if (/\bpuma\b/.test(t)) return 'Puma';
  if (/\bhoka\b/.test(t)) return 'HOKA';
  if (/dr\.?\s*martens?|\bdocs\b/.test(t)) return 'Dr. Martens';
  if (/\btimberland\b/.test(t)) return 'Timberland';
  if (/\bdc\s*shoes?\b|\bdc\b/.test(t)) return 'DC';
  if (/\betnies\b/.test(t)) return 'etnies';
  return '';
}

export function parseLace(text: string): LaceSpec {
  const raw = String(text || '').trim();
  let t = ' ' + raw.toLowerCase().replace(/[–—]/g, ' - ') + ' ';
  const spec: LaceSpec = { raw };
  const em = t.match(/(\d{1,2})\s*-?\s*(eyelets?|eyes?|holes?|pairs?)\b/);
  if (em) {
    spec.eyelets = clamp(+em[1], 1, 14);
    t = t.replace(em[0], ' ');
  }
  const sm =
    t.match(/\b(size|sz|us|mens|men'?s|womens|women'?s)\s*(\d{1,2}(?:\.5)?)\s*(m|w)?\b/) ||
    t.match(/\b(\d{1,2}(?:\.5)?)\s*(m|w)\b/);
  if (sm) {
    const num = parseFloat(sm[2] && /\d/.test(sm[2]) ? sm[2] : sm[1]);
    if (num >= 1 && num <= 18) {
      spec.size = num;
      spec.sizeSys = /\bw|women/.test(sm[0]) ? 'W' : 'M';
      t = t.replace(sm[0], ' ');
    }
  }
  const brand = detectBrand(t);
  if (brand) spec.brand = brand;
  for (const m of MODELS) {
    const mm = t.match(m.re);
    if (!mm) continue;
    if (m.needVans && brand !== 'Vans') continue;
    if (m.key === 'vans-authentic' && /classic/.test(mm[0]) && brand !== 'Vans') continue;
    if (m.needNike && brand !== 'Nike' && !/metcon/.test(mm[0])) continue;
    spec.modelKey = m.key;
    spec.brand = m.brand;
    break;
  }
  const found: { name: string; i: number }[] = [];
  let ct = t;
  for (const [re, name] of COLOR_WORDS) {
    const m = ct.match(re);
    if (m && m.index != null && !found.some((f) => f.name === name)) {
      found.push({ name, i: m.index });
      ct = ct.slice(0, m.index) + ' '.repeat(m[0].length) + ct.slice(m.index + m[0].length);
    }
  }
  found.sort((a, b) => a.i - b.i);
  if (found.length === 1) spec.color = found[0].name;
  else if (found.length > 1) {
    const parts = found.slice(0, 3).map((f, i) => (i ? f.name.toLowerCase() : f.name));
    spec.color = parts.join(/\bor\b/.test(t) ? ' or ' : '/');
  }
  const types: LaceType[] = [];
  if (/\bflat\b/.test(t)) types.push('flat');
  if (/\bslim\b|\bthin\b|\bskinny\b/.test(t)) types.push('slim');
  if (/\boval\b/.test(t)) types.push('oval');
  if (/\bround\b|\brope\b/.test(t)) types.push('round');
  if (/\bfat\b|\bchunky\b/.test(t)) types.push('fat');
  if (/\bwaxed\b/.test(t)) types.push('waxed');
  if (types.length) {
    spec.laceType = types[0];
    if (types[1]) spec.typeAlt = types[1];
  }
  if (/straight[\s-]*bar|\bbar\s*lac|\bbar\b/.test(t)) spec.style = 'bar';
  else if (/hidden|tuck/.test(t)) spec.style = 'hidden';
  else if (/heel[\s-]*lock|runner'?s?\s*loop|lace\s*lock/.test(t)) spec.style = 'heel';
  else if (/skip\s*(the\s*)?top/.test(t)) spec.style = 'skip';
  if (/double[\s-]*knot|big\s*loops?/.test(t)) spec.bow = 'big';
  else if (/short\s*bow/.test(t)) spec.bow = 'short';
  const notes: string[] = [];
  for (const w of ['canvas', 'suede', 'leather', 'low', 'mid'])
    if (new RegExp('\\b' + w + '\\b').test(t)) notes.push(w);
  if (notes.length) spec.notes = notes.join(', ');
  if (!spec.modelKey) {
    let rest = t
      .replace(
        /\b(vans|nike|sb|adidas|converse|new balance|reebok|asics|puma|hoka|jordan|timberland|etnies|dc)\b/g,
        ' ',
      )
      .replace(
        /\b(shoe\s*laces?|shoelaces?|laces?|for|my|the|and|or|with|of|size|low|mid|high|canvas|suede|leather|flat|slim|thin|oval|round|rope|fat|waxed|elastic|pair)\b/g,
        ' ',
      );
    for (const [re] of COLOR_WORDS) rest = rest.replace(new RegExp(re.source, 'g'), ' ');
    rest = rest
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s-\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (rest) spec.modelText = rest.split(' ').slice(0, 4).map(cap1).join(' ');
  }
  return spec;
}

export const modelOf = (key: string | undefined): ShoeModel | null =>
  MODELS.find((m) => m.key === key) || null;
export const snapLen = (target: number): number =>
  RETAIL.find((r) => r >= target - 1.5) || RETAIL[RETAIL.length - 1];

export function shoeTitle(spec: LaceSpec | undefined): string {
  const m = modelOf(spec && spec.modelKey);
  if (m) return `${m.brand} ${m.name}`;
  return [spec && spec.brand, spec && spec.modelText].filter(Boolean).join(' ') || 'Shoe';
}

/** Men's-equivalent size (women's run about 1.5 sizes larger on the same last). */
export const sizeMens = (spec: LaceSpec): number | null =>
  spec.size ? (spec.sizeSys === 'W' ? spec.size - 1.5 : spec.size) : null;

export function calcLace(input?: LaceSpec): LaceCalc {
  const spec: LaceSpec = input || {};
  const m = modelOf(spec.modelKey);
  if (m && m.noLaces)
    return { noLaces: true, why: [`${m.brand} ${m.name}s have no laces, so there's nothing to buy.`] };
  const sizeM = sizeMens(spec);
  const pairs = spec.eyelets || (m ? m.pairs(sizeM) : 0) || spec.aiPairs || 0;
  if (!pairs) return { need: ['eyelets'] };
  const why: string[] = [];
  const src: string[] = [];
  let base: number;
  let conf: LaceConfidence;
  if (m && m.stock[pairs]) {
    base = m.stock[pairs];
    conf = spec.eyelets ? 'spec' : 'model';
    why.push(`${m.brand} ${m.name} with ${pairs} eyelet pairs: ${base}″ base.`);
    src.push(m.src);
  } else if (!m && spec.aiStock) {
    base = spec.aiStock;
    conf = 'est';
    why.push(`Claude's estimate for this shoe: ships with ${base}″ laces.`);
  } else {
    base = chartLength(pairs);
    conf = 'chart';
    why.push(`Nike's eyelet chart: ${pairs} pairs → ${base}″ base.`);
    src.push(
      'Nike Help Center lace chart: 4 eyelets 27″, 5 → 36″, 6–7 → 45″, 8 → 54″, 9–10 → 60″, more → 72″.',
    );
    if (m) why.push(`No ${m.name} spec for ${pairs} pairs, so the general chart applies.`);
  }
  let d = 0;
  const style = STYLES[spec.style || 'criss'] || STYLES.criss;
  if (style.d) {
    d += style.d;
    why.push(`${style.label}: ${sgn(style.d)}″.`);
  }
  const bow = BOWS[spec.bow || 'std'] || BOWS.std;
  if (bow.d) {
    d += bow.d;
    why.push(`${bow.label}: ${sgn(bow.d)}″.`);
  }
  const modelType: LaceType = m ? m.type : 'flat';
  const type: LaceType = spec.laceType || modelType;
  const tp = TYPES[type] || TYPES.flat;
  if (tp.d && type !== modelType) {
    d += tp.d;
    why.push(`${tp.label} laces eat more length: ${sgn(tp.d)}″.`);
  }
  if (!m && sizeM && sizeM >= 14) {
    d += 3;
    why.push('Size 14+ spreads the eyelets: +3″.');
  }
  if (!m && sizeM && sizeM <= 5) {
    d -= 2;
    why.push('Small size: −2″.');
  }
  const target = base + d;
  const inches = snapLen(target);
  const shelfPick = SHELF.find((r) => r >= target - 1.5) || null;
  const shelf = SHELF.includes(inches) || !shelfPick || shelfPick === inches ? null : shelfPick;
  const alts: { label: string; inches: number }[] = [];
  const styleKey: LacingStyle = spec.style || 'criss';
  const tryAlt = (label: string, dd: number) => {
    const v = snapLen(target + dd);
    if (v !== inches && !alts.some((a) => a.inches === v)) alts.push({ label, inches: v });
  };
  if (spec.bow !== 'big') tryAlt('Big loops / double knot', BOWS.big.d - bow.d);
  if (styleKey !== 'bar') tryAlt('Bar lacing', STYLES.bar.d - style.d);
  if (styleKey !== 'hidden') tryAlt('Hidden knot, ends tucked', STYLES.hidden.d - style.d);
  const width = type === 'flat' ? (m ? m.width : '5/16″ (8 mm)') : tp.width || '';
  const typeLabel = tp.label + (width ? ' · ' + width : '');
  const at = spec.typeAlt && TYPES[spec.typeAlt] ? TYPES[spec.typeAlt] : null;
  const altType = at ? at.label + (at.width ? ' · ' + at.width : '') : null;
  const needs: string[] = [];
  if (!spec.color) needs.push('color');
  if (!spec.eyelets) needs.push('eyelets');
  if (!spec.size && !m) needs.push('size');
  const colorWord = spec.color ? spec.color.split(/ or |\//)[0].toLowerCase() : '';
  const typeWord =
    type === 'slim'
      ? 'thin flat'
      : type === 'fat'
        ? 'fat'
        : type === 'round'
          ? 'round'
          : type === 'oval'
            ? 'oval'
            : 'flat';
  const search = `${inches} inch ${typeWord} shoelaces${colorWord ? ' ' + colorWord : ''}`;
  return {
    inches,
    cm: Math.round(inches * 2.54),
    target,
    pairs,
    lo: Math.max(target - 3, 12),
    hi: target + 6,
    shelf,
    alts,
    typeLabel,
    altType,
    type,
    conf,
    why,
    src,
    tip: m && m.tip ? m.tip : null,
    needs,
    search,
  };
}

/** Swatch color for a lace color name. */
export function swatchOf(color: string | undefined): string {
  const first = String(color || '')
    .split(/ or |\/|,/)[0]
    .trim()
    .toLowerCase();
  const hit =
    COLORS.find(([n]) => n.toLowerCase() === first) || COLORS.find(([n]) => first.includes(n.toLowerCase()));
  if (hit) return hit[1];
  if (/burgundy|wine/.test(first)) return '#6E1E2C';
  if (/cream|bone/.test(first)) return '#EDE6D2';
  if (/blue/.test(first)) return '#3F7FD9';
  if (/pink/.test(first)) return '#E48AB2';
  if (/purple/.test(first)) return '#7B55C7';
  if (/yellow/.test(first)) return '#F2C94C';
  if (/orange/.test(first)) return '#E9803A';
  return '#5E6E7C';
}

/** The sized result, or null when the calc still needs input or the shoe has no laces. */
export const sized = (c: LaceCalc | undefined | null): LaceSized | null =>
  c && c.inches ? (c as LaceSized) : null;
