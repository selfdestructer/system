import { useMemo, useState } from 'react';
import type { ClaudeSample } from '../claude';
import type { AppState, ItemView, LatLon, Store } from '../types';
import { CHAINS } from '../data/catalog';
import { shoeTitle, sized } from '../calc/laces';
import { fmtMi, hav, nearestTown } from '../lib/geo';
import { storeShort } from '../lib/links';
import { allStores, itemShort, shoppable } from '../lib/stores';
import { candidates, orderStops, suggestPicks } from '../lib/plan';
import { uid } from '../lib/state';
import { Seg } from './controls';
import { RouteMap } from './RouteMap';
import { AddStore, BaseEditor, ImportPanel, StoreCard } from './storesPanels';
import { I, Icon, aiErr, type Toast } from './common';
import type { Update } from './ShopPanel';

export interface StoresViewProps {
  st: AppState;
  update: Update;
  items: ItemView[];
  imports: Store[];
  setImports: (list: Store[]) => void;
  ai: ClaudeSample | null;
  onAiError: (e: unknown) => void;
  toast: Toast;
  onPlanned: () => void;
  back: () => void;
}

interface AiStoreReply {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  items?: unknown[];
  why?: string;
  confidence?: string;
}
type Panel = '' | 'base' | 'add' | 'import';

export function StoresView({
  st,
  update,
  items,
  imports,
  setImports,
  ai,
  onAiError,
  toast,
  onPlanned,
  back,
}: StoresViewProps) {
  const base = st.bases.find((b) => b.id === st.baseId) || st.bases[0];
  const [panel, setPanel] = useState<Panel>('');
  const [pin, setPin] = useState<LatLon | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const shopItems = useMemo(
    () => items.filter((i) => st.shopCats.includes(i.cat) && shoppable(i)),
    [items, st.shopCats],
  );
  const { custom, aiStores, fixes } = st;
  const all = useMemo(
    () => allStores({ custom, aiStores, fixes }, imports),
    [custom, aiStores, fixes, imports],
  );
  const cands = useMemo(
    () => (base ? candidates(all, shopItems, base, st.radius, st.chains) : []),
    [all, shopItems, base, st.radius, st.chains],
  );
  const sugg = useMemo(
    () => (base && shopItems.length && cands.length ? suggestPicks(cands, shopItems, base) : null),
    [cands, shopItems, base],
  );
  const sugIds = new Set(sugg ? sugg.picks.map((s) => s.id) : []);
  const picked = cands.filter((c) => st.picks.includes(c.id));
  const visible = showAll ? cands : cands.slice(0, 10);
  const uncovered = sugg ? shopItems.filter((i) => sugg.uncovered.includes(i.id)) : [];
  const tapping = panel === 'base' || panel === 'add';
  const togglePick = (id: string) =>
    update((d) => {
      d.picks = d.picks.includes(id) ? d.picks.filter((x) => x !== id) : d.picks.concat([id]);
    });
  const useSuggestion = () => {
    if (!sugg) return;
    update((d) => {
      d.picks = sugg.picks.map((s) => s.id);
    });
    toast('Suggested stops picked');
  };
  const plan = () => {
    const stops = orderStops(base, picked);
    update((d) => {
      d.trip = {
        id: uid(),
        status: 'planned',
        baseId: base.id,
        items: shopItems.map((i) => i.id),
        stops: stops.map((s) => ({
          sid: s.id,
          state: 'pending',
          res: {},
        })),
        cur: 0,
        notice: null,
        created: Date.now(),
      };
    });
    onPlanned();
  };
  async function askClaude() {
    if (!ai) return;
    setAiBusy(true);
    const nearTown = nearestTown(base);
    const list = shopItems
      .map((i) => {
        const sc = sized(i.calc);
        const lace =
          i.cat === 'laces' && sc && i.lace
            ? `replacement laces for ${shoeTitle(i.lace)}, ${sc.inches} inch ${sc.typeLabel.split(' · ')[0].toLowerCase()}${i.lace.color ? ', ' + i.lace.color : ''}`
            : null;
        return `${i.id}: ${lace || `${i.cat} — ${i.text}`}`;
      })
      .join('\n');
    const known = cands
      .slice(0, 40)
      .map((s) => storeShort(s) + (s.city ? ' (' + s.city + ')' : ''))
      .join('; ');
    const prompt =
      'You are helping plan an in-person shopping run.\n' +
      `Home base: "${base.label}" at lat ${base.lat.toFixed(4)}, lon ${base.lon.toFixed(4)}${nearTown ? ` (near ${nearTown.town.label})` : ''}. Radius: ${st.radius} miles around that point.\n` +
      `Items (id: description):\n${list}\n` +
      `Stores already listed, skip these: ${known || 'none'}.\n` +
      'Suggest up to 8 other real stores within the radius that likely carry these items (for laces think skate shops, shoe repair, running stores, sporting goods, department stores). Only include places you are confident exist and are open; skip anything you are unsure about.\n' +
      'Reply with only a JSON array: [{"name": "Store name", "address": "street, city, ST ZIP", "lat": 40.1, "lon": -74.9, "items": ["ids of items it likely carries"], "why": "short reason", "confidence": "high" | "medium" | "low"}]';
    try {
      const r = await ai.json<AiStoreReply[] | null>(prompt, {
        modelTier: 'default',
      });
      const arr = Array.isArray(r) ? r : [];
      const ids = new Set(shopItems.map((i) => i.id));
      const got: Store[] = [];
      for (const x of arr) {
        if (!x || !x.name) continue;
        const lat = Number(x.lat);
        const lon = Number(x.lon);
        if (
          !isFinite(lat) ||
          !isFinite(lon) ||
          hav(base, {
            lat,
            lon,
          }) >
            st.radius + 15
        )
          continue;
        const conf = x.confidence === 'high' ? 0.7 : x.confidence === 'medium' ? 0.55 : 0.42;
        const io: Record<string, number> = {};
        (Array.isArray(x.items) ? x.items : []).forEach((v: unknown) => {
          if (ids.has(String(v))) io[String(v)] = conf;
        });
        if (!Object.keys(io).length) continue;
        const parts = String(x.address || '')
          .split(',')
          .map((p) => p.trim());
        const stzip = (parts[2] || '').split(/\s+/);
        got.push({
          id: 'ai-' + uid(),
          chain: '',
          name: String(x.name).slice(0, 60),
          kind: 'other',
          addr: parts[0] || '',
          city: parts[1] || '',
          st: stzip[0] || '',
          zip: stzip[1] || '',
          phone: '',
          lat,
          lon,
          src: 'ai',
          itemOdds: io,
          why: String(x.why || '').slice(0, 120),
        });
      }
      if (!got.length) toast('Claude didn’t find any it was confident about.');
      else {
        update((d) => {
          d.aiStores = got.concat(d.aiStores || []).slice(0, 24);
        });
        toast(`Claude added ${got.length} store${got.length === 1 ? '' : 's'}. Check them before you drive.`);
      }
    } catch (e) {
      toast(aiErr(e));
      onAiError(e);
    } finally {
      setAiBusy(false);
    }
  }
  if (!base) return null;
  const mapDots = cands.slice(0, 80).map((c) =>
    Object.assign({}, c, {
      pk: st.picks.includes(c.id),
    }),
  );
  const pickedOrdered = orderStops(base, picked);
  return (
    <div className="view">
      <div className="vh">
        <button type="button" className="icon-btn" onClick={back} aria-label="Back to lists">
          <Icon d={I.back} />
        </button>
        <div>
          <div className="eyebrow">Find local stock</div>
          <h2 className="vh-t">
            {'Stores near '}
            {base.label}
          </h2>
        </div>
      </div>
      <div className="bases">
        <span className="lbl inline">From</span>
        {st.bases.map((b) => (
          <button
            key={b.id}
            type="button"
            className={'chip tone-mint' + (b.id === st.baseId ? ' on' : '')}
            onClick={() =>
              update((d) => {
                d.baseId = b.id;
              })
            }
          >
            <Icon d={I.home} size={14} />
            {b.label}
            {b.approx ? ' ≈' : ''}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setPanel(panel === 'base' ? '' : 'base')}>
          Edit bases
        </button>
      </div>
      {base.approx && panel !== 'base' ? (
        <p className="note">
          “{base.label}
          {'\u201D is a rough center point. '}
          <button type="button" className="linkish" onClick={() => setPanel('base')}>
            Set your exact spot
          </button>
          {' for better distances.'}
        </p>
      ) : null}
      {panel === 'base' ? (
        <BaseEditor
          st={st}
          update={update}
          pin={pin}
          setPin={setPin}
          toast={toast}
          onClose={() => {
            setPanel('');
            setPin(null);
          }}
        />
      ) : null}
      <div className="ctl">
        <span className="lbl inline">Within</span>
        <Seg
          value={st.radius}
          options={[
            [5, '5 mi'],
            [10, '10 mi'],
            [15, '15 mi'],
            [25, '25 mi'],
          ]}
          onChange={(v) =>
            update((d) => {
              d.radius = v;
            })
          }
          label="Search radius"
        />
      </div>
      <div className="hunt">
        <span className="lbl inline">Hunting</span>
        {shopItems.length ? (
          shopItems.map((i) => (
            <span key={i.id} className="tag">
              {itemShort(i)}
              {i.lace && i.lace.color ? ' · ' + i.lace.color.toLowerCase() : ''}
            </span>
          ))
        ) : (
          <span className="hint">Nothing selected. Go back and pick what you need today.</span>
        )}
        {st.chains.length ? (
          <span className="tag">
            {'Only: '}
            {st.chains.map((k) => CHAINS[k].label).join(', ')}
          </span>
        ) : null}
      </div>
      <RouteMap
        base={base}
        route={pickedOrdered}
        dots={mapDots}
        pin={tapping ? pin : null}
        onTap={tapping ? setPin : null}
        towns={tapping}
      />
      {sugg && sugg.picks.length ? (
        <div className="sugg">
          <div className="sugg-t">
            <b>Best combo:</b> {sugg.picks.map((s) => storeShort(s)).join(' → ')}
          </div>
          <div className="sugg-d">
            {'Covers '}
            {shopItems.length - uncovered.length}
            {' of '}
            {shopItems.length}
            {' \u00B7 about '}
            {fmtMi(sugg.miles)}
            {' mi out and back'}
            {uncovered.length ? (
              <span className="warn">
                {' \u00B7 No good odds nearby for '}
                {uncovered.map(itemShort).join(', ')}
              </span>
            ) : null}
          </div>
          <div className="row gap">
            <button type="button" className="btn sun sm" onClick={useSuggestion}>
              Use these
            </button>
          </div>
        </div>
      ) : null}
      <ul className="stores">
        {visible.map((s) => (
          <StoreCard
            key={s.id}
            s={s}
            items={shopItems}
            picked={st.picks.includes(s.id)}
            suggested={sugIds.has(s.id)}
            onPick={() => togglePick(s.id)}
            toast={toast}
          />
        ))}
      </ul>
      {cands.length > visible.length ? (
        <button type="button" className="btn ghost wide" onClick={() => setShowAll(true)}>
          {'Show all '}
          {cands.length}
          {' stores'}
        </button>
      ) : null}
      {!cands.length && shopItems.length ? (
        <p className="empty">
          {'Nothing within '}
          {st.radius}
          {
            ' mi looks likely for what\u2019s selected. Widen the radius, switch to \u201CAnywhere nearby\u201D, import stores, or add one you know.'
          }
        </p>
      ) : null}
      <p className="fine">
        Odds are a guess from what each kind of store usually carries, not live stock. Tap an odds chip to
        check the store’s site, or call ahead.
      </p>
      <div className="tools">
        {ai ? (
          <button
            type="button"
            className="btn ghost"
            disabled={aiBusy || !shopItems.length}
            onClick={askClaude}
          >
            <Icon d={I.spark} size={16} />
            {aiBusy ? 'Asking Claude…' : 'Ask Claude for more stores'}
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={() => setPanel(panel === 'add' ? '' : 'add')}>
          <Icon d={I.plus} size={16} />
          Add a store
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setPanel(panel === 'import' ? '' : 'import')}
        >
          <Icon d={I.file} size={16} />
          Import stores
        </button>
      </div>
      {panel === 'add' ? (
        <AddStore
          update={update}
          pin={pin}
          toast={toast}
          onClose={() => {
            setPanel('');
            setPin(null);
          }}
        />
      ) : null}
      {panel === 'import' ? (
        <ImportPanel
          st={st}
          imports={imports}
          setImports={setImports}
          toast={toast}
          onClose={() => setPanel('')}
        />
      ) : null}
      <div className="dockbar">
        <button type="button" className="cta" disabled={!picked.length} onClick={plan}>
          <span className="cta-l">Plan route</span>
          <span className="cta-sub">
            {picked.length}
            {' stop'}
            {picked.length === 1 ? '' : 's'}
          </span>
          <Icon d={I.route} />
        </button>
      </div>
    </div>
  );
}
/* ---------------- Trip ---------------- */
