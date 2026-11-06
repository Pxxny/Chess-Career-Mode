export interface TimeControl {
  /** "5+3" or "none" */
  id: string;
  label: string;
  /** Seconds each side starts with */
  base: number;
  /** Seconds added after each move */
  increment: number;
  category: 'none' | 'bullet' | 'blitz' | 'rapid' | 'classical';
}

const make = (base: number, increment: number): TimeControl => {
  const estimate = base + 40 * increment;
  const category = estimate < 180 ? 'bullet' : estimate < 480 ? 'blitz' : estimate < 1500 ? 'rapid' : 'classical';
  const minutes = base / 60;
  return { id: `${minutes}+${increment}`, label: `${minutes}+${increment}`, base, increment, category };
};

export const NO_CLOCK: TimeControl = { id: 'none', label: 'No clock', base: 0, increment: 0, category: 'none' };

export const TRAINING_TIME_CONTROLS: TimeControl[] = [NO_CLOCK, make(180, 2), make(300, 3), make(600, 0), make(600, 5), make(900, 10), make(1800, 0)];
export const BLITZ_TIME_CONTROLS: TimeControl[] = [make(180, 0), make(180, 2), make(240, 2), make(300, 0), make(300, 3)];
export const ENGINE_TIME_CONTROLS: TimeControl[] = [NO_CLOCK, make(60, 0), make(180, 2), make(300, 3), make(600, 0), make(900, 10)];

export const findTimeControl = (id: string): TimeControl =>
  [...TRAINING_TIME_CONTROLS, ...BLITZ_TIME_CONTROLS, ...ENGINE_TIME_CONTROLS].find((t) => t.id === id) ?? NO_CLOCK;

/** Expected game length in minutes, used for the training-hours cost. */
export const estimatedMinutes = (tc: TimeControl): number => (tc.category === 'none' ? 30 : (2 * tc.base + 2 * 40 * tc.increment) / 60);

export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10000) return `${Math.floor(total / 1000)}.${Math.floor((total % 1000) / 100)}`;
  const s = Math.ceil(total / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
