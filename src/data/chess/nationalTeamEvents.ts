import type { Continent } from "@/types";

/**
 * Twenty national-team competitions modelled on FIDE's team formats. Team counts,
 * boards and reserves follow the published range for each event; the career
 * calendar simply generates one edition per game year (not the real cycle).
 */
export type BoardSlot = "open" | "woman" | "man" | "boy-u20" | "girl-u20";
export type TeamEventScope = "world" | "continental" | "games" | "youth";

export interface TeamEventSpec {
  key: string;
  name: string;
  /** Category shown in the tournament finder */
  category: string;
  scope: TeamEventScope;
  /** Inclusive range of competing teams */
  teams: [number, number];
  /** Inclusive range of starting boards per match */
  boards: [number, number];
  /** Inclusive range of reserve players per team */
  reserves: [number, number];
  /** Required composition of the starters; missing slots are "open" */
  slots?: BoardSlot[];
  /** Every player must be female */
  gender?: "female";
  minAge?: number;
  maxAge?: number;
  /** Federations must belong to one of these continents… */
  continents?: Continent[];
  /** …or be one of these ISO codes (checked together: either list admits a team) */
  countries?: string[];
  /** Eligibility is not modelled (e.g. disability classification): teams are abstract and the player cannot enter */
  abstract?: boolean;
  /** Calendar week of the event in the 52-week career year */
  week: number;
  deadline: number;
  minElo: number;
  minReputation: number;
  /** Top appearance/prize money; lower ranks scale down */
  prize: number;
  prestige: number;
  rounds: number;
  timeControl: "classical" | "rapid";
}

const SEA = ["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN"];
const ARAB = [
  "DZ",
  "BH",
  "KM",
  "DJ",
  "EG",
  "IQ",
  "JO",
  "KW",
  "LB",
  "LY",
  "MR",
  "MA",
  "OM",
  "PS",
  "QA",
  "SA",
  "SO",
  "SD",
  "SY",
  "TN",
  "AE",
  "YE",
];
const IBERO = [
  "ES",
  "PT",
  "AD",
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "SV",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PY",
  "PE",
  "PR",
  "UY",
  "VE",
];
const MITROPA = ["AT", "CZ", "DE", "HR", "HU", "IT", "PL", "SI", "SK", "CH"];

const base = {
  minReputation: 5,
  timeControl: "classical" as const,
  deadline: 4,
};

export const TEAM_EVENTS: TeamEventSpec[] = [
  {
    ...base,
    key: "olympiad",
    name: "FIDE Chess Olympiad (Open)",
    category: "Chess Olympiad",
    scope: "world",
    teams: [180, 195],
    boards: [4, 4],
    reserves: [1, 1],
    week: 28,
    minElo: 1800,
    minReputation: 10,
    prize: 160,
    prestige: 80,
    rounds: 11,
  },
  {
    ...base,
    key: "women-olympiad",
    name: "FIDE Women's Chess Olympiad",
    category: "Women's Chess Olympiad",
    scope: "world",
    teams: [150, 180],
    boards: [4, 4],
    reserves: [1, 1],
    gender: "female",
    week: 29,
    minElo: 1600,
    minReputation: 10,
    prize: 160,
    prestige: 78,
    rounds: 11,
  },
  {
    ...base,
    key: "world-team",
    name: "FIDE World Team Championship",
    category: "World Team Championship",
    scope: "world",
    teams: [12, 12],
    boards: [4, 4],
    reserves: [1, 2],
    week: 32,
    minElo: 2200,
    minReputation: 40,
    prize: 300,
    prestige: 85,
    rounds: 11,
  },
  {
    ...base,
    key: "women-world-team",
    name: "FIDE Women's World Team Championship",
    category: "Women's World Team Championship",
    scope: "world",
    teams: [12, 12],
    boards: [4, 4],
    reserves: [1, 2],
    gender: "female",
    week: 33,
    minElo: 2000,
    minReputation: 30,
    prize: 280,
    prestige: 82,
    rounds: 11,
  },
  {
    ...base,
    key: "online-olympiad",
    name: "FIDE Online Chess Olympiad",
    category: "Online Chess Olympiad",
    scope: "world",
    teams: [150, 160],
    boards: [6, 6],
    reserves: [6, 6],
    slots: ["open", "open", "woman", "woman", "boy-u20", "girl-u20"],
    week: 8,
    minElo: 1400,
    prize: 120,
    prestige: 60,
    rounds: 11,
    timeControl: "rapid",
  },
  {
    ...base,
    key: "disability-olympiad",
    name: "Chess Olympiad for People with Disabilities",
    category: "Disability Chess Olympiad",
    scope: "world",
    teams: [30, 35],
    boards: [4, 4],
    reserves: [1, 1],
    slots: ["woman", "open", "open", "open"],
    abstract: true,
    week: 34,
    minElo: 1200,
    prize: 120,
    prestige: 60,
    rounds: 9,
  },
  {
    ...base,
    key: "youth-u16-olympiad",
    name: "World Youth U16 Chess Olympiad",
    category: "World Youth U16 Olympiad",
    scope: "youth",
    teams: [50, 80],
    boards: [4, 4],
    reserves: [1, 1],
    slots: ["woman", "open", "open", "open"],
    maxAge: 15,
    week: 24,
    minElo: 1200,
    prize: 100,
    prestige: 55,
    rounds: 9,
  },
  {
    ...base,
    key: "senior-team",
    name: "World Senior Team Championship (50+ / 65+)",
    category: "World Senior Team Championship",
    scope: "world",
    teams: [30, 60],
    boards: [4, 4],
    reserves: [1, 1],
    minAge: 50,
    week: 38,
    minElo: 1500,
    prize: 110,
    prestige: 55,
    rounds: 9,
  },
  {
    ...base,
    key: "european-team",
    name: "European Team Chess Championship (Open)",
    category: "European Team Championship",
    scope: "continental",
    teams: [38, 40],
    boards: [4, 4],
    reserves: [1, 1],
    continents: ["Europe"],
    week: 42,
    minElo: 1800,
    minReputation: 10,
    prize: 150,
    prestige: 70,
    rounds: 9,
  },
  {
    ...base,
    key: "european-women-team",
    name: "European Women's Team Championship",
    category: "European Women's Team Championship",
    scope: "continental",
    teams: [30, 36],
    boards: [4, 4],
    reserves: [1, 1],
    gender: "female",
    continents: ["Europe"],
    week: 43,
    minElo: 1600,
    prize: 140,
    prestige: 68,
    rounds: 9,
  },
  {
    ...base,
    key: "asian-nations-cup",
    name: "Asian Nations Cup (Asian Team Championship)",
    category: "Asian Nations Cup",
    scope: "continental",
    teams: [15, 25],
    boards: [4, 4],
    reserves: [1, 1],
    continents: ["Asia"],
    week: 22,
    minElo: 1700,
    prize: 140,
    prestige: 68,
    rounds: 9,
  },
  {
    ...base,
    key: "pan-american-team",
    name: "Pan American Team Chess Championship",
    category: "Pan American Team Championship",
    scope: "continental",
    teams: [8, 12],
    boards: [4, 4],
    reserves: [1, 1],
    continents: ["North America", "South America"],
    week: 18,
    minElo: 1700,
    prize: 130,
    prestige: 62,
    rounds: 9,
  },
  {
    ...base,
    key: "asian-games",
    name: "Asian Games (Chess Team)",
    category: "Asian Games",
    scope: "games",
    teams: [12, 18],
    boards: [4, 4],
    reserves: [1, 1],
    continents: ["Asia"],
    week: 46,
    minElo: 1700,
    prize: 160,
    prestige: 75,
    rounds: 9,
  },
  {
    ...base,
    key: "aimag",
    name: "Asian Indoor and Martial Arts Games (AIMAG)",
    category: "Asian Indoor and Martial Arts Games",
    scope: "games",
    teams: [15, 20],
    boards: [4, 4],
    reserves: [2, 2],
    continents: ["Asia"],
    week: 14,
    minElo: 1500,
    prize: 120,
    prestige: 58,
    rounds: 9,
  },
  {
    ...base,
    key: "sea-games",
    name: "SEA Games (Chess Team)",
    category: "SEA Games",
    scope: "games",
    teams: [6, 8],
    boards: [2, 4],
    reserves: [0, 0],
    countries: SEA,
    week: 10,
    minElo: 1200,
    prize: 100,
    prestige: 55,
    rounds: 7,
  },
  {
    ...base,
    key: "african-games",
    name: "African Games (Mixed Team)",
    category: "African Games",
    scope: "games",
    teams: [15, 20],
    boards: [4, 4],
    reserves: [0, 0],
    slots: ["man", "man", "woman", "woman"],
    continents: ["Africa"],
    week: 6,
    minElo: 1200,
    prize: 100,
    prestige: 55,
    rounds: 9,
  },
  {
    ...base,
    key: "mitropa-cup",
    name: "Mitropa Chess Cup (Central European Nations)",
    category: "Mitropa Cup",
    scope: "continental",
    teams: [10, 10],
    boards: [4, 4],
    reserves: [1, 1],
    countries: MITROPA,
    week: 4,
    minElo: 1800,
    prize: 110,
    prestige: 55,
    rounds: 9,
  },
  {
    ...base,
    key: "european-youth-team",
    name: "European Youth Team Championship (U12 / U18)",
    category: "European Youth Team Championship",
    scope: "youth",
    teams: [20, 35],
    boards: [4, 4],
    reserves: [1, 1],
    maxAge: 17,
    continents: ["Europe"],
    week: 25,
    minElo: 1200,
    prize: 90,
    prestige: 50,
    rounds: 9,
  },
  {
    ...base,
    key: "arab-team",
    name: "Arab Team Chess Championship",
    category: "Arab Team Championship",
    scope: "continental",
    teams: [10, 16],
    boards: [4, 4],
    reserves: [1, 1],
    countries: ARAB,
    week: 2,
    minElo: 1400,
    prize: 100,
    prestige: 50,
    rounds: 9,
  },
  {
    ...base,
    key: "ibero-american-team",
    name: "Ibero-American Team Championship",
    category: "Ibero-American Team Championship",
    scope: "continental",
    teams: [15, 22],
    boards: [4, 4],
    reserves: [1, 1],
    countries: IBERO,
    week: 35,
    minElo: 1500,
    prize: 110,
    prestige: 52,
    rounds: 9,
  },
];

/** Concrete parameters of one generated edition; stored with registrations. */
export interface TeamEventInfo {
  key: string;
  teams: number;
  boards: number;
  reserves: number;
}

export const teamSpec = (key: string): TeamEventSpec | undefined =>
  TEAM_EVENTS.find((e) => e.key === key);

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const within = ([lo, hi]: [number, number], seed: number): number =>
  lo + (seed % (hi - lo + 1));

/** Deterministic edition parameters: the same year always gives the same field. */
export function resolveTeamEvent(
  spec: TeamEventSpec,
  year: number,
): TeamEventInfo {
  const seed = hash(`${spec.key}:${year}`);
  return {
    key: spec.key,
    teams: within(spec.teams, seed),
    boards: within(spec.boards, seed >>> 5),
    reserves: within(spec.reserves, seed >>> 9),
  };
}

/** Parameters of the single annual cup that existed before the catalog. */
export const LEGACY_TEAM_INFO: TeamEventInfo = {
  key: "olympiad",
  teams: 8,
  boards: 4,
  reserves: 1,
};

export const teamInfoOf = (
  details: { teamEvent?: TeamEventInfo } | undefined,
): TeamEventInfo => details?.teamEvent ?? LEGACY_TEAM_INFO;
