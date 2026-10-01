import type { ReactNode } from 'react';
import type { LaceCalc, LaceSized, LaceSpec } from '../types';
import { I, Icon, copyText, type Toast } from './common';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={'ck' + (on ? ' on' : '')}
      role="checkbox"
      aria-checked={!!on}
      aria-label={label}
      onClick={onClick}
    >
      {on ? <Icon d={I.check} size={15} sw={3} /> : null}
    </button>
  );
}
export function Seg<V extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: [V, ReactNode][];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? 'on' : ''}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
export function Chips<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: [V, ReactNode][];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={'chip sm' + (value === v ? ' on' : '')}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
export function Phone({ num, toast }: { num: string; toast: Toast }) {
  const digits = num.replace(/[^\d+]/g, '');
  return (
    <span className="phone">
      <a href={'tel:' + digits}>
        <Icon d={I.phone} size={14} />
        {num}
      </a>
      <button
        type="button"
        className="icon-btn xs"
        onClick={() => copyText(num, toast, 'Number copied')}
        aria-label={'Copy ' + num}
      >
        <Icon d={I.copy} size={13} />
      </button>
    </span>
  );
}
export function EyeletDots({ n }: { n: number }) {
  const rows = clamp(n || 0, 0, 12);
  if (!rows) return <span className="eyelets none" aria-hidden="true" />;
  const gap = rows > 8 ? 4.6 : 6;
  const h = 10 + (rows - 1) * gap;
  const ys = [];
  for (let i = 0; i < rows; i++) ys.push(5 + i * gap);
  return (
    <svg className="eyelets" width="22" height={h} viewBox={`0 0 22 ${h}`} aria-hidden="true">
      <line x1="5" y1={ys[0]} x2="17" y2={ys[0]} />
      {ys.slice(0, -1).map((y, i) => (
        <g key={i}>
          <line x1="5" y1={y} x2="17" y2={y + gap} />
          <line x1="17" y1={y} x2="5" y2={y + gap} />
        </g>
      ))}
      {ys.map((y, i) => (
        <g key={'d' + i}>
          <circle cx="5" cy={y} r="2" />
          <circle cx="17" cy={y} r="2" />
        </g>
      ))}
    </svg>
  );
}
export function Ruler({ calc }: { calc: LaceSized }) {
  const max = calc.inches > 72 || calc.hi > 78 ? 84 : 72;
  const W = 380,
    L = 8,
    R = W - 10;
  const x = (v: number) => L + (clamp(v, 0, max) / max) * (R - L);
  const ticks: JSX.Element[] = [];
  for (let i = 0; i <= max; i++) {
    const mj = i % 9 === 0,
      md = i % 3 === 0;
    ticks.push(
      <line
        key={i}
        x1={x(i)}
        x2={x(i)}
        y1="31"
        y2={mj ? 19 : md ? 24 : 27}
        className={mj ? 'tk mj' : 'tk'}
      />,
    );
  }
  const labels: JSX.Element[] = [];
  for (let i = 0; i <= max; i += 9)
    labels.push(
      <text key={i} x={x(i)} y="44" className="tn">
        {i}
      </text>,
    );
  return (
    <svg
      className="ruler"
      viewBox={`0 0 ${W} 48`}
      role="img"
      aria-label={`Buy ${calc.inches} inch laces; anything from about ${Math.round(calc.lo)} to ${Math.round(calc.hi)} inches works`}
    >
      <rect
        className="band"
        x={x(calc.lo)}
        y="16"
        width={Math.max(2, x(calc.hi) - x(calc.lo))}
        height="15"
        rx="3"
      />
      <line className="base" x1={x(0)} x2={x(max)} y1="31" y2="31" />
      {ticks}
      <line className="lace" x1={x(0) + 4} x2={x(calc.inches) - 4} y1="8" y2="8" />
      <rect className="aglet" x={x(0) - 1} y="5" width="8" height="6" rx="2" />
      <rect className="aglet" x={x(calc.inches) - 7} y="5" width="8" height="6" rx="2" />
      <path className="mark" d={`M${x(calc.inches)} 16 l-4 -3.5 h8 z`} />
      {labels}
    </svg>
  );
}
export function LaceResult({ calc, spec }: { calc: LaceCalc; spec: LaceSpec }) {
  if (calc.noLaces) return <div className="res empty">{calc.why[0]}</div>;
  if (calc.need)
    return (
      <div className="res empty">
        How many eyelet pairs (holes per side)? That’s the one thing I need to size it.
      </div>
    );
  return (
    <div className="res">
      <div className="res-top">
        <div className="res-num">
          <b>{calc.inches}″</b>
          <span>
            {calc.cm}
            {' cm'}
          </span>
        </div>
        <div className="res-meta">
          <div className="res-type">
            {calc.typeLabel}
            {calc.altType ? (
              <span className="or">
                {' or '}
                {calc.altType}
              </span>
            ) : null}
          </div>
          <div className="res-sub">
            {spec.color || 'Color not set'}
            {' \u00B7 '}
            {calc.pairs}
            {' eyelet pairs \u00B7 fits about '}
            {Math.round(calc.lo)}–{Math.round(calc.hi)}″
          </div>
          {calc.shelf ? (
            <div className="res-sub warn">
              {calc.inches}
              {'\u2033 is a less common size. '}
              {calc.shelf}″ works if that’s what’s on the shelf.
            </div>
          ) : null}
        </div>
      </div>
      <Ruler calc={calc} />
    </div>
  );
}
/* ---------------- Lace wizard ---------------- */
