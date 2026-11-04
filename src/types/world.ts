export interface GameDate {
  year: number;
  week: number;
}

export interface World {
  /** Seed of the persistent NPC world */
  seed: number;
  date: GameDate;
  /** Day of the week, 1 to 7. Training time passes day by day. */
  day: number;
  /** When true, historical legends appear in their prime regardless of era */
  alternateHistory: boolean;
}
