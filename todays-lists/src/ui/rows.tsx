import { useState, type CSSProperties } from 'react';
import type { ItemView } from '../types';
import { shoeTitle, sized, swatchOf } from '../calc/laces';
import { amazonLink } from '../lib/links';
import { Check, EyeletDots, Ruler } from './controls';
import { I, Icon, copyText, type Toast } from './common';

interface RowProps {
  it: ItemView;
  onToggle: () => void;
  onDelete: () => void;
}

export function LaceCard({
  it,
  onToggle,
  onEdit,
  onDelete,
  toast,
}: RowProps & { onEdit: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false);
  const s = it.lace || {};
  const c = it.calc;
  const sc = sized(c);
  const title = shoeTitle(s);
  return (
    <li className={'lace' + (it.done ? ' done' : '') + (it.queued ? ' queued' : '')}>
      <div className="lace-row">
        <Check on={it.done} onClick={onToggle} label={'Got laces for ' + title} />
        <EyeletDots n={(sc && sc.pairs) || s.eyelets || 0} />
        <button type="button" className="lace-main" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="lace-title">{title}</span>
          <span className="lace-raw">{it.text}</span>
          <span className="tags">
            {s.color ? (
              <span className="tag">
                <i className="dot-sw" style={{ '--sw': swatchOf(s.color) } as CSSProperties} />
                {s.color}
              </span>
            ) : (
              <span className="tag need">color?</span>
            )}
            {sc ? (
              <span className="tag">
                {sc.typeLabel.split(' · ')[0]}
                {sc.altType ? ' / ' + sc.altType.split(' · ')[0].toLowerCase() : ''}
              </span>
            ) : null}
            {it.foundAt ? (
              <span className="tag ok">
                {'Got it \u00B7 '}
                {it.foundAt}
              </span>
            ) : null}
            {!it.done && it.missedAt && it.missedAt.length ? (
              <span className="tag miss">
                {'Not at '}
                {it.missedAt.slice(-2).join(', ')}
              </span>
            ) : null}
          </span>
        </button>
        <div className="lace-len">
          {it.queued ? (
            <span className="q">Queued</span>
          ) : sc ? (
            <>
              <b>{sc.inches}″</b>
              <span>
                {sc.cm}
                {' cm'}
              </span>
            </>
          ) : c && c.noLaces ? (
            <span className="q">No laces</span>
          ) : (
            <span className="q">Needs info</span>
          )}
        </div>
      </div>
      {open ? (
        <div className="lace-more">
          {sc ? <Ruler calc={sc} /> : null}
          {sc ? (
            <ul className="why">
              {sc.why.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          {sc && sc.alts.length ? (
            <div className="alts">
              {sc.alts.map((a) => (
                <span key={a.inches} className="alt">
                  <b>{a.inches}″</b>
                  {a.label}
                </span>
              ))}
            </div>
          ) : null}
          {sc && sc.tip ? <p className="tip">{sc.tip}</p> : null}
          {sc && sc.src.length ? (
            <p className="src">
              {'Source: '}
              {sc.src.join(' ')}
            </p>
          ) : null}
          <div className="acts">
            {sc ? (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => copyText(sc.search, toast, 'Search copied: ' + sc.search)}
              >
                <Icon d={I.copy} size={15} />
                Copy search
              </button>
            ) : null}
            {sc ? (
              <a className="btn ghost sm" href={amazonLink(it)} target="_blank" rel="noopener noreferrer">
                Amazon
                <Icon d={I.ext} size={14} />
              </a>
            ) : null}
            <button type="button" className="btn ghost sm" onClick={onEdit}>
              <Icon d={I.edit} size={15} />
              Edit
            </button>
            <button type="button" className="btn ghost sm danger" onClick={onDelete}>
              <Icon d={I.trash} size={15} />
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
export function ItemRow({ it, onToggle, onDelete }: RowProps) {
  return (
    <li className={'item' + (it.done ? ' done' : '')}>
      <Check on={it.done} onClick={onToggle} label={it.text} />
      <span className="it-t">
        {it.text}
        {it.qty > 1 ? <span className="qty">×{it.qty}</span> : null}
      </span>
      {it.foundAt ? <span className="tag ok">{it.foundAt}</span> : null}
      {!it.done && it.missedAt && it.missedAt.length ? (
        <span className="tag miss">
          {'Not at '}
          {it.missedAt.slice(-1)[0]}
        </span>
      ) : null}
      <button type="button" className="icon-btn xs del" onClick={onDelete} aria-label={'Delete ' + it.text}>
        <Icon d={I.trash} size={14} />
      </button>
    </li>
  );
}
/* ---------------- Shop panel ---------------- */
