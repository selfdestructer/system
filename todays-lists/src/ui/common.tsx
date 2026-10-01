import type { ClaudeError } from '../claude';

export type Toast = (msg: string) => void;

export const clone = <T,>(o: T): T =>
  typeof structuredClone === 'function' ? structuredClone(o) : (JSON.parse(JSON.stringify(o)) as T);
export const I = {
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.2 4.2L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  nav: 'M4 11.4L20 4l-7.4 16-2.1-6.5z',
  pin: 'M12 21s-6.5-5.9-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.1 12 21 12 21zM12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  home: 'M4 11l8-6.5 8 6.5V20h-5.5v-5.5h-5V20H4z',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  phone: 'M6.6 3.6l2.8 3-1.8 2.3a12 12 0 0 0 7.5 7.5l2.3-1.8 3 2.8-2.1 2.8C11 19.8 4.2 13 3.8 5.7z',
  spark: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z',
  camera: 'M4 8h3.2L9 5.5h6L16.8 8H20v11H4zM12 16.3a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  back: 'M15 5l-7 7 7 7',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  route:
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  chev: 'M9 6l6 6-6 6',
};

export function Icon({ d, size, sw }: { d: string; size?: number; sw?: number }) {
  const s = size || 18;
  return (
    <svg
      className="ic"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const AI_OFF = [
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
];

export function aiErr(e: unknown): string {
  const c = (e as ClaudeError | null)?.code;
  if (c && AI_OFF.includes(c)) return 'Claude isn’t turned on for this page, so that feature is off.';
  if (c === 'rate_limited') return 'Claude is busy. Try again in a minute.';
  if (c === 'invalid_json') return 'Claude’s answer came back in an unusable shape. Try again.';
  if (c === 'refused') return 'Claude declined that one.';
  if (c === 'image_rejected') return 'That photo didn’t work. Try a JPG or PNG.';
  if (c === 'cancelled') return 'Stopped.';
  return 'Couldn’t reach Claude right now.';
}

export async function copyText(s: string, toast?: Toast, label?: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(s);
    if (toast) toast(label || 'Copied');
  } catch {
    if (toast) toast('Copy was blocked. Press and hold the text to copy it.');
  }
}
