export const GAME_CONFIG = {
  appName: 'Chess Career Mode',
  saveVersion: 7,
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
  /** Skill upgrades: cost in AP is `baseCost + floor(skill / tierSize)`. Affinity skills gain +2 every fourth upgrade. */
  training: {
    baseCost: 1,
    tierSize: 25,
    gain: 1,
    /** Weeks that count as "recent" for training quality and morale */
    recentWeeks: 8,
  },
  /** Daily training: hours, fatigue and experience curves */
  sessions: {
    hoursPerDay: 8,
    maxFatigue: 100,
    /** At or above this fatigue the player is too tired to train */
    exhaustedAt: 90,
    /** Share of efficiency lost at 100 fatigue */
    fatiguePenalty: 0.5,
    /** Each repeat of the same session on one day earns this fraction of the previous one */
    repeatFactor: 0.7,
    /** Experience needed for the next point = base + perLevel * current level */
    xpBase: 80,
    xpPerLevel: 8,
    minDiminishing: 0.12,
    nightRecovery: 35,
    restDayBonus: 20,
    maxHistory: 200,
    /** Weeks a scouting report or tournament plan stays useful */
    prepWeeks: 6,
  },
  /** Practice games: Training Game, Online Blitz and Game vs the Engine */
  practice: {
    maxGames: 300,
    /** Training Game: hours used (long time controls take two) */
    trainingHours: 1,
    longTrainingHours: 2,
    /** Fatigue added by one game of each mode, before stamina */
    fatigue: { training: 6, blitz: 3, engine: 3 } as const,
    /** XP multiplier per mode compared with a normal training session */
    xpScale: { training: 1, blitz: 0.55, engine: 0.45 } as const,
    /** Blitz rating of a new account is the player's Elo rounded to this step */
    blitzStep: 50,
    provisionalGames: 20,
    onlinePoolSize: 600,
    analysisDepth: 11,
  },
  /** Rated matches, tournaments and the match viewer */
  match: {
    maxRecords: 60,
    /** Depth of the post-game analysis and of the live evaluation */
    analysisDepth: 12,
    liveDepth: 14,
    liveMs: 450,
    /** Fatigue added by one rated or friendly game, by time-control category, before stamina */
    fatigue: { none: 4, bullet: 2, blitz: 3, rapid: 5, classical: 8 } as const,
    moraleWin: 2,
    moraleLoss: -2,
    /** Rounds of each tournament level */
    rounds: { local: 5, national: 7, international: 9, elite: 9 } as const,
    /** Share of the prize fund paid to ranks 1 to 5 */
    prizeShares: [0.35, 0.22, 0.15, 0.1, 0.06] as readonly number[],
    /** Time controls of tournament levels: base minutes + increment seconds */
    levelTime: { local: [15, 10], national: [25, 10], international: [90, 30], elite: [90, 30] } as const,
  },
  history: {
    maxGames: 1000,
    maxNews: 60,
    maxLedger: 200,
    recentFormGames: 5,
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
