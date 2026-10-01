import { useMemo, useState, type ChangeEvent } from 'react';
import type { AppState, Candidate, CatOdds, ItemView, LatLon, Store } from '../types';
import { CATS0, TOWNS } from '../data/catalog';
import { fmtMi, nearestTown, parseCoords } from '../lib/geo';
import { fullAddr, mapsSearch, stockLink } from '../lib/links';
import { allStores, itemShort, oddLabel, oddTier } from '../lib/stores';
import { finishImport, importRecords } from '../lib/importers';
import { uid } from '../lib/state';
import { Phone } from './controls';
import { I, Icon, copyText, type Toast } from './common';
import type { Update } from './ShopPanel';

export interface StoreCardProps {
  s: Candidate;
  items: ItemView[];
  picked: boolean;
  suggested: boolean;
  onPick: () => void;
  toast: Toast;
}
export interface BaseEditorProps {
  st: AppState;
  update: Update;
  pin: LatLon | null;
  setPin: (p: LatLon | null) => void;
  onClose: () => void;
  toast: Toast;
}
export interface AddStoreProps {
  update: Update;
  pin: LatLon | null;
  toast: Toast;
  onClose: () => void;
}
export interface ImportPanelProps {
  st: AppState;
  imports: Store[];
  setImports: (list: Store[]) => void;
  toast: Toast;
  onClose: () => void;
}

export function StoreCard({ s, items, picked, suggested, onPick, toast }: StoreCardProps) {
  const rel = items.filter((i) => (s.od[i.id] || 0) >= 0.45).sort((a, b) => s.od[b.id] - s.od[a.id]);
  const longs = items.filter((i) => (s.od[i.id] || 0) > 0 && s.od[i.id] < 0.45);
  return (
    <li className={'store' + (picked ? ' picked' : '')}>
      <button
        type="button"
        className="pick"
        onClick={onPick}
        aria-pressed={picked}
        aria-label={(picked ? 'Remove ' : 'Add ') + s.name + (picked ? ' from the route' : ' to the route')}
      >
        <Icon d={picked ? I.check : I.plus} size={18} sw={2.4} />
      </button>
      <div className="store-b">
        <div className="store-n">
          <span>{s.name}</span>
          {suggested ? <span className="badge sun">Suggested</span> : null}
          {s.src === 'ai' ? <span className="badge sky">Claude · verify</span> : null}
          {s.src === 'import' ? <span className="badge">Imported</span> : null}
          {s.src === 'custom' ? <span className="badge mint">Yours</span> : null}
        </div>
        <div className="store-a">
          {fmtMi(s.dist)}
          {' mi \u00B7 '}
          {fullAddr(s) || 'no street address'}
        </div>
        {s.why ? <div className="store-w">{s.why}</div> : null}
        <div className="odds">
          {rel.map((i) => (
            <a
              key={i.id}
              className={'odd ' + oddTier(s.od[i.id])}
              href={stockLink(s, i)}
              target="_blank"
              rel="noopener noreferrer"
              title="Check stock on the store’s site"
            >
              {itemShort(i)}
              {' \u00B7 '}
              {oddLabel(s.od[i.id])}
            </a>
          ))}
        </div>
        {longs.length ? (
          <div className="long-l">
            {'Long shot here: '}
            {longs.map(itemShort).join(', ')}
          </div>
        ) : null}
        <div className="store-l">
          <a href={mapsSearch(s)} target="_blank" rel="noopener noreferrer">
            <Icon d={I.pin} size={14} />
            Maps
          </a>
          {s.phone ? <Phone num={s.phone} toast={toast} /> : null}
        </div>
      </div>
    </li>
  );
}
export function BaseEditor({ st, update, pin, setPin, onClose, toast }: BaseEditorProps) {
  const [id, setId] = useState(st.baseId);
  const b = st.bases.find((x) => x.id === id) || st.bases[0];
  const [label, setLabel] = useState(b ? b.label : '');
  const [q, setQ] = useState('');
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState('');
  const selectBase = (bid: string, lbl?: string) => {
    setId(bid);
    const bb = st.bases.find((x) => x.id === bid);
    setLabel(lbl ?? (bb ? bb.label : ''));
    setPin(null);
    setPaste('');
    setErr('');
  };
  const matches =
    q.trim().length >= 2
      ? TOWNS.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
      : [];
  const onPaste = (v: string) => {
    setPaste(v);
    const c = parseCoords(v);
    if (c) {
      setPin(c);
      setErr('');
    } else
      setErr(
        v.trim()
          ? 'No coordinates in that. Paste something like 40.15512, -74.82881 or a Google Maps link to a dropped pin.'
          : '',
      );
  };
  const save = () => {
    update((d) => {
      const x = d.bases.find((z) => z.id === id);
      if (!x) return;
      if (pin) {
        x.lat = pin.lat;
        x.lon = pin.lon;
        x.approx = false;
      }
      x.label = label.trim() || x.label;
      d.baseId = id;
    });
    toast('Home base saved');
    onClose();
  };
  const addNew = () => {
    const nid = 'base-' + uid();
    update((d) => {
      d.bases.push({
        id: nid,
        label: 'New base',
        lat: b.lat,
        lon: b.lon,
        approx: true,
      });
    });
    selectBase(nid, 'New base');
  };
  const remove = () => {
    if (st.bases.length <= 1) return;
    const other = st.bases.find((z) => z.id !== id);
    if (!other) return;
    update((d) => {
      d.bases = d.bases.filter((z) => z.id !== id);
      if (d.baseId === id) d.baseId = other.id;
    });
    selectBase(other.id);
  };
  const near = pin ? nearestTown(pin) : null;
  return (
    <div className="panel" aria-label="Home bases">
      <div className="panel-h">
        <h3>Home bases</h3>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close">
          <Icon d={I.x} size={16} />
        </button>
      </div>
      <div className="chips">
        {st.bases.map((x) => (
          <button
            key={x.id}
            type="button"
            className={'chip tone-mint' + (x.id === id ? ' on' : '')}
            onClick={() => selectBase(x.id)}
          >
            {x.label}
            {x.approx ? ' ≈' : ''}
          </button>
        ))}
        <button type="button" className="chip" onClick={addNew}>
          <Icon d={I.plus} size={14} />
          Add base
        </button>
      </div>
      <label className="fld">
        <span>Name</span>
        <input id="be-label" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="fld">
        <span>Town or neighborhood</span>
        <input
          id="be-town"
          value={q}
          placeholder="Levittown, Somerton, Bensalem…"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {matches.length ? (
        <div className="chips">
          {matches.map((t) => (
            <button
              key={t.label}
              type="button"
              className="chip"
              onClick={() => {
                setPin({
                  lat: t.lat,
                  lon: t.lon,
                });
                if (b && b.approx) setLabel(t.label.replace(/, (PA|NJ)$/, '').replace(' (Phila)', ''));
                setQ('');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <label className="fld">
        <span>
          {'Exact spot '}
          <em>coordinates or a Google Maps pin link</em>
        </span>
        <input
          id="be-paste"
          value={paste}
          placeholder="40.15512, -74.82881"
          onChange={(e) => onPaste(e.target.value)}
        />
      </label>
      {err ? <p className="err">{err}</p> : null}
      <p className="hint">
        In Google Maps, long-press your place, tap the coordinates that pop up to copy them, then paste here.
        Or tap the map.
      </p>
      {pin ? (
        <p className="ok-line">
          {'Pin: '}
          {pin.lat.toFixed(5)}
          {', '}
          {pin.lon.toFixed(5)}
          {near ? ` · ${fmtMi(near.mi)} mi from ${near.town.label}` : ''}
        </p>
      ) : null}
      <div className="row gap">
        <button type="button" className="btn sun" onClick={save}>
          Save base
        </button>
        {st.bases.length > 1 ? (
          <button type="button" className="btn ghost danger" onClick={remove}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function AddStore({ update, pin, toast, onClose }: AddStoreProps) {
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [where, setWhere] = useState('');
  const [cats, setCats] = useState(['laces']);
  const [err, setErr] = useState('');
  const coords = parseCoords(where) || pin;
  const save = () => {
    if (!name.trim()) {
      setErr('Give it a name.');
      return;
    }
    if (!coords) {
      setErr('Paste coordinates or a Google Maps pin link, or tap the map, so it can go on a route.');
      return;
    }
    const c: CatOdds = {};
    cats.forEach((k) => {
      c[k] = 0.7;
    });
    update((d) => {
      d.custom.push({
        id: 'my-' + uid(),
        chain: '',
        name: name.trim(),
        kind: 'custom',
        addr: addr.trim(),
        city: '',
        st: '',
        zip: '',
        phone: '',
        lat: coords.lat,
        lon: coords.lon,
        src: 'custom',
        cats: c,
      });
    });
    toast('Store added');
    onClose();
  };
  return (
    <div className="panel" aria-label="Add a store">
      <div className="panel-h">
        <h3>Add a store</h3>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close">
          <Icon d={I.x} size={16} />
        </button>
      </div>
      <label className="fld">
        <span>Name</span>
        <input
          id="as-name"
          value={name}
          placeholder="e.g. Joe’s Shoe Repair"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="fld">
        <span>
          {'Street address '}
          <em>optional, used for navigation</em>
        </span>
        <input
          id="as-addr"
          value={addr}
          placeholder="123 Main St, Levittown, PA"
          onChange={(e) => setAddr(e.target.value)}
        />
      </label>
      <label className="fld">
        <span>
          {'Location '}
          <em>coordinates or Maps pin link</em>
        </span>
        <input
          id="as-where"
          value={where}
          placeholder="40.1551, -74.8288"
          onChange={(e) => setWhere(e.target.value)}
        />
      </label>
      {coords ? (
        <p className="ok-line">
          {'Location set: '}
          {coords.lat.toFixed(5)}
          {', '}
          {coords.lon.toFixed(5)}
        </p>
      ) : null}
      <div className="fld">
        <span>Carries</span>
        <div className="chips">
          {CATS0.filter((c) => c.shop).map((c) => {
            const on = cats.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={'chip sm tone-' + c.tone + (on ? ' on' : '')}
                aria-pressed={on}
                onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : cats.concat([c.id]))}
              >
                {c.short}
              </button>
            );
          })}
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="row gap">
        <button type="button" className="btn sun" onClick={save}>
          Add store
        </button>
      </div>
    </div>
  );
}
export function ImportPanel({ st, imports, setImports, toast, onClose }: ImportPanelProps) {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const bbox = useMemo(() => {
    let s = 90,
      n = -90,
      w = 180,
      e = -180;
    for (const b of st.bases) {
      s = Math.min(s, b.lat - 0.13);
      n = Math.max(n, b.lat + 0.13);
      w = Math.min(w, b.lon - 0.17);
      e = Math.max(e, b.lon + 0.17);
    }
    return [s, w, n, e].map((v) => v.toFixed(3)).join(',');
  }, [st.bases]);
  const q = `[out:json][timeout:120];(nwr["shop"~"^(shoes|shoe_repair|sports|outdoor|department_store|variety_store|supermarket|hardware|doityourself|car_parts|pet|convenience)$"](${bbox});nwr["amenity"="pharmacy"](${bbox});nwr["craft"="shoemaker"](${bbox}););out center tags;`;
  const cmd = `curl -sG https://overpass-api.de/api/interpreter --data-urlencode 'data=${q}' -o ~/storage/downloads/stores.json`;
  const handleText = (text: string) => {
    const recs = importRecords(text);
    if (!recs.length) {
      setMsg('No stores found in that. It should be Overpass JSON, GeoJSON, or All The Places NDJSON.');
      return;
    }
    const universe = allStores({ custom: st.custom, aiStores: st.aiStores, fixes: st.fixes }, []);
    const next = finishImport(recs, st.bases, imports, universe);
    const added = next.length - imports.length;
    setImports(next);
    setMsg(
      `Imported ${added} new store${added === 1 ? '' : 's'} within 40 mi of your bases (${next.length} total).`,
    );
    toast(`${added} stores imported`);
  };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setBusy(true);
    setMsg('Reading ' + f.name + '…');
    try {
      let text: string;
      if (/\.gz$/i.test(f.name) && typeof DecompressionStream === 'function') {
        text = await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
      } else text = await f.text();
      handleText(text);
    } catch (err) {
      setMsg('Couldn’t read that file: ' + ((err as Error | null)?.message || 'unknown error'));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };
  return (
    <div className="panel" aria-label="Import stores">
      <div className="panel-h">
        <h3>Import stores</h3>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close">
          <Icon d={I.x} size={16} />
        </button>
      </div>
      <p className="hint">
        Free open data works here: an OpenStreetMap Overpass export, or an All The Places file
        (github.com/alltheplaces/alltheplaces). Stores within 40 miles of your bases are kept, up to 1,500.
      </p>
      <div className="step-h">
        {'1 \u00B7 In Termux, run '}
        <em>(once first: termux-setup-storage)</em>
      </div>
      <pre className="code">{cmd}</pre>
      <div className="row gap">
        <button type="button" className="btn ghost sm" onClick={() => copyText(cmd, toast, 'Command copied')}>
          <Icon d={I.copy} size={15} />
          Copy command
        </button>
        <button type="button" className="btn ghost sm" onClick={() => copyText(q, toast, 'Query copied')}>
          Copy query only
        </button>
      </div>
      <div className="step-h">2 · Pick the file</div>
      <label className="btn sun file">
        <Icon d={I.file} size={16} />
        {busy ? 'Importing…' : 'Choose stores.json'}
        <input
          id="imp-file"
          className="sr-file"
          type="file"
          accept=".json,.geojson,.ndjson,.gz,.txt,application/json"
          onChange={onFile}
        />
      </label>
      <details className="paste">
        <summary>Or paste JSON</summary>
        <textarea
          id="imp-paste"
          value={txt}
          rows={4}
          placeholder={'{"elements": [ \u2026 ]}'}
          onChange={(e) => setTxt(e.target.value)}
        />
        <button type="button" className="btn ghost sm" onClick={() => handleText(txt)}>
          Import pasted
        </button>
      </details>
      {msg ? <p className="ok-line">{msg}</p> : null}
      {imports.length ? (
        <div className="row gap">
          <span className="hint">
            {imports.length}
            {' imported stores saved'}
          </span>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setImports([]);
              toast('Imports cleared');
            }}
          >
            Clear imports
          </button>
        </div>
      ) : null}
    </div>
  );
}
