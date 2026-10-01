/* Memory on this device: a cookie (chunked, one year) plus localStorage.
   Account sync (Claude db capability) lives in App and layers on top. */
import type { AppState, Store } from '../types';
import { packImports, unpackImports, type PackedStore } from './importers';

export const CK = 'tl2';
export const LS_STATE = 'tl2_state';
export const LS_IMPORTS = 'tl2_imp';
export const LS_IMPORTS_AT = 'tl2_imp_at';
export const LS_VIEW = 'tl2_view';

export function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Store a JSON string across several cookies (browsers cap each at ~4 KB). */
export function saveCookie(json: string): boolean {
  try {
    const s = encodeURIComponent(json);
    if (s.length > 48000) return false;
    const chunks = s.match(/[\s\S]{1,3500}/g) || [];
    const attrs = '; path=/; max-age=31536000; SameSite=None; Secure';
    const oldN = +(readCookie(CK + '_n') || 0);
    for (let i = chunks.length; i < oldN; i++)
      document.cookie = CK + '_' + i + '=; path=/; max-age=0; SameSite=None; Secure';
    chunks.forEach((c, i) => {
      document.cookie = CK + '_' + i + '=' + c + attrs;
    });
    document.cookie = CK + '_n=' + chunks.length + attrs;
    return readCookie(CK + '_n') === String(chunks.length);
  } catch {
    return false;
  }
}

export function loadCookie(): unknown {
  try {
    const n = +(readCookie(CK + '_n') || 0);
    if (!n) return null;
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = readCookie(CK + '_' + i);
      if (c == null) return null;
      s += c;
    }
    return JSON.parse(decodeURIComponent(s));
  } catch {
    return null;
  }
}

export interface SavedWhere {
  ls: boolean;
  ck: boolean;
}

export function saveLocal(state: AppState): SavedWhere {
  const json = JSON.stringify(state);
  let ls = false;
  try {
    localStorage.setItem(LS_STATE, json);
    ls = true;
  } catch {
    /* storage blocked */
  }
  const ck = saveCookie(json);
  return { ls, ck };
}

const isState = (x: unknown): x is AppState => !!x && typeof x === 'object' && (x as { v?: unknown }).v === 2;

/** Newest saved state from localStorage or the cookie, or null. */
export function loadLocal(): AppState | null {
  let a: unknown = null;
  try {
    const j = localStorage.getItem(LS_STATE);
    if (j) a = JSON.parse(j);
  } catch {
    /* ignore */
  }
  const b = loadCookie();
  return [a, b].filter(isState).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))[0] || null;
}

export interface SavedImports {
  list: Store[];
  /** When this list was last changed (0 when nothing is saved). */
  updatedAt: number;
}

export function loadLocalImports(): SavedImports {
  try {
    const j = localStorage.getItem(LS_IMPORTS);
    const at = +(localStorage.getItem(LS_IMPORTS_AT) || 0);
    return { list: j ? unpackImports(JSON.parse(j) as PackedStore[]) : [], updatedAt: j ? at : 0 };
  } catch {
    return { list: [], updatedAt: 0 };
  }
}

export function saveLocalImports(list: Store[], updatedAt: number = Date.now()): void {
  try {
    localStorage.setItem(LS_IMPORTS, JSON.stringify(packImports(list)));
    localStorage.setItem(LS_IMPORTS_AT, String(updatedAt));
  } catch {
    /* ignore */
  }
}
