import { describe, expect, it } from 'vitest';
import { batchSpecs, calcLace, parseLace, shoeTitle, snapLen, sized } from './index';
import { lacesCalculator } from './calculator';
import { getCalculator } from '../registry';
import { SEED_LACES } from '../../data/catalog';

const size = (text: string) => {
  const spec = parseLace(text);
  return { spec, calc: sized(calcLace(spec)) };
};

describe('the four starter pairs', () => {
  it('Vans maroon Classic, 5 eyelets → 36″ flat', () => {
    const { spec, calc } = size(SEED_LACES[0]);
    expect(spec.modelKey).toBe('vans-authentic');
    expect(spec.color).toBe('Maroon');
    expect(spec.eyelets).toBe(5);
    expect(calc?.inches).toBe(36);
    expect(calc?.typeLabel).toMatch(/^Flat/);
  });
  it('Vans Half Cab, black or gray, 7 eyes → 54″', () => {
    const { spec, calc } = size(SEED_LACES[1]);
    expect(spec.modelKey).toBe('vans-half-cab');
    expect(spec.color).toBe('Black or gray');
    expect(calc?.inches).toBe(54);
    expect(calc?.conf).toBe('spec');
  });
  it('Nike SB Janoski canvas black, 4 eye → 36″', () => {
    const { spec, calc } = size(SEED_LACES[2]);
    expect(spec.modelKey).toBe('nike-sb-janoski');
    expect(spec.color).toBe('Black');
    expect(spec.notes).toBe('canvas');
    expect(calc?.inches).toBe(36);
  });
  it('Nike training (CrossFit), flat or slim, 5 eyelets → 36″ with a slim alternative', () => {
    const { spec, calc } = size(SEED_LACES[3]);
    expect(spec.modelKey).toBe('nike-metcon');
    expect(spec.laceType).toBe('flat');
    expect(spec.typeAlt).toBe('slim');
    expect(calc?.inches).toBe(36);
    expect(calc?.altType).toMatch(/^Slim flat/);
    expect(calc?.tip).toMatch(/45″/);
  });
});

describe('parseLace', () => {
  it('reads sizes, eyelets, colors and lacing styles', () => {
    const s = parseLace('Vans Old Skool white 8 eyelets size 10 bar lacing double knot');
    expect(s).toMatchObject({
      modelKey: 'vans-old-skool',
      color: 'White',
      eyelets: 8,
      size: 10,
      sizeSys: 'M',
      style: 'bar',
      bow: 'big',
    });
  });
  it("reads women's sizes", () => {
    expect(parseLace('nike dunk womens 8.5').size).toBe(8.5);
    expect(parseLace('nike dunk womens 8.5').sizeSys).toBe('W');
  });
  it('keeps the words it could not match as the model name', () => {
    const s = parseLace('Adidas Samba black 6 eyelets');
    expect(s.modelKey).toBeUndefined();
    expect(s.brand).toBe('Adidas');
    expect(s.modelText).toBe('Samba');
    expect(shoeTitle(s)).toBe('Adidas Samba');
  });
  it('does not mistake "classic" for a Vans Authentic without the brand', () => {
    expect(parseLace('reebok classic leather').modelKey).toBeUndefined();
  });
  it('only matches ambiguous Vans names when Vans is named', () => {
    expect(parseLace('slip-on laces').modelKey).toBeUndefined();
    expect(parseLace('era shoes 5 eyelets').modelKey).toBeUndefined();
    expect(parseLace('vans era').modelKey).toBe('vans-era');
    expect(parseLace('half cab 7 eyes').modelKey).toBe('vans-half-cab');
  });
});

describe('calcLace', () => {
  it('asks for eyelets when nothing is known', () => {
    expect(calcLace(parseLace('some shoe'))).toEqual({ need: ['eyelets'] });
  });
  it('knows slip-ons have no laces', () => {
    const c = calcLace(parseLace('vans slip on'));
    expect(c.noLaces).toBe(true);
  });
  it('splits Old Skool by size: 7 pairs under 6.5, 8 pairs above', () => {
    expect(sized(calcLace(parseLace('vans old skool size 6')))?.inches).toBe(45);
    expect(sized(calcLace(parseLace('vans old skool size 10')))?.inches).toBe(54);
  });
  it('falls back to the Nike eyelet chart for unknown shoes', () => {
    const c = sized(calcLace({ eyelets: 8, size: 10 }));
    expect(c?.inches).toBe(54);
    expect(c?.conf).toBe('chart');
    expect(c?.src[0]).toMatch(/Nike Help Center/);
  });
  it('adds length for heel-lock lacing and big loops (36 + 5 → next retail length, 40)', () => {
    expect(sized(calcLace({ modelKey: 'nike-metcon', style: 'heel' }))?.inches).toBe(40);
    expect(sized(calcLace({ modelKey: 'nike-metcon', bow: 'big' }))?.inches).toBe(40);
    expect(sized(calcLace({ modelKey: 'nike-metcon', style: 'heel', bow: 'big' }))?.inches).toBe(45);
  });
  it('fat laces on a shoe that ships with flat ones go up a size', () => {
    expect(sized(calcLace({ modelKey: 'vans-authentic', eyelets: 5, laceType: 'fat' }))?.inches).toBe(40);
  });
  it('suggests a shelf length when the exact size is uncommon', () => {
    const c = sized(calcLace({ eyelets: 4, size: 10, bow: 'short' }));
    expect(c?.inches).toBe(24);
    expect(c?.shelf).toBe(27);
  });
  it('builds a search query from the result', () => {
    const c = sized(calcLace(parseLace(SEED_LACES[0])));
    expect(c?.search).toBe('36 inch flat shoelaces maroon');
  });
});

describe('snapLen', () => {
  it('rounds up to the next retail length with 1.5″ of slack', () => {
    expect(snapLen(35)).toBe(36);
    expect(snapLen(37)).toBe(36);
    expect(snapLen(38)).toBe(40);
    expect(snapLen(99)).toBe(84);
  });
});

describe('batchSpecs (bulk sheet)', () => {
  const a = { id: 'a', text: SEED_LACES[0], lace: parseLace(SEED_LACES[0]) };
  it('derives a spec for every queued item, parsing text when the item has none', () => {
    const b = { id: 'b', text: 'nike dunk low black 7 eyelets' };
    const s = batchSpecs([a, b], {});
    expect(s.a.modelKey).toBe('vans-authentic');
    expect(s.b).toMatchObject({ modelKey: 'nike-sb-dunk-low', eyelets: 7, color: 'Black' });
  });
  it('keeps edits per item and still covers a pair queued after the sheet opened', () => {
    const edits = { a: { eyelets: 6, color: 'Red' } };
    const late = { id: 'late', text: 'some shoe' };
    const s = batchSpecs([a, late], edits);
    expect(s.a).toMatchObject({ modelKey: 'vans-authentic', eyelets: 6, color: 'Red' });
    expect(s.late).toBeDefined();
    expect(calcLace(s.late).need).toEqual(['eyelets']);
    // the item's own spec is never mutated by an edit
    expect(a.lace.eyelets).toBe(5);
  });
});

describe('calculator registry', () => {
  it('serves laces and nothing else yet', () => {
    expect(getCalculator('laces')).toBe(lacesCalculator);
    expect(getCalculator('groceries')).toBeNull();
  });
  it('knows when an entry is complete enough to skip the wizard', () => {
    const spec = parseLace(SEED_LACES[0]);
    expect(lacesCalculator.complete(spec, calcLace(spec))).toBe(true);
    const vague = parseLace('vans old skool');
    expect(lacesCalculator.complete(vague, calcLace(vague))).toBe(false);
    expect(lacesCalculator.missing(vague)).toEqual(['lace color']);
    // a known model supplies the eyelet count, so color is all that was missing
    const known = parseLace('vans old skool white size 10');
    expect(lacesCalculator.complete(known, calcLace(known))).toBe(true);
    const noLaces = parseLace('vans slip on white');
    expect(lacesCalculator.complete(noLaces, calcLace(noLaces))).toBe(false);
  });
  it('summarises the buy', () => {
    const spec = parseLace(SEED_LACES[1]);
    expect(lacesCalculator.summary(spec, calcLace(spec))).toBe('Vans Half Cab: buy 54″ flat');
    expect(lacesCalculator.search(spec, calcLace(spec))).toBe('54 inch flat shoelaces black');
    const fat = parseLace('nike dunk low black 7 eyelets');
    expect(lacesCalculator.search(fat, calcLace(fat))).toBe('54 inch fat shoelaces black');
  });
});
