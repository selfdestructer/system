import { useState } from 'react';
import type { AppState, ItemView } from '../types';
import { CHAINS } from '../data/catalog';
import { onlineLinks } from '../lib/links';
import { itemShort, shoppable } from '../lib/stores';
import { I, Icon } from './common';

export type Update = (fn: (d: AppState) => void) => void;

export interface ShopPanelProps {
  st: AppState;
  update: Update;
  items: ItemView[];
  onFind: () => void;
}

export function ShopPanel({ st, update, items, onFind }: ShopPanelProps) {
  const openBy = (cat: string) => items.filter((i) => i.cat === cat && shoppable(i)).length;
  const shopCats = st.cats.filter((c) => c.shop);
  const selCount = st.shopCats.reduce((n, id) => n + openBy(id), 0);
  const selItems = items.filter((i) => st.shopCats.includes(i.cat) && shoppable(i));
  const [online, setOnline] = useState(false);
  const relChains = Object.keys(CHAINS).filter((k) =>
    st.shopCats.some((c) => (CHAINS[k].cats[c] || 0) >= 0.4),
  );
  return (
    <section className="shop" aria-label="Plan a shopping run">
      <div className="eyebrow">Going out?</div>
      <h2 className="shop-q">What do you need today?</h2>
      <div className="chips">
        {shopCats.map((c) => {
          const n = openBy(c.id);
          const on = st.shopCats.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={'chip tone-' + c.tone + (on && n ? ' on' : '')}
              disabled={!n}
              aria-pressed={on && !!n}
              onClick={() =>
                update((d) => {
                  d.shopCats = on ? d.shopCats.filter((x) => x !== c.id) : d.shopCats.concat([c.id]);
                })
              }
            >
              {c.short}
              <span className="n">{n}</span>
            </button>
          );
        })}
      </div>
      <h3 className="shop-q2">Where are you shopping?</h3>
      <div className="chips">
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
          </button>
        ))}
      </div>
      <div className="chips">
        <button
          type="button"
          className={'chip tone-sky' + (!st.chains.length ? ' on' : '')}
          onClick={() =>
            update((d) => {
              d.chains = [];
            })
          }
        >
          Anywhere nearby
        </button>
        {relChains.map((k) => (
          <button
            key={k}
            type="button"
            className={'chip tone-sky' + (st.chains.includes(k) ? ' on' : '')}
            onClick={() =>
              update((d) => {
                d.chains = d.chains.includes(k) ? d.chains.filter((x) => x !== k) : d.chains.concat([k]);
              })
            }
          >
            {CHAINS[k].label}
          </button>
        ))}
      </div>
      <button type="button" className="cta" disabled={!selCount} onClick={onFind}>
        <span className="cta-l">Find local stock</span>
        <span className="cta-sub">
          {selCount}
          {' item'}
          {selCount === 1 ? '' : 's'}
        </span>
        <Icon d={I.chev} />
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={!selCount}
        aria-expanded={online}
        onClick={() => setOnline(!online)}
      >
        <Icon d={I.ext} size={15} />
        {online ? 'Hide online options' : 'Or order online instead'}
      </button>
      {online && selCount ? (
        <ul className="online" aria-label="Buy online">
          {selItems.map((i) => (
            <li key={i.id}>
              <b>{itemShort(i)}</b>
              <span className="odds">
                {onlineLinks(i).map((l) => (
                  <a
                    key={l.label}
                    className="odd maybe"
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label}
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
/* ---------------- Map ---------------- */
