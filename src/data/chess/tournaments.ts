export type EventLevel = 'local' | 'national' | 'international' | 'elite';
/** open: everyone may enter (women, men, adults, children); junior: age-capped; championship: open, higher prestige */
export type EventKind = 'open' | 'junior' | 'championship';
export interface EventStyle {
  /** Placeholders: {city}, {demonym}, {continent} */
  pattern: string;
  kind: EventKind;
  /** Oldest allowed age for junior events (U17 = 16, U14 = 13, U12 = 11) */
  maxAge?: number;
}

export const EVENT_STYLES: Record<EventLevel, EventStyle[]> = {
  local: [
    { pattern: '{city} Open', kind: 'open' },
    { pattern: '{city} Junior Open (U17)', kind: 'junior', maxAge: 16 },
    { pattern: '{city} U14 Junior Cup', kind: 'junior', maxAge: 13 },
    { pattern: '{city} U12 Junior Open', kind: 'junior', maxAge: 11 },
    { pattern: '{city} Club Championship', kind: 'championship' },
    { pattern: '{city} Weekend Open', kind: 'open' },
    { pattern: '{city} Rapid Open', kind: 'open' },
  ],
  national: [
    { pattern: '{demonym} Open Championship', kind: 'championship' },
    { pattern: '{demonym} Junior Championship (U17)', kind: 'junior', maxAge: 16 },
    { pattern: '{city} Open', kind: 'open' },
    { pattern: '{city} Masters Open', kind: 'open' },
    { pattern: '{demonym} Rapid Open', kind: 'open' },
    { pattern: '{city} Junior Open (U17)', kind: 'junior', maxAge: 16 },
  ],
  international: [
    { pattern: '{city} International Open', kind: 'open' },
    { pattern: '{city} International Junior Open (U17)', kind: 'junior', maxAge: 16 },
    { pattern: '{continent} Zonal Championship', kind: 'championship' },
    { pattern: '{city} Rapid & Blitz Open', kind: 'open' },
    { pattern: '{city} Autumn Open', kind: 'open' },
  ],
  elite: [
    { pattern: '{city} Super Tournament', kind: 'championship' },
    { pattern: 'Grand {city} Classic', kind: 'open' },
    { pattern: '{continent} Continental Championship', kind: 'championship' },
    { pattern: '{city} Elite Junior Championship (U17)', kind: 'junior', maxAge: 16 },
  ],
};

/** Names only, e.g. for the tournament history of generated players. */
export const EVENT_PATTERNS: Record<EventLevel, string[]> = {
  local: EVENT_STYLES.local.map((s) => s.pattern),
  national: EVENT_STYLES.national.map((s) => s.pattern),
  international: EVENT_STYLES.international.map((s) => s.pattern),
  elite: EVENT_STYLES.elite.map((s) => s.pattern),
};

export const EVENT_FIELD_SIZE: Record<EventLevel, [number, number]> = {
  local: [24, 120],
  national: [30, 160],
  international: [60, 220],
  elite: [8, 24],
};
