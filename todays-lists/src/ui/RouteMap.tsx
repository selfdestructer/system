import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { LatLon, StopState } from '../types';
import { TOWNS } from '../data/catalog';
import { storeShort } from '../lib/links';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface MapStop extends LatLon {
  id: string;
  name: string;
  added?: boolean;
}
export interface MapDot extends LatLon {
  id: string;
  pk?: boolean;
}
export interface RouteMapProps {
  base: LatLon | null;
  route?: MapStop[];
  states?: StopState[];
  /** Index of the current leg/stop; -1 or undefined for a plan preview. */
  cur?: number;
  dots?: MapDot[];
  pin?: LatLon | null;
  onTap?: ((p: LatLon) => void) | null;
  towns?: boolean;
}

export function RouteMap({ base, route, states, cur, dots, pin, onTap, towns }: RouteMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver((es) => {
      for (const e of es) setW(Math.max(260, Math.round(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(clamp(w * 0.6, 220, 380));
  const r = route || [];
  const fitPts: LatLon[] = ([base, pin] as (LatLon | null | undefined)[])
    .concat(r.length ? r : dots || [])
    .filter((p): p is LatLon => !!p);
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const p of fitPts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  if (!isFinite(minLat)) {
    minLat = 40.05;
    maxLat = 40.2;
    minLon = -75.05;
    maxLon = -74.8;
  }
  const lat0 = (minLat + maxLat) / 2,
    kx = Math.cos((lat0 * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * kx, 0.03),
    spanY = Math.max(maxLat - minLat, 0.03);
  const pad = 34;
  const scale = Math.min((w - pad * 2) / spanX, (H - pad * 2) / spanY);
  const cx = ((minLon + maxLon) / 2) * kx,
    cy = (minLat + maxLat) / 2;
  const P = (p: LatLon) => ({
    x: w / 2 + (p.lon * kx - cx) * scale,
    y: H / 2 - (p.lat - cy) * scale,
  });
  const inv = (x: number, y: number) => ({
    lon: ((x - w / 2) / scale + cx) / kx,
    lat: cy - (y - H / 2) / scale,
  });
  const pxMile = scale / 69;
  const g = [0.5, 1, 2, 5, 10, 20].find((v) => v * pxMile >= 46) || 20;
  const gridStep = g * pxMile;
  const grid: JSX.Element[] = [];
  const c0 = P({
    lat: cy,
    lon: cx / kx,
  });
  for (let x = c0.x % gridStep; x < w; x += gridStep)
    grid.push(<line key={'gx' + x} className="grid" x1={x} x2={x} y1="0" y2={H} />);
  for (let y = c0.y % gridStep; y < H; y += gridStep)
    grid.push(<line key={'gy' + y} className="grid" x1="0" x2={w} y1={y} y2={y} />);
  const inView = (p: LatLon) => {
    const q = P(p);
    return q.x > 8 && q.x < w - 8 && q.y > 10 && q.y < H - 8;
  };
  const townEls = towns
    ? TOWNS.filter(inView).map((t) => {
        const q = P(t);
        return (
          <text key={t.label} className="town" x={q.x} y={q.y}>
            {t.label.replace(/, (PA|NJ)$/, '').replace(' (Phila)', '')}
          </text>
        );
      })
    : null;
  const legs: JSX.Element[] = [];
  if (base && r.length) {
    const pts = [base].concat(r).concat([base]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = P(pts[i]),
        b = P(pts[i + 1]);
      const cls = cur == null || cur < 0 ? 'later' : i < cur ? 'done' : i === cur ? 'now' : 'later';
      legs.push(<line key={'l' + i} className={'leg ' + cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
  }
  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (!onTap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * w) / rect.width,
      y = ((e.clientY - rect.top) * H) / rect.height;
    onTap(inv(x, y));
  };
  const bp = base ? P(base) : null;
  return (
    <div className={'map-wrap' + (onTap ? ' tappable' : '')} ref={wrapRef}>
      <svg
        className="map"
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        onClick={click}
        role="img"
        aria-label={r.length ? `Route map: ${r.length} stops, out and back` : 'Map of nearby stores'}
      >
        {grid}
        {townEls}
        {(dots || [])
          .filter((d) => !r.some((s) => s.id === d.id))
          .map((d) => {
            const q = P(d);
            return (
              <circle
                key={'d' + d.id}
                className={'dot' + (d.pk ? ' pk' : '')}
                cx={q.x}
                cy={q.y}
                r={d.pk ? 5 : 3.5}
              />
            );
          })}
        {legs}
        {r.map((s, i) => {
          const q = P(s);
          const stt = states ? states[i] : 'pending';
          const cls = 'stop ' + (stt || 'pending') + (cur === i ? ' cur' : '') + (s.added ? ' added' : '');
          const left = q.x > w - 120;
          return (
            <g key={'s' + s.id + i} className={cls}>
              <circle cx={q.x} cy={q.y} r="12" />
              <text className="num" x={q.x} y={q.y + 0.5}>
                {i + 1}
              </text>
              <text
                className="name"
                x={left ? q.x - 17 : q.x + 17}
                y={q.y + 4}
                textAnchor={left ? 'end' : 'start'}
              >
                {storeShort(s).slice(0, 22)}
              </text>
            </g>
          );
        })}
        {bp ? (
          <g className="home">
            <circle cx={bp.x} cy={bp.y} r="13" />
            <path d={`M${bp.x - 6} ${bp.y + 5} v-6 l6 -5 l6 5 v6 z`} />
          </g>
        ) : null}
        {pin
          ? (() => {
              const q = P(pin);
              return (
                <g className="pin">
                  <circle cx={q.x} cy={q.y} r="9" />
                  <line x1={q.x - 14} x2={q.x + 14} y1={q.y} y2={q.y} />
                  <line x1={q.x} x2={q.x} y1={q.y - 14} y2={q.y + 14} />
                </g>
              );
            })()
          : null}
        <g className="scale" transform={`translate(12 ${H - 14})`}>
          <line x1="0" x2={gridStep} y1="0" y2="0" />
          <line x1="0" x2="0" y1="-4" y2="4" />
          <line x1={gridStep} x2={gridStep} y1="-4" y2="4" />
          <text x={gridStep + 6} y="4">
            {g}
            {' mi'}
          </text>
        </g>
      </svg>
      {onTap ? <div className="map-hint">Tap the map to drop a pin</div> : null}
    </div>
  );
}
/* ---------------- Stores ---------------- */
