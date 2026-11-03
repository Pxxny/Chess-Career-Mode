export const GAME_CONFIG = {
  appName: 'Chess Career Mode',
  saveVersion: 3,
  saveKey: 'chess-career-mode-save',
  defaultPlayerName: 'New Player',
  maxNameLength: 24,
  /** Career start years the player can choose */
  startYear: {
    min: 1950,
    max: 2026,
    default: 2026,
    presets: [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2026],
  },
  /** Every starting value of a new career. Change these to rebalance the game. */
  player: {
    startingAge: 14,
    startingRating: 1000,
    startingRatedGames: 0,
    startingMoney: 250,
    startingMorale: 70,
    startingReputation: 0,
    maxActionPoints: 10,
    startingActionPoints: 10,
    startingSkill: 10,
    minSkill: 5,
    maxSkill: 100,
    /** Training speed multiplier for skills an archetype has an affinity with */
    affinityMultiplier: 1.25,
  },
  world: {
    /** Fixed seed; mixed with the start year so each era has its own stable world. */
    seed: 1128812372,
    /** Bump to rebuild stored NPC databases after changing generation rules. */
    npcDatabaseVersion: 2,
    fictionalNpcCount: 1200,
    maxCityResults: 40,
    majorCityCount: 12,
  },
} as const;
