import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLocal, saveCookie, loadCookie, saveLocal, saveLocalImports, loadLocalImports } from './storage';
import { normalizeState, seedState } from './state';

/* A tiny stand-in for document.cookie and localStorage, enough for the chunking logic. */
function fakeBrowser() {
  const jar = new Map<string, string>();
  const doc = {
    get cookie() {
      return Array.from(jar.entries())
        .map(([k, v]) => k + '=' + v)
        .join('; ');
    },
    set cookie(s: string) {
      const [pair, ...attrs] = s.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1);
      if (attrs.some((a) => /max-age=0/.test(a))) jar.delete(k);
      else jar.set(k, v);
    },
  };
  const ls = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
    setItem: (k: string, v: string) => void ls.set(k, String(v)),
    removeItem: (k: string) => void ls.delete(k),
    clear: () => ls.clear(),
  };
  return { doc, storage, jar, ls };
}

describe('device storage', () => {
  let fb: ReturnType<typeof fakeBrowser>;
  beforeEach(() => {
    fb = fakeBrowser();
    Object.defineProperty(globalThis, 'document', { value: fb.doc, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: fb.storage, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('splits a long state across several cookies and reads it back', () => {
    const big = { v: 2, pad: 'x'.repeat(9000) };
    expect(saveCookie(JSON.stringify(big))).toBe(true);
    expect(fb.jar.get('tl2_n')).toBe('3');
    expect(loadCookie()).toEqual(big);
  });

  it('drops stale chunks when the state shrinks', () => {
    saveCookie(JSON.stringify({ pad: 'x'.repeat(9000) }));
    saveCookie(JSON.stringify({ pad: 'y' }));
    expect(fb.jar.has('tl2_1')).toBe(false);
    expect(loadCookie()).toEqual({ pad: 'y' });
  });

  it('refuses states too large for cookies but keeps localStorage', () => {
    const huge = { ...seedState(), items: [], pad: 'x'.repeat(60000) } as unknown as ReturnType<
      typeof seedState
    >;
    const where = saveLocal(huge);
    expect(where).toEqual({ ls: true, ck: false });
  });

  it('loads whichever copy is newer', () => {
    const older = { ...seedState(), updatedAt: 10 };
    const newer = { ...seedState(), updatedAt: 20, radius: 25 as const };
    fb.storage.setItem('tl2_state', JSON.stringify(older));
    saveCookie(JSON.stringify(newer));
    expect(loadLocal()?.radius).toBe(25);
    fb.storage.setItem('tl2_state', JSON.stringify({ ...newer, updatedAt: 30, radius: 5 }));
    expect(loadLocal()?.radius).toBe(5);
  });

  it('ignores blobs from another version', () => {
    fb.storage.setItem('tl2_state', JSON.stringify({ v: 1, items: [] }));
    expect(loadLocal()).toBeNull();
  });

  it('round-trips imported stores', () => {
    const list = [
      {
        id: 'imp-1',
        chain: '',
        name: 'A',
        kind: 'shoe' as const,
        addr: '',
        city: '',
        st: '',
        zip: '',
        phone: '',
        lat: 1,
        lon: 2,
        src: 'import' as const,
      },
    ];
    saveLocalImports(list, 123);
    expect(loadLocalImports()).toEqual({ list, updatedAt: 123 });
    expect(loadLocalImports().updatedAt).toBe(123);
  });
});

describe('normalizeState', () => {
  it('fills in anything missing and adds new categories', () => {
    const s = normalizeState({
      v: 2,
      items: 'nope',
      cats: [{ id: 'laces', name: 'L', short: 'L', tone: 'sun', shop: true }],
      baseId: 'gone',
    });
    expect(Array.isArray(s.items)).toBe(true);
    expect(s.cats.map((c) => c.id)).toContain('todo');
    expect(s.bases.some((b) => b.id === s.baseId)).toBe(true);
  });
  it('throws away malformed rows instead of crashing', () => {
    const s = normalizeState({
      v: 2,
      cats: 'laces',
      bases: [null, { id: 'b1', label: 'Home', lat: 40, lon: -75 }],
      items: [{}, null],
    });
    expect(s.cats.length).toBeGreaterThan(0);
    expect(s.bases.map((b) => b.id)).toEqual(['b1']);
    expect(s.baseId).toBe('b1');
    expect(s.items).toEqual([]);
  });
  it('drops chain filters the app no longer knows', () => {
    const s = normalizeState({
      v: 2,
      chains: ['zumiez', 'gone-chain', 7],
      picks: ['a', null],
      shopCats: 'laces',
    });
    expect(s.chains).toEqual(['zumiez']);
    expect(s.picks).toEqual(['a']);
    expect(s.shopCats).toEqual(['laces']);
  });
  it('starts fresh for anything else', () => {
    expect(normalizeState(null).items).toHaveLength(4);
    expect(normalizeState({ v: 1 }).v).toBe(2);
  });
});
