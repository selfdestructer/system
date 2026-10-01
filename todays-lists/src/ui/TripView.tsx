import { useMemo } from 'react';
import type {
  AppState,
  DetourOption,
  FindResult,
  ItemView,
  Notice as NoticeT,
  Store,
  StoreIndex,
  StoreWithCats,
  Trip,
  View,
} from '../types';
import { driveMin, fmtMi, roadMi } from '../lib/geo';
import { amazonLink, fullAddr, fullRouteLink, navHome, navTo, storeShort } from '../lib/links';
import { itemOdds, itemShort, oddLabel, storeIndex } from '../lib/stores';
import {
  bestInsertion,
  lookFor,
  pendingSeq,
  planAssign,
  rerouteFor,
  tripLegs,
  type LookRow,
} from '../lib/plan';
import { Phone } from './controls';
import { sized } from '../calc/laces';
import { RouteMap } from './RouteMap';
import { I, Icon, type Toast } from './common';
import type { Update } from './ShopPanel';

type TripStore = StoreWithCats & { added?: boolean };
const GONE: StoreWithCats = {
  id: '',
  chain: '',
  name: '',
  kind: 'other',
  addr: '',
  city: '',
  st: '',
  zip: '',
  phone: '',
  lat: 0,
  lon: 0,
  src: 'seed',
  cats: {},
};

export interface NoticeProps {
  n: NoticeT | null;
  sm: StoreIndex;
  items: ItemView[];
  onUndo: () => void;
  onAdd: (o: DetourOption) => void;
  onDismiss: () => void;
}
export interface TripViewProps {
  st: AppState;
  update: Update;
  items: ItemView[];
  imports: Store[];
  toast: Toast;
  setView: (v: View) => void;
}

export function Notice({ n, sm, items, onUndo, onAdd, onDismiss }: NoticeProps) {
  if (!n) return null;
  const s = 'sid' in n ? sm[n.sid] : null;
  const itemId = 'itemId' in n ? n.itemId : undefined;
  const it = itemId ? items.find((i) => i.id === itemId) : null;
  return (
    <div className={'notice ' + n.kind} role="status">
      <p>{n.msg}</p>
      {n.kind === 'inserted' && s ? (
        <div className="row gap">
          {n.next ? (
            <a className="btn sun" href={navTo(s)} target="_blank" rel="noopener noreferrer">
              <Icon d={I.nav} size={16} />
              Navigate there
            </a>
          ) : null}
          <button type="button" className="btn ghost" onClick={onUndo}>
            Undo
          </button>
        </div>
      ) : null}
      {n.kind === 'options' ? (
        <ul className="opts">
          {n.options.map((o) => {
            const so = sm[o.sid];
            if (!so) return null;
            return (
              <li key={o.sid}>
                <div>
                  <b>{so.name}</b>
                  <span>
                    +{fmtMi(Math.max(o.add, 0))}
                    {' mi \u00B7 ~'}
                    {driveMin(Math.max(o.add, 0.1))}
                    {' min detour \u00B7 '}
                    {oddLabel(o.o)}
                  </span>
                </div>
                <button type="button" className="btn ghost sm" onClick={() => onAdd(o)}>
                  Add
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {(n.kind === 'none' || n.kind === 'options') && it ? (
        <a className="linkish" href={amazonLink(it)} target="_blank" rel="noopener noreferrer">
          Or buy it online
        </a>
      ) : null}
      <button type="button" className="icon-btn xs dismiss" onClick={onDismiss} aria-label="Dismiss">
        <Icon d={I.x} size={13} />
      </button>
    </div>
  );
}
export function TripView({ st, update, items, imports, toast, setView }: TripViewProps) {
  const trip = st.trip;
  const { custom, aiStores, fixes } = st;
  const sm = useMemo(
    () => storeIndex({ custom, aiStores, fixes }, imports),
    [custom, aiStores, fixes, imports],
  );
  const allList = useMemo(() => Object.values(sm), [sm]);
  if (!trip) {
    return (
      <div className="view">
        <div className="vh">
          <div>
            <div className="eyebrow">Trip</div>
            <h2 className="vh-t">No route yet</h2>
          </div>
        </div>
        <p className="empty">
          Pick what you need on Lists, tap Find local stock, choose stores, then plan the route.
        </p>
        <button type="button" className="btn sun" onClick={() => setView('stores')}>
          Find local stock
        </button>
      </div>
    );
  }
  const base = st.bases.find((b) => b.id === trip.baseId) || st.bases[0];
  const rows = trip.stops.map((x, i) => ({
    x,
    i,
    s: sm[x.sid],
  }));
  const stores: TripStore[] = rows.map((r) =>
    r.s
      ? { ...r.s, added: r.x.added }
      : { ...GONE, id: 'gone' + r.i, name: 'Removed store', lat: base.lat, lon: base.lon, added: false },
  );
  const states = rows.map((r) => r.x.state);
  const tripItems = items.filter((i) => trip.items.includes(i.id));
  const withTrip = (fn: (d: AppState, t: Trip) => void) =>
    update((d) => {
      if (d.trip) fn(d, d.trip);
    });
  const advance = (d: AppState, t: Trip) => {
    let j = t.cur + 1;
    const skipped: string[] = [];
    while (j < t.stops.length) {
      if (t.stops[j].state !== 'pending') {
        j++;
        continue;
      }
      const sj = sm[t.stops[j].sid];
      const open = tripItems.filter((i) => {
        const di = d.items.find((z) => z.id === i.id);
        return di && !di.done;
      });
      if (sj && open.some((i) => itemOdds(sj, i) >= 0.4)) break;
      t.stops[j].state = 'skipped';
      skipped.push(sj ? storeShort(sj) : 'a removed store');
      j++;
    }
    t.cur = j;
    t.notice = skipped.length
      ? {
          kind: 'skipped',
          msg: `Skipped ${skipped.join(', ')}. Nothing left to find there.`,
        }
      : t.notice && t.notice.kind === 'inserted' && t.notice.at === j
        ? t.notice
        : null;
  };
  const start = () =>
    withTrip((_d, t) => {
      t.status = 'active';
      t.cur = 0;
      t.started = Date.now();
    });
  const arrive = () =>
    withTrip((_d, t) => {
      t.stops[t.cur].state = 'here';
    });
  const mark = (it: ItemView, r: FindResult) =>
    withTrip((d, t) => {
      const stp = t.stops[t.cur];
      stp.res = stp.res || {};
      stp.res[it.id] = r;
      const di = d.items.find((x) => x.id === it.id);
      const s = sm[stp.sid];
      if (r === 'found') {
        if (di) {
          di.done = true;
          di.foundAt = s ? storeShort(s) : 'store';
        }
        if (t.notice && 'itemId' in t.notice && t.notice.itemId === it.id) t.notice = null;
      } else {
        if (di) di.missedAt = (di.missedAt || []).concat([s ? storeShort(s) : 'store']).slice(-4);
        rerouteFor({ bases: d.bases, radius: d.radius, trip: t }, it, sm, allList);
      }
    });
  const unmark = (it: ItemView) =>
    withTrip((d, t) => {
      const stp = t.stops[t.cur];
      if (stp.res) delete stp.res[it.id];
      const di = d.items.find((x) => x.id === it.id);
      if (di) {
        di.done = false;
        delete di.foundAt;
      }
    });
  const leave = () =>
    withTrip((d, t) => {
      t.stops[t.cur].state = 'done';
      advance(d, t);
    });
  const skip = () =>
    withTrip((d, t) => {
      t.stops[t.cur].state = 'skipped';
      advance(d, t);
    });
  const undoInsert = () =>
    withTrip((_d, t) => {
      const n = t.notice;
      if (
        n &&
        n.kind === 'inserted' &&
        t.stops[n.at] &&
        t.stops[n.at].sid === n.sid &&
        t.stops[n.at].state === 'pending'
      )
        t.stops.splice(n.at, 1);
      t.notice = null;
    });
  const addOpt = (o: DetourOption) =>
    withTrip((_d, t) => {
      const { idx, pts } = pendingSeq(t, base, sm);
      const s = sm[o.sid];
      if (!s) return;
      const ins = bestInsertion(pts, s);
      const at = ins.pos < idx.length ? idx[ins.pos] : t.stops.length;
      t.stops.splice(at, 0, {
        sid: o.sid,
        state: 'pending',
        res: {},
        added: true,
        forItem: t.notice && 'itemId' in t.notice ? t.notice.itemId : undefined,
      });
      t.notice = {
        kind: 'inserted',
        itemId: t.notice && 'itemId' in t.notice ? t.notice.itemId : undefined,
        sid: o.sid,
        at,
        next: at === t.cur + 1,
        msg:
          `Added ${s.name} (+${fmtMi(Math.max(ins.add, 0))} mi).` +
          (at === t.cur + 1 ? ' It’s your next stop.' : ''),
      };
    });
  const dismiss = () =>
    withTrip((_d, t) => {
      t.notice = null;
    });
  const finish = () =>
    withTrip((_d, t) => {
      t.status = 'done';
      t.ended = Date.now();
    });
  const close = () => {
    update((d) => {
      d.trip = null;
      d.picks = [];
    });
    setView('lists');
  };
  if (trip.status === 'planned') {
    const legs = tripLegs(base, stores);
    const total = legs.reduce((a, l) => a + l.mi, 0),
      mins = legs.reduce((a, l) => a + l.min, 0);
    const assigned = planAssign(trip, items, sm);
    return (
      <div className="view">
        <div className="vh">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView('stores')}
            aria-label="Back to stores"
          >
            <Icon d={I.back} />
          </button>
          <div>
            <div className="eyebrow">Route plan · shortest loop</div>
            <h2 className="vh-t">
              {'Out and back from '}
              {base.label}
            </h2>
          </div>
        </div>
        <div className="stats">
          <div>
            <b>{stores.length}</b>
            <span>stop{stores.length === 1 ? '' : 's'}</span>
          </div>
          <div>
            <b>{fmtMi(total)}</b>
            <span>miles, est.</span>
          </div>
          <div>
            <b>{mins}</b>
            <span>min driving</span>
          </div>
        </div>
        <RouteMap base={base} route={stores} states={states} cur={-1} />
        <ol className="legs">
          <li className="leg home">
            <span className="leg-i">
              <Icon d={I.home} size={16} />
            </span>
            <div>
              <b>
                {'Leave '}
                {base.label}
              </b>
            </div>
          </li>
          {legs.map((l, i) =>
            l.to ? (
              <li key={i} className="leg">
                <span className="leg-n">{i + 1}</span>
                <div>
                  <b>{l.to.name}</b>
                  <span className="leg-d">
                    {fmtMi(l.mi)}
                    {' mi \u00B7 ~'}
                    {l.min}
                    {' min'}
                    {l.to.addr ? ' · ' + l.to.addr : ''}
                  </span>
                  {assigned[i] && assigned[i].length ? (
                    <div className="tags">
                      {assigned[i].map((it) => (
                        <span className="tag" key={it.id}>
                          {itemShort(it)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="leg-d">Backup stop</div>
                  )}
                </div>
              </li>
            ) : (
              <li key={i} className="leg home">
                <span className="leg-i">
                  <Icon d={I.home} size={16} />
                </span>
                <div>
                  <b>
                    {'Back to '}
                    {base.label}
                  </b>
                  <span className="leg-d">
                    {fmtMi(l.mi)}
                    {' mi \u00B7 ~'}
                    {l.min}
                    {' min'}
                  </span>
                </div>
              </li>
            ),
          )}
        </ol>
        <p className="fine">
          Stop order is the shortest loop by distance. Miles are straight-line × 1.3 for roads; Google Maps
          gives live times when you navigate.
        </p>
        <div className="row gap wrap">
          <button type="button" className="btn ghost" onClick={() => setView('stores')}>
            Change stores
          </button>
          <a
            className="btn ghost"
            href={fullRouteLink(base, stores)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Whole loop in Maps
            <Icon d={I.ext} size={14} />
          </a>
        </div>
        <div className="dockbar">
          <a
            className="cta"
            href={stores[0] ? navTo(stores[0]) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={start}
          >
            <span className="cta-l">Start trip</span>
            <span className="cta-sub">
              {'to '}
              {stores[0] ? storeShort(stores[0]) : 'first stop'}
            </span>
            <Icon d={I.nav} />
          </a>
        </div>
      </div>
    );
  }
  if (trip.status === 'done') {
    const got = tripItems.filter((i) => i.done),
      miss = tripItems.filter((i) => !i.done);
    return (
      <div className="view">
        <div className="vh">
          <div>
            <div className="eyebrow">Trip wrapped</div>
            <h2 className="vh-t">
              {got.length}
              {' of '}
              {tripItems.length}
              {' found'}
            </h2>
          </div>
        </div>
        {got.length ? (
          <ul className="sumlist">
            {got.map((i) => (
              <li key={i.id} className="ok">
                <Icon d={I.check} size={16} sw={2.6} />
                {itemShort(i)}
                <span>{i.foundAt}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {miss.length ? (
          <>
            <h3 className="sub-h">Still on your list</h3>
            <ul className="sumlist">
              {miss.map((i) => (
                <li key={i.id} className="miss">
                  <Icon d={I.x} size={16} sw={2.6} />
                  {itemShort(i)}
                  <a className="linkish" href={amazonLink(i)} target="_blank" rel="noopener noreferrer">
                    Buy online
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="row gap">
          <button type="button" className="btn sun" onClick={close}>
            Close trip
          </button>
        </div>
      </div>
    );
  }
  // active
  const idx = trip.cur;
  if (idx >= trip.stops.length) {
    const got = tripItems.filter((i) => i.done).length;
    return (
      <div className="view">
        <div className="vh">
          <div>
            <div className="eyebrow">All stops done</div>
            <h2 className="vh-t">Head home</h2>
          </div>
        </div>
        <RouteMap base={base} route={stores} states={states} cur={trip.stops.length} />
        {trip.notice ? (
          <Notice
            n={trip.notice}
            sm={sm}
            items={items}
            onUndo={undoInsert}
            onAdd={addOpt}
            onDismiss={dismiss}
          />
        ) : null}
        <p className="note">
          {got}
          {' of '}
          {tripItems.length}
          {' found. '}
          {tripItems.length - got ? 'The rest stay on your list.' : 'Everything’s crossed off.'}
        </p>
        <div className="row gap wrap">
          <a className="btn sun big" href={navHome(base)} target="_blank" rel="noopener noreferrer">
            <Icon d={I.home} size={18} />
            Navigate home
          </a>
          <button type="button" className="btn ghost big" onClick={finish}>
            Finish trip
          </button>
        </div>
      </div>
    );
  }
  const stop = trip.stops[idx];
  const s = sm[stop.sid];
  const prevPt: StoreWithCats | null = (() => {
    for (let j = idx - 1; j >= 0; j--)
      if (trip.stops[j].state === 'done' && sm[trip.stops[j].sid]) return sm[trip.stops[j].sid];
    return null;
  })();
  const legMi = s ? roadMi(prevPt || base, s) : 0;
  const lf = s
    ? lookFor(trip, idx, items, sm)
    : {
        primary: [],
        also: [],
      };
  const nextIdx = (() => {
    for (let j = idx + 1; j < trip.stops.length; j++) if (trip.stops[j].state === 'pending') return j;
    return -1;
  })();
  const renderRow = ({ it, r }: LookRow) => (
    <li key={it.id} className={'find' + (r ? ' ' + r : '')}>
      <div className="find-t">
        <b>{itemShort(it)}</b>
        <span>
          {it.cat === 'laces' && sized(it.calc)
            ? `${sized(it.calc)?.typeLabel.split(' · ')[0]}${it.lace && it.lace.color ? ' · ' + it.lace.color : ''}`
            : (st.cats.find((c) => c.id === it.cat) || {}).name}
        </span>
      </div>
      <div className="fb">
        {r === 'found' ? (
          <button type="button" className="btn found sm" onClick={() => unmark(it)}>
            <Icon d={I.check} size={15} sw={2.6} />
            Got it
          </button>
        ) : r === 'missing' ? (
          <span className="miss-l">Not here</span>
        ) : (
          <>
            <button type="button" className="btn found sm" onClick={() => mark(it, 'found')}>
              Got it
            </button>
            <button type="button" className="btn missing sm" onClick={() => mark(it, 'missing')}>
              Not here
            </button>
          </>
        )}
      </div>
    </li>
  );
  return (
    <div className="view">
      <div className="vh">
        <div>
          <div className="eyebrow">
            {'Stop '}
            {idx + 1}
            {' of '}
            {trip.stops.length}
            {stop.added ? ' · added on the way' : ''}
          </div>
          <h2 className="vh-t">{s ? s.name : 'Removed store'}</h2>
        </div>
      </div>
      <RouteMap base={base} route={stores} states={states} cur={idx} />
      {trip.notice ? (
        <Notice
          n={trip.notice}
          sm={sm}
          items={items}
          onUndo={undoInsert}
          onAdd={addOpt}
          onDismiss={dismiss}
        />
      ) : null}
      <div className="now">
        {s ? (
          <div className="now-a">
            {fullAddr(s)}
            {' \u00B7 '}
            {fmtMi(legMi)}
            {' mi from '}
            {prevPt ? storeShort(prevPt) : base.label}
          </div>
        ) : null}
        {stop.state === 'pending' ? (
          <div className="row gap">
            {s ? (
              <a className="btn sun big" href={navTo(s)} target="_blank" rel="noopener noreferrer">
                <Icon d={I.nav} size={18} />
                Navigate
              </a>
            ) : null}
            <button type="button" className="btn mint big" onClick={arrive}>
              I’m here
            </button>
          </div>
        ) : (
          <>
            <h3 className="ask">Did you find it?</h3>
            {lf.primary.length ? (
              <ul className="finds">{lf.primary.map(renderRow)}</ul>
            ) : (
              <p className="hint">Nothing planned for this stop anymore.</p>
            )}
            {lf.also.length ? (
              <>
                <h4 className="ask2">Worth a look while you’re here</h4>
                <ul className="finds">{lf.also.map(renderRow)}</ul>
              </>
            ) : null}
            <button type="button" className="btn sun big" onClick={leave}>
              {nextIdx >= 0 ? 'Next stop' : 'Done, head home'}
              <Icon d={I.chev} size={18} />
            </button>
          </>
        )}
        <div className="row gap sm">
          {s && s.phone ? <Phone num={s.phone} toast={toast} /> : null}
          <button type="button" className="linkish" onClick={skip}>
            Skip this stop
          </button>
        </div>
      </div>
      <ol className="timeline">
        {rows.map(({ x, i, s: si }) => (
          <li key={i} className={'tl ' + x.state + (i === idx ? ' cur' : '')}>
            <span className="tl-n">{i + 1}</span>
            <span className="tl-t">
              {si ? si.name : 'Removed store'}
              {x.added ? <em>{' \u00B7 added'}</em> : null}
            </span>
            <span className="tl-s">
              {x.state === 'done'
                ? 'Done'
                : x.state === 'skipped'
                  ? 'Skipped'
                  : x.state === 'here'
                    ? 'Here now'
                    : i === idx
                      ? 'Next'
                      : ''}
            </span>
          </li>
        ))}
      </ol>
      <div className="row gap">
        <button type="button" className="btn ghost danger" onClick={finish}>
          End trip
        </button>
      </div>
    </div>
  );
}
/* ---------------- App ---------------- */
