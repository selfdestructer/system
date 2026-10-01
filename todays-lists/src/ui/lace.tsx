import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ClaudeSample } from '../claude';
import type { BowKey, ItemView, LaceSized, LaceSpec, LaceType, LacingStyle, SizeSystem } from '../types';
import { batchSpecs, calcLace, cap1, modelOf, parseLace, shoeTitle, sizeMens, sized } from '../calc/laces';
import { BOWS, COLORS, MODELS, STYLES, TYPES } from '../calc/laces/data';
import { Chips, EyeletDots, LaceResult, Seg } from './controls';
import { I, Icon, aiErr } from './common';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** A lace entry being filled in before it lands on the list. */
export interface LaceDraft {
  text: string;
  spec: LaceSpec;
  editId?: string;
}

export interface LaceWizardProps {
  draft: LaceDraft;
  setDraft: (d: LaceDraft) => void;
  onSave: () => void;
  onClose: () => void;
  ai: ClaudeSample | null;
  aiImg: boolean;
  onAiError: (e: unknown) => void;
}

interface LookupReply {
  eyeletPairs?: number | null;
  stockLaceInches?: number | null;
  laceType?: string | null;
  note?: string;
  confidence?: string;
}
interface PhotoReply {
  brand?: string | null;
  model?: string | null;
  eyeletPairs?: number | null;
  shoeColor?: string | null;
  laceColor?: string | null;
  laceType?: string | null;
  confidence?: string;
}
const asLaceType = (v: unknown): LaceType | null =>
  typeof v === 'string' && v in TYPES ? (v as LaceType) : null;

export function LaceWizard({ draft, setDraft, onSave, onClose, ai, aiImg, onAiError }: LaceWizardProps) {
  const spec = draft.spec;
  const calc = useMemo(() => calcLace(spec), [spec]);
  const m = modelOf(spec.modelKey);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<LaceSpec>) =>
    setDraft(
      Object.assign({}, draft, {
        spec: Object.assign({}, spec, patch),
      }),
    );
  const sizeM = spec.size ? (spec.sizeSys === 'W' ? spec.size - 1.5 : spec.size) : null;
  const guess = m && !m.noLaces ? m.pairs(sizeM) : spec.aiPairs || 0;
  const pairs = spec.eyelets || guess || 0;
  const missing = [];
  if (!pairs) missing.push('eyelet pairs');
  if (!spec.color) missing.push('lace color');
  if (!spec.size && !m) missing.push('shoe size');
  async function lookup() {
    if (!ai) return;
    setBusy('lookup');
    setNote('Asking Claude about this shoe…');
    try {
      const name = shoeTitle(spec);
      const r = await ai.json<LookupReply | null>(
        `Someone wants replacement laces for this shoe: "${name}"${spec.size ? ` (US ${spec.sizeSys === 'W' ? 'women’s' : 'men’s'} ${spec.size})` : ''}.\n` +
          'Reply with only JSON: {"eyeletPairs": number or null, "stockLaceInches": number or null, "laceType": "flat" | "oval" | "round" | "fat" | null, "note": "one short sentence", "confidence": "high" | "medium" | "low"}.\n' +
          'eyeletPairs = lace holes per side on the standard version. stockLaceInches = length of the laces it ships with. Use null for anything you are not sure of.',
        {
          modelTier: 'quick',
        },
      );
      const ep = Number(r?.eyeletPairs);
      const p = ep > 0 && ep < 15 ? Math.round(ep) : null;
      const sl = Number(r?.stockLaceInches);
      const len = sl >= 18 && sl <= 100 ? Math.round(sl) : null;
      const patch: Partial<LaceSpec> = {};
      if (p) {
        patch.aiPairs = p;
        if (!spec.eyelets) patch.eyelets = p;
      }
      if (len) patch.aiStock = len;
      const lt = asLaceType(r?.laceType);
      if (lt && !spec.laceType) patch.laceType = lt;
      set(patch);
      setNote(
        `Claude (${(r && r.confidence) || 'unsure'}): ${p ? p + ' eyelet pairs' : 'eyelet count unknown'}${len ? ', ships with ' + len + '″ laces' : ''}. ${(r && r.note) || ''}`,
      );
    } catch (e) {
      setNote(aiErr(e));
      onAiError(e);
    } finally {
      setBusy('');
    }
  }
  async function photo(file: File | null | undefined) {
    if (!file || !ai) return;
    setBusy('photo');
    setNote('Looking at your photo…');
    try {
      const r = await ai.json<PhotoReply | null>(
        'The photo shows a shoe. Identify the brand and model if you can, and count the eyelet pairs (lace holes per side, including any hidden top eyelet). ' +
          'Reply with only JSON: {"brand": string or null, "model": string or null, "eyeletPairs": number or null, "shoeColor": string or null, "laceColor": string or null, "laceType": "flat" | "oval" | "round" | "fat" | null, "confidence": "high" | "medium" | "low"}.',
        {
          images: file,
          modelTier: 'default',
        },
      );
      const text = [r && r.brand, r && r.model].filter(Boolean).join(' ');
      const parsed: LaceSpec = text ? parseLace(text) : {};
      const patch: Partial<LaceSpec> = {};
      if (parsed.modelKey) {
        patch.modelKey = parsed.modelKey;
        patch.brand = parsed.brand;
        patch.modelText = undefined;
      } else if (text) {
        patch.modelKey = undefined;
        patch.brand = undefined;
        patch.modelText = text;
      }
      const ep = Number(r?.eyeletPairs);
      const p = ep > 0 && ep < 15 ? Math.round(ep) : null;
      if (p) patch.eyelets = p;
      if (r && r.laceColor && !spec.color) patch.color = cap1(String(r.laceColor));
      const lt = asLaceType(r?.laceType);
      if (lt) patch.laceType = lt;
      set(patch);
      setNote(
        `Claude (${(r && r.confidence) || 'unsure'}): ${text || 'model unclear'}${p ? ', ' + p + ' eyelet pairs' : ''}. Count them yourself before you buy.`,
      );
    } catch (e) {
      setNote(aiErr(e));
      onAiError(e);
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  return (
    <section className="wiz" aria-label="Lace details">
      <div className="wiz-h">
        <div>
          <div className="eyebrow">
            {draft.editId ? 'Edit pair' : 'New pair'}
            {' \u00B7 lace math'}
          </div>
          <h3 className="wiz-t">{shoeTitle(spec)}</h3>
          {missing.length ? (
            <p className="wiz-ask">
              {'Still need: '}
              {missing.join(', ')}.
            </p>
          ) : (
            <p className="wiz-ask ok">Got everything. Result updates as you change things.</p>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon d={I.x} />
        </button>
      </div>
      <div className="wiz-grid">
        <label className="fld">
          <span>Shoe</span>
          <select
            id="wz-model"
            value={spec.modelKey || ''}
            onChange={(e) => {
              const k = e.target.value;
              const mm = modelOf(k);
              set({
                modelKey: k || undefined,
                brand: mm ? mm.brand : spec.brand,
              });
            }}
          >
            <option value="">Other (type it below)</option>
            {MODELS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.brand} {x.name}
              </option>
            ))}
          </select>
        </label>
        {!spec.modelKey ? (
          <label className="fld">
            <span>{'Brand & model'}</span>
            <input
              id="wz-other"
              value={[spec.brand, spec.modelText].filter(Boolean).join(' ')}
              placeholder="e.g. Adidas Samba"
              onChange={(e) =>
                set({
                  brand: undefined,
                  modelText: e.target.value,
                })
              }
            />
          </label>
        ) : null}
        <div className="fld">
          <span>
            {'Shoe size '}
            <em>US</em>
          </span>
          <div className="row">
            <input
              id="wz-size"
              className="num"
              inputMode="decimal"
              value={spec.size || ''}
              placeholder="10"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                set({
                  size: isFinite(v) ? v : undefined,
                });
              }}
            />
            <Seg
              value={spec.sizeSys || 'M'}
              options={
                [
                  ['M', 'Men’s'],
                  ['W', 'Women’s'],
                ] as [SizeSystem, string][]
              }
              onChange={(v) =>
                set({
                  sizeSys: v,
                })
              }
              label="Size type"
            />
          </div>
        </div>
        <div className="fld">
          <span>
            {'Eyelet pairs '}
            <em>holes per side</em>
          </span>
          <div className="row">
            <button
              type="button"
              className="step"
              onClick={() =>
                set({
                  eyelets: clamp((pairs || 5) - 1, 1, 14),
                })
              }
              aria-label="Fewer eyelet pairs"
            >
              {'\u2212'}
            </button>
            <output className="step-v" aria-live="polite">
              {pairs || '?'}
            </output>
            <button
              type="button"
              className="step"
              onClick={() =>
                set({
                  eyelets: clamp((pairs || 4) + 1, 1, 14),
                })
              }
              aria-label="More eyelet pairs"
            >
              +
            </button>
            <EyeletDots n={pairs} />
            {!spec.eyelets && guess ? <span className="hint">typical for this shoe</span> : null}
          </div>
        </div>
        <div className="fld wide">
          <span>Lace color</span>
          <div className="swatches">
            {COLORS.map(([n, hex]) => (
              <button
                type="button"
                key={n}
                className={'sw' + ((spec.color || '').toLowerCase() === n.toLowerCase() ? ' on' : '')}
                style={{ '--sw': hex } as CSSProperties}
                aria-label={n}
                title={n}
                onClick={() =>
                  set({
                    color: n,
                  })
                }
              />
            ))}
          </div>
          <input
            id="wz-color"
            value={spec.color || ''}
            placeholder="Any color, e.g. black or gray"
            onChange={(e) =>
              set({
                color: e.target.value,
              })
            }
          />
        </div>
        <div className="fld wide">
          <span>Lace style</span>
          <Chips
            value={spec.laceType || (m ? m.type : 'flat')}
            options={(Object.keys(TYPES) as LaceType[]).map((k) => [k, TYPES[k].label] as [LaceType, string])}
            onChange={(v) =>
              set({
                laceType: v,
                typeAlt: undefined,
              })
            }
            label="Lace style"
          />
        </div>
        <div className="fld wide">
          <span>Lacing</span>
          <Chips
            value={spec.style || 'criss'}
            options={(Object.keys(STYLES) as LacingStyle[]).map(
              (k) => [k, STYLES[k].label] as [LacingStyle, string],
            )}
            onChange={(v) =>
              set({
                style: v,
              })
            }
            label="Lacing"
          />
        </div>
        <div className="fld wide">
          <span>Bow</span>
          <Chips
            value={spec.bow || 'std'}
            options={(Object.keys(BOWS) as BowKey[]).map((k) => [k, BOWS[k].label] as [BowKey, string])}
            onChange={(v) =>
              set({
                bow: v,
              })
            }
            label="Bow"
          />
        </div>
      </div>
      {ai ? (
        <div className="wiz-ai">
          {!m ? (
            <button type="button" className="btn ghost sm" disabled={!!busy} onClick={lookup}>
              <Icon d={I.spark} size={15} />
              {busy === 'lookup' ? 'Asking…' : 'Look up this shoe'}
            </button>
          ) : null}
          {aiImg ? (
            <label className={'btn ghost sm' + (busy ? ' is-busy' : '')}>
              <Icon d={I.camera} size={15} />
              {busy === 'photo' ? 'Reading photo…' : 'Photo → count eyelets'}
              <input
                ref={fileRef}
                id="wz-photo"
                className="sr-file"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={!!busy}
                onChange={(e) => photo(e.target.files && e.target.files[0])}
              />
            </label>
          ) : null}
          {note ? <p className="ai-note">{note}</p> : null}
        </div>
      ) : null}
      <LaceResult calc={calc} spec={spec} />
      {sized(calc)?.tip ? <p className="tip">{sized(calc)?.tip}</p> : null}
      <div className="wiz-f">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn sun" disabled={!!calc.need} onClick={onSave}>
          {draft.editId ? 'Save' : 'Add to list'}
        </button>
      </div>
    </section>
  );
}
/* ---------------- Bulk ---------------- */
export function BatchSheet({
  items,
  onRun,
  onClose,
}: {
  items: ItemView[];
  onRun: (specs: Record<string, LaceSpec>) => void;
  onClose: () => void;
}) {
  // Only the user's edits live in state. Each row's spec is derived from the item on every render, so
  // a pair queued while the sheet is open still gets a row (and is still sent to onRun).
  const [edits, setEdits] = useState<Record<string, Partial<LaceSpec>>>({});
  const specs = batchSpecs(items, edits);
  const setS = (id: string, patch: Partial<LaceSpec>) =>
    setEdits((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const blocked = items.filter((i) => calcLace(specs[i.id]).need);
  return (
    <section className="wiz batch" aria-label="Bulk lace math">
      <div className="wiz-h">
        <div>
          <div className="eyebrow">Bulk calc</div>
          <h3 className="wiz-t">
            {items.length}
            {' queued pair'}
            {items.length === 1 ? '' : 's'}
          </h3>
          <p className={'wiz-ask' + (blocked.length ? '' : ' ok')}>
            {blocked.length
              ? `Need the eyelet count for ${blocked.length}. Everything else is optional.`
              : 'Ready. Fill in colors or sizes if you want them on the list.'}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon d={I.x} />
        </button>
      </div>
      <ul className="batch-list">
        {items.map((i) => {
          const s = specs[i.id];
          const m = modelOf(s.modelKey);
          const g = m && !m.noLaces ? m.pairs(sizeMens(s)) : 0;
          return (
            <li key={i.id}>
              <div className="bl-t">
                <b>{shoeTitle(s)}</b>
                <span>{i.text}</span>
              </div>
              <div className="bl-f">
                <label>
                  Eyelets
                  <input
                    id={'b-e-' + i.id}
                    className="num"
                    inputMode="numeric"
                    value={s.eyelets || ''}
                    placeholder={g ? String(g) : '?'}
                    onChange={(e) => {
                      // same bounds as the wizard's +/- buttons: 1 to 14 pairs, blank means unknown
                      const n = parseInt(e.target.value, 10);
                      setS(i.id, { eyelets: n > 0 ? clamp(n, 1, 14) : undefined });
                    }}
                  />
                </label>
                <label>
                  Color
                  <input
                    id={'b-c-' + i.id}
                    value={s.color || ''}
                    placeholder="any"
                    onChange={(e) =>
                      setS(i.id, {
                        color: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Size
                  <input
                    id={'b-s-' + i.id}
                    className="num"
                    inputMode="decimal"
                    value={s.size || ''}
                    placeholder="–"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setS(i.id, {
                        size: isFinite(v) ? v : undefined,
                      });
                    }}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="wiz-f">
        <button type="button" className="btn ghost" onClick={onClose}>
          Later
        </button>
        <button
          type="button"
          className="btn sun"
          disabled={blocked.length === items.length}
          onClick={() => onRun(specs)}
        >
          Calculate all
        </button>
      </div>
    </section>
  );
}
export function BatchResults({
  items,
  onClose,
}: {
  items: (ItemView & { calc: LaceSized })[];
  onClose: () => void;
}) {
  return (
    <section className="batch-res" aria-label="Bulk results">
      <div className="br-h">
        <span className="eyebrow">Bulk results · all at once</span>
        <button type="button" className="icon-btn xs" onClick={onClose} aria-label="Dismiss results">
          <Icon d={I.x} size={14} />
        </button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Shoe</th>
              <th>Buy</th>
              <th>Style</th>
              <th>Color</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{shoeTitle(i.lace)}</td>
                <td className="num-cell">
                  {i.calc.inches}
                  {'\u2033 '}
                  <span>
                    {i.calc.cm}
                    {' cm'}
                  </span>
                </td>
                <td>{i.calc.typeLabel.replace(' · ', ' ')}</td>
                <td>{(i.lace && i.lace.color) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
/* ---------------- List rows ---------------- */
