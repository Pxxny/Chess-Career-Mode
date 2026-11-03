export interface GameDate {
  year: number;
  week: number;
}

export interface World {
  /** Seed of the persistent NPC world */
  seed: number;
  date: GameDate;
  /** When true, historical legends appear in their prime regardless of era */
  alternateHistory: boolean;
}
