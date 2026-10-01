import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClaudeDocRef, ClaudeError, ClaudeSample } from '../claude';
import type { AppState, Item, ItemView, LaceSized, LaceSpec, View } from '../types';
import { getCalculator } from '../calc/registry';
import { packImports, unpackImports, type PackedStore } from '../lib/importers';
import {
  LS_VIEW,
  loadLocal,
  loadLocalImports,
  saveLocal,
  saveLocalImports,
  type SavedWhere,
} from '../lib/storage';
import { normalizeState, uid } from '../lib/state';
import { Title } from './Title';
import { Seg } from './controls';
import { BatchResults, BatchSheet, LaceWizard, type LaceDraft } from './lace';
import { ItemRow, LaceCard } from './rows';
import { ShopPanel, type Update } from './ShopPanel';
import { StoresView } from './StoresView';
import { TripView } from './TripView';
import { AI_OFF, I, Icon, clone } from './common';

const DEVICE = uid();
type Sync = 'device' | 'saving' | 'synced' | 'error';

interface ListsDoc {
  updatedAt: number;
  writer: string;
  state: AppState;
}
interface ImportsDoc {
  updatedAt: number;
  rows: PackedStore[];
}
interface Writer {
  timer: ReturnType<typeof setTimeout> | 0;
  busy: boolean;
  pending: AppState | null;
}
const TABS: [View, string][] = [
  ['lists', 'Lists'],
  ['stores', 'Stores'],
  ['trip', 'Trip'],
];

function SyncPill({ sync, saved }: { sync: Sync; saved: SavedWhere }) {
  const label =
    sync === 'synced'
      ? 'Synced to your account'
      : sync === 'saving'
        ? 'Saving…'
        : sync === 'error'
          ? 'Sync hiccup · kept on this device'
          : saved.ls || saved.ck
            ? 'Saved on this device'
            : 'Not saved: storage blocked';
  return (
    <span className={'sync ' + sync}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

const readView = (st: AppState): View => {
  if (st.trip && st.trip.status === 'active') return 'trip';
  try {
    const v = localStorage.getItem(LS_VIEW);
    if (v === 'lists' || v === 'stores' || v === 'trip') return v;
  } catch {
    /* ignore */
  }
  return 'lists';
};

export function App() {
  const [st, setSt] = useState<AppState>(() => normalizeState(loadLocal()));
  const [imports, setImportsState] = useState(() => loadLocalImports().list);
  const importsAt = useRef(loadLocalImports().updatedAt);
  const [sync, setSync] = useState<Sync>('device');
  const [saved, setSaved] = useState<SavedWhere>({ ls: true, ck: true });
  const [ai, setAi] = useState<ClaudeSample | null>(null);
  const [aiImg, setAiImg] = useState(false);
  const [draft, setDraft] = useState<LaceDraft | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [cat, setCat] = useState('laces');
  const [toastMsg, setToastMsg] = useState<{ m: string; k: number } | null>(null);
  const [view, setViewState] = useState<View>(() => readView(st));
  const setView = useCallback((v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(LS_VIEW, v);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const stRef = useRef(st);
  useEffect(() => {
    stRef.current = st;
  }, [st]);
  const capRef = useRef<{ ref: ClaudeDocRef<ListsDoc> | null; impRef: ClaudeDocRef<ImportsDoc> | null }>({
    ref: null,
    impRef: null,
  });
  const firstSnap = useRef(true);
  const skipWrite = useRef(false);
  const wr = useRef<Writer>({ timer: 0, busy: false, pending: null });
  const localTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);
  const toast = useCallback((m: string) => setToastMsg({ m, k: Date.now() }), []);
  useEffect(() => {
    if (!toastMsg) return undefined;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);
  const update = useCallback<Update>(
    (fn) =>
      setSt((prev) => {
        const d = clone(prev);
        fn(d);
        d.updatedAt = Date.now();
        return d;
      }),
    [],
  );
  // flush lives in a ref so its retry timers can call the latest version of itself.
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const flush = useCallback(() => flushRef.current(), []);
  useEffect(() => {
    flushRef.current = async () => {
      const w = wr.current;
      const ref = capRef.current.ref;
      if (!ref || w.busy || !w.pending) return;
      const s = w.pending;
      w.pending = null;
      w.busy = true;
      setSync('saving');
      try {
        await ref.set({ updatedAt: s.updatedAt || Date.now(), writer: DEVICE, state: s });
        setSync('synced');
      } catch (e) {
        const code = (e as ClaudeError | null)?.code;
        if (code === 'unavailable') {
          if (!w.pending) w.pending = s;
          setTimeout(() => flush(), 1200 + Math.random() * 1200);
        } else if (
          code === 'invalid_argument' ||
          code === 'not_granted' ||
          code === 'revoked' ||
          code === 'capability_disabled'
        ) {
          capRef.current.ref = null;
          setSync('device');
        } else setSync('error');
      } finally {
        w.busy = false;
        if (w.pending && capRef.current.ref) w.timer = setTimeout(() => flush(), 400);
      }
    };
  }, [flush]);
  const scheduleWrite = useCallback(
    (s: AppState, now?: boolean) => {
      const w = wr.current;
      w.pending = s;
      clearTimeout(w.timer);
      w.timer = setTimeout(() => flush(), now ? 0 : 900);
    },
    [flush],
  );
  // Save every change: cookie + localStorage right away, account (db) debounced.
  useEffect(() => {
    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => setSaved(saveLocal(st)), 250);
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    if (capRef.current.ref && !firstSnap.current) scheduleWrite(st);
  }, [st, scheduleWrite]);
  // Runtime capabilities: per-user storage (db + user) and Claude (sample).
  useEffect(() => {
    let dead = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      const [db, user, sample] = await Promise.all([
        c.use('db').catch(() => null),
        c.use('user').catch(() => null),
        c.use('sample').catch(() => null),
      ]);
      if (dead) return;
      if (sample) {
        setAi(() => sample);
        try {
          const l = await sample.limits();
          if (!dead) setAiImg(!!(l && l.images));
        } catch {
          /* no images */
        }
      }
      if (!db || !user) return;
      let id: string | null;
      try {
        id = await user.id();
      } catch {
        id = null;
      }
      if (!id || dead) return;
      let ref: ClaudeDocRef<ListsDoc>;
      let impRef: ClaudeDocRef<ImportsDoc>;
      try {
        ref = db.doc<ListsDoc>('data/users/' + id + '/lists');
        impRef = db.doc<ImportsDoc>('data/users/' + id + '/imports');
      } catch {
        return;
      }
      capRef.current = { ref, impRef };
      unsub = ref.onSnapshot(
        (snap) => {
          const remote = snap.exists ? snap.data() : null;
          const local = stRef.current;
          if (firstSnap.current) {
            firstSnap.current = false;
            if (remote && remote.state && (remote.updatedAt || 0) > (local.updatedAt || 0)) {
              skipWrite.current = true;
              setSt(normalizeState(remote.state));
              setSync('synced');
            } else scheduleWrite(local, true);
            return;
          }
          if (
            remote &&
            remote.state &&
            remote.writer !== DEVICE &&
            (remote.updatedAt || 0) > (stRef.current.updatedAt || 0)
          ) {
            skipWrite.current = true;
            setSt(normalizeState(remote.state));
            setSync('synced');
          }
        },
        () => {
          capRef.current.ref = null;
          setSync('device');
        },
      );
      try {
        const snap = await impRef.get();
        if (!dead && snap.exists) {
          const d = snap.data();
          // Newest copy wins, even when it is empty (the user cleared imports elsewhere).
          if (d && Array.isArray(d.rows) && (d.updatedAt || 0) > importsAt.current) {
            const list = unpackImports(d.rows);
            importsAt.current = d.updatedAt || 0;
            setImportsState(list);
            saveLocalImports(list, importsAt.current);
          }
        }
      } catch {
        /* imports stay local */
      }
    })();
    return () => {
      dead = true;
      if (unsub) unsub();
    };
  }, [scheduleWrite]);
  const setImports = useCallback((list: Parameters<typeof saveLocalImports>[0]) => {
    const at = Date.now();
    importsAt.current = at;
    setImportsState(list);
    saveLocalImports(list, at);
    const r = capRef.current.impRef;
    if (r) r.set({ updatedAt: at, rows: packImports(list) }).catch(() => {});
  }, []);
  const onAiError = useCallback((e: unknown) => {
    const code = (e as ClaudeError | null)?.code;
    if (code && AI_OFF.includes(code)) setAi(null);
  }, []);
  // Attach each item's calculator result (laces today; any registered calculator tomorrow).
  const items = useMemo<ItemView[]>(
    () =>
      st.items.map((i) => {
        const pc = getCalculator(i.cat);
        return pc && i.lace && !i.queued ? { ...i, calc: pc.calc(i.lace) } : i;
      }),
    [st.items],
  );
  const pushItem = (d: AppState, item: Item) => {
    d.items.push(item);
    if (item.cat !== 'todo' && !d.shopCats.includes(item.cat)) d.shopCats.push(item.cat);
  };
  const addItem = (c: string, text: string) => {
    const pc = getCalculator(c);
    if (pc) {
      const spec = pc.parse(text);
      if (st.bulk) {
        update((d) => {
          d.items.push({
            id: uid(),
            cat: c,
            text,
            lace: spec,
            done: false,
            qty: 1,
            queued: true,
            at: Date.now(),
          });
        });
        toast('Queued for bulk calc');
        return;
      }
      const calc = pc.calc(spec);
      if (pc.complete(spec, calc)) {
        update((d) =>
          pushItem(d, { id: uid(), cat: c, text, lace: spec, done: false, qty: 1, at: Date.now() }),
        );
        toast(pc.summary(spec, calc) || 'Added');
      } else setDraft({ text, spec });
      return;
    }
    const m = text.match(/(?:^|\s)(?:x\s*(\d{1,3})|(\d{1,3})\s*x)(?=\s|$)/i);
    const qty = m ? +(m[1] || m[2]) : 1;
    const clean = m ? text.replace(m[0], ' ').replace(/\s+/g, ' ').trim() : text;
    update((d) => pushItem(d, { id: uid(), cat: c, text: clean || text, done: false, qty, at: Date.now() }));
  };
  const saveDraft = () => {
    if (!draft) return;
    const pc = getCalculator('laces');
    if (!pc) return;
    const spec = draft.spec;
    const calc = pc.calc(spec);
    if (calc.need) return;
    const editId = draft.editId;
    if (editId)
      update((d) => {
        const it = d.items.find((x) => x.id === editId);
        if (it) {
          it.lace = spec;
          it.queued = false;
        }
      });
    else
      update((d) =>
        pushItem(d, {
          id: uid(),
          cat: 'laces',
          text: draft.text,
          lace: spec,
          done: false,
          qty: 1,
          at: Date.now(),
        }),
      );
    setDraft(null);
    toast(calc.noLaces ? 'Saved' : pc.summary(spec, calc) || 'Saved');
  };
  const runBatch = (specs: Record<string, LaceSpec>) => {
    update((d) => {
      const done: string[] = [];
      for (const it of d.items) {
        if (!it.queued || !specs[it.id]) continue;
        it.lace = specs[it.id];
        const pc = getCalculator(it.cat);
        if (pc && !pc.calc(it.lace).need) {
          it.queued = false;
          done.push(it.id);
        }
      }
      d.lastBatch = done;
      for (const it of d.items)
        if (done.includes(it.id) && it.cat !== 'todo' && !d.shopCats.includes(it.cat))
          d.shopCats.push(it.cat);
    });
    setBatchOpen(false);
  };
  const toggleItem = (id: string) =>
    update((d) => {
      const it = d.items.find((x) => x.id === id);
      if (it) {
        it.done = !it.done;
        if (!it.done) delete it.foundAt;
      }
    });
  const deleteItem = (id: string) =>
    update((d) => {
      d.items = d.items.filter((x) => x.id !== id);
    });
  const editLace = (it: ItemView) => {
    const pc = getCalculator(it.cat);
    setDraft({ text: it.text, spec: { ...(it.lace || (pc ? pc.parse(it.text) : {})) }, editId: it.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const queued = items.filter((i) => i.queued);
  const lastBatch = st.lastBatch;
  const batchRes = lastBatch
    ? items.filter(
        (i): i is ItemView & { calc: LaceSized } => lastBatch.includes(i.id) && !!i.calc && !!i.calc.inches,
      )
    : [];
  const openShop = items.filter((i) => !i.done && i.cat !== 'todo').length;
  const openTodo = items.filter((i) => !i.done && i.cat === 'todo').length;
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const catObj = st.cats.find((c) => c.id === cat) || st.cats[0];
  const [text, setText] = useState('');
  const ph =
    cat === 'laces'
      ? 'e.g. Vans Old Skool white, 8 eyelets, size 10'
      : cat === 'todo'
        ? 'Add a to-do'
        : `Add to ${catObj.name} (add “x2” for quantity)`;
  const trip = st.trip;
  const tabLabel = (v: View, l: string) =>
    v === 'trip' && trip ? (trip.status === 'active' ? 'Trip' : 'Route') : l;
  return (
    <div className="app">
      <header className="hdr">
        <Title />
        <div className="hdr-meta">
          <span>{dateStr}</span>
          <span className="sep">·</span>
          <span>
            {openShop}
            {' to buy'}
          </span>
          {openTodo ? (
            <>
              <span className="sep">·</span>
              <span>
                {openTodo}
                {' to-do'}
                {openTodo === 1 ? '' : 's'}
              </span>
            </>
          ) : null}
          <SyncPill sync={sync} saved={saved} />
        </div>
      </header>
      {view === 'lists' ? (
        <>
          <div className="dock">
            <div className="chips" role="tablist" aria-label="Add to which list">
              {st.cats.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={x.id === cat}
                  className={'chip tone-' + x.tone + (x.id === cat ? ' on' : '')}
                  onClick={() => setCat(x.id)}
                >
                  {x.short}
                </button>
              ))}
            </div>
            <form
              className="add"
              onSubmit={(e) => {
                e.preventDefault();
                const v = text.trim();
                if (!v) return;
                addItem(cat, v);
                setText('');
              }}
            >
              <input
                id="qa-input"
                className="add-in"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ph}
                autoComplete="off"
                enterKeyHint="done"
                aria-label={'Add to ' + catObj.name}
              />
              <button className="add-btn" type="submit" aria-label="Add">
                <Icon d={I.plus} size={20} sw={2.4} />
              </button>
            </form>
            {cat === 'laces' ? (
              <div className="calcmode">
                <span className="lbl inline">Lace math</span>
                <Seg
                  value={st.bulk ? 'bulk' : 'now'}
                  options={[
                    ['now', 'Instant'],
                    ['bulk', 'Bulk'],
                  ]}
                  onChange={(v) =>
                    update((d) => {
                      d.bulk = v === 'bulk';
                    })
                  }
                  label="When to calculate"
                />
                {st.bulk ? (
                  <button
                    type="button"
                    className="btn sun sm"
                    disabled={!queued.length}
                    onClick={() => {
                      setDraft(null);
                      setBatchOpen(true);
                    }}
                  >
                    Calculate all{queued.length ? ` (${queued.length})` : ''}
                  </button>
                ) : (
                  <span className="hint">Asks for anything missing, then sizes it right away.</span>
                )}
              </div>
            ) : null}
          </div>
          {draft ? (
            <LaceWizard
              draft={draft}
              setDraft={setDraft}
              onSave={saveDraft}
              onClose={() => setDraft(null)}
              ai={ai}
              aiImg={aiImg}
              onAiError={onAiError}
            />
          ) : null}
          {batchOpen && queued.length ? (
            <BatchSheet items={queued} onRun={runBatch} onClose={() => setBatchOpen(false)} />
          ) : null}
          {batchRes.length ? (
            <BatchResults
              items={batchRes}
              onClose={() =>
                update((d) => {
                  d.lastBatch = null;
                })
              }
            />
          ) : null}
        </>
      ) : null}
      <nav className="tabs" aria-label="Sections">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={'tab' + (view === v ? ' on' : '')}
            aria-current={view === v ? 'page' : undefined}
            onClick={() => setView(v)}
          >
            {tabLabel(v, l)}
            {v === 'trip' && trip && trip.status === 'active' ? (
              <i className="live" aria-label="live" />
            ) : null}
          </button>
        ))}
      </nav>
      <main key={view} className="view-anim">
        {view === 'lists' ? (
          <>
            {st.cats.map((c) => {
              const list = items.filter((i) => i.cat === c.id);
              if (!list.length) return null;
              const done = list.filter((i) => i.done).length;
              return (
                <section key={c.id} className={'sec tone-' + c.tone} aria-label={c.name}>
                  <div className="sec-h">
                    <i className="sec-dot" aria-hidden="true" />
                    <h2>{c.name}</h2>
                    <span className="count">
                      {list.length - done}
                      {' open'}
                      {done ? ` · ${done} done` : ''}
                    </span>
                    {done ? (
                      <button
                        type="button"
                        className="linkish"
                        onClick={() =>
                          update((d) => {
                            d.items = d.items.filter((x) => !(x.cat === c.id && x.done));
                          })
                        }
                      >
                        Clear done
                      </button>
                    ) : null}
                  </div>
                  <ul className="list">
                    {list.map((it) =>
                      c.id === 'laces' ? (
                        <LaceCard
                          key={it.id}
                          it={it}
                          toast={toast}
                          onToggle={() => toggleItem(it.id)}
                          onEdit={() => editLace(it)}
                          onDelete={() => deleteItem(it.id)}
                        />
                      ) : (
                        <ItemRow
                          key={it.id}
                          it={it}
                          onToggle={() => toggleItem(it.id)}
                          onDelete={() => deleteItem(it.id)}
                        />
                      ),
                    )}
                  </ul>
                </section>
              );
            })}
            {!items.length ? (
              <p className="empty">Nothing on today’s lists yet. Add something above.</p>
            ) : null}
            {(() => {
              const empties = st.cats.filter((c) => !items.some((i) => i.cat === c.id));
              return empties.length ? (
                <p className="empties">
                  <span className="lbl inline">Empty</span>
                  {empties.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="linkish"
                      onClick={() => {
                        setCat(c.id);
                        const el = document.getElementById('qa-input');
                        if (el) {
                          el.focus();
                          window.scrollTo({
                            top: 0,
                            behavior: 'smooth',
                          });
                        }
                      }}
                    >
                      {c.short}
                    </button>
                  ))}
                </p>
              ) : null;
            })()}
            <ShopPanel st={st} update={update} items={items} onFind={() => setView('stores')} />
          </>
        ) : null}
        {view === 'stores' ? (
          <StoresView
            st={st}
            update={update}
            items={items}
            imports={imports}
            setImports={setImports}
            ai={ai}
            onAiError={onAiError}
            toast={toast}
            onPlanned={() => setView('trip')}
            back={() => setView('lists')}
          />
        ) : null}
        {view === 'trip' ? (
          <TripView st={st} update={update} items={items} imports={imports} toast={toast} setView={setView} />
        ) : null}
      </main>
      <footer className="foot">
        <p>
          Lace lengths: Vans box specs measured by 818 Skate, Nike Help Center chart, Slickies, Shoe Lace
          Supply, DoctorLaces. Store list: storelocators.com chain lists (Sep 2026) plus the Vans and Journeys
          store locators. Map spots are approximate; navigation uses the real address.
        </p>
        <p>
          Your lists save to your Claude account when this page can, plus a cookie and local copy on this
          device.
        </p>
      </footer>
      {toastMsg ? (
        <div className="toast" role="status" key={toastMsg.k}>
          {toastMsg.m}
        </div>
      ) : null}
    </div>
  );
}
