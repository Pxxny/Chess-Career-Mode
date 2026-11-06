export type EventLevel = 'local' | 'national' | 'international' | 'elite';

/** Placeholders: {city}, {demonym}, {continent} */
export const EVENT_PATTERNS: Record<EventLevel, string[]> = {
  local: ['{city} Open', '{city} Club Championship', '{demonym} Junior Open', '{city} Weekend Swiss', '{city} Rapid Cup'],
  national: ['{demonym} Championship', '{demonym} Rapid Cup', '{city} Masters', '{demonym} Open Series', '{city} Spring Classic'],
  international: ['{city} International', '{city} Masters Invitational', '{continent} Zonal', '{city} Rapid & Blitz Festival', '{city} Autumn Open'],
  elite: ['{city} Super Tournament', 'Grand {city} Classic', '{continent} Continental Championship', '{city} Elite Invitational'],
};

export const EVENT_FIELD_SIZE: Record<EventLevel, [number, number]> = {
  local: [24, 120],
  national: [30, 160],
  international: [60, 220],
  elite: [8, 24],
};
