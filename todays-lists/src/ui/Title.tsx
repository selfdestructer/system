import { useLayoutEffect, useRef, useState } from 'react';

/* The script header: Yellowtail wordmark drawn stroke-first, then filled, then underlined. */

export function Title() {
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [go, setGo] = useState(false);
  useLayoutEffect(() => {
    let started = false;
    const measure = () => {
      const t = ref.current && ref.current.querySelector<SVGTextElement>('.t-fill');
      if (!t) return;
      try {
        const b = t.getBBox();
        if (b && b.width > 40)
          setBox({
            x: b.x,
            y: b.y,
            w: b.width,
            h: b.height,
          });
      } catch (e) {
        /* not rendered yet */
      }
    };
    const start = () => {
      measure();
      if (started) return;
      started = true;
      requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    };
    const f = document.fonts;
    if (f && f.load) {
      f.load('112px "Yellowtail"').then(start, start);
      if (f.ready) f.ready.then(measure, () => {});
      setTimeout(start, 1800);
    } else start();
  }, []);
  const b = box || {
    x: 0,
    y: 30,
    w: 610,
    h: 110,
  };
  const vb = `${Math.floor(b.x - 6)} ${Math.floor(b.y - 4)} ${Math.ceil(b.w + 34)} ${Math.ceil(b.h + 30)}`;
  const y0 = b.y + b.h + 9;
  const swoosh = `M ${b.x + b.w * 0.05} ${y0 + 5} C ${b.x + b.w * 0.32} ${y0 - 7}, ${b.x + b.w * 0.64} ${y0 + 3}, ${b.x + b.w * 0.95} ${y0 - 4}`;
  const replay = () => {
    setGo(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
  };
  return (
    <svg
      ref={ref}
      className={'title' + (go ? ' go' : '')}
      viewBox={vb}
      role="img"
      aria-label="Today’s Lists"
      onClick={replay}
    >
      <defs>
        <linearGradient id="tl-grad" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#FFD25E" />
          <stop offset="0.5" stopColor="#7BE0A6" />
          <stop offset="1" stopColor="#73BDF9" />
        </linearGradient>
      </defs>
      <text className="t-fill" x="0" y="112">
        Today’s Lists
      </text>
      <text className="t-stroke" x="0" y="112">
        Today’s Lists
      </text>
      <path className="t-swoosh" d={swoosh} />
      <circle className="t-dot" cx={b.x + b.w * 0.95 + 13} cy={y0 - 4} r="5.5" />
    </svg>
  );
}
/* ---------------- Small controls ---------------- */
