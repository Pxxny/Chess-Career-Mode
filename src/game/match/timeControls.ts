import type { MatchTimeControl } from '@/types';

/** Same bands as the practice games: estimated length = base + 40 moves of increment. */
export function categoryFor(baseSeconds: number, incrementSeconds: number): MatchTimeControl['category'] {
  const estimate = baseSeconds + 40 * incrementSeconds;
  return estimate < 180 ? 'bullet' : estimate < 480 ? 'blitz' : estimate < 1500 ? 'rapid' : 'classical';
}

const trim = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** A time control from a base time in seconds and an increment in seconds. */
export function buildTimeControl(baseSeconds: number, incrementSeconds: number): MatchTimeControl {
  const base = Math.max(10, Math.round(baseSeconds));
  const increment = Math.max(0, Math.round(incrementSeconds));
  const minutes = base / 60;
  const id = `${trim(minutes)}+${increment}`;
  return { id, label: id, base, increment, category: categoryFor(base, increment) };
}

/** The same from minutes, as people type them. */
export const customTimeControl = (minutes: number, incrementSeconds: number): MatchTimeControl => buildTimeControl(minutes * 60, incrementSeconds);

export type TimeCategory = Exclude<MatchTimeControl['category'], 'none'>;

export const CATEGORY_LABEL: Record<TimeCategory, string> = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical' };

/** Ready-made time controls for each category (base minutes, increment seconds). */
export const PRESETS: Record<TimeCategory, MatchTimeControl[]> = {
  bullet: [buildTimeControl(60, 0), buildTimeControl(60, 1), buildTimeControl(120, 1)],
  blitz: [buildTimeControl(180, 0), buildTimeControl(180, 2), buildTimeControl(300, 0), buildTimeControl(300, 3)],
  rapid: [buildTimeControl(600, 0), buildTimeControl(600, 5), buildTimeControl(900, 10), buildTimeControl(1500, 10)],
  classical: [buildTimeControl(3600, 30), buildTimeControl(5400, 30), buildTimeControl(7200, 30)],
};

export const DEFAULT_TIME_CONTROL: MatchTimeControl = PRESETS.rapid[1];

/** "15 min + 10 s" */
export function describeTimeControl(tc: MatchTimeControl): string {
  const minutes = tc.base / 60;
  const base = minutes >= 1 ? `${trim(minutes)} min` : `${tc.base} s`;
  return tc.increment ? `${base} + ${tc.increment} s` : base;
}

/** The time control of a tournament level. */
export function levelTimeControl(minutes: number, incrementSeconds: number): MatchTimeControl {
  return buildTimeControl(minutes * 60, incrementSeconds);
}

export function formatClockText(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10000) return `${Math.floor(total / 1000)}.${Math.floor((total % 1000) / 100)}`;
  const s = Math.ceil(total / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
