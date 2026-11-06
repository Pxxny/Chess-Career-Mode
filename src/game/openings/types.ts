export type Side = 'white' | 'black';

/** 0 to 5: how common the opening was in an era. Eras: before 1900, 1900-1945, 1946-1989, 1990-2009, 2010 onwards. */
export type EraProfile = [number, number, number, number, number];
export const ERA_LABELS = ['Before 1900', '1900-1945', '1946-1989', '1990-2009', '2010 onwards'] as const;

/** Real numbers taken from an imported PGN game collection. They replace the estimated popularity. */
export interface UsageStats {
  source: string;
  games: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
  /** Games per decade, keyed by the decade's first year ("1990") */
  byDecade: Record<string, number>;
}

/** An opening added from a PGN file. */
export interface CustomOpening {
  id: string;
  eco: string;
  name: string;
  /** SAN moves */
  moves: string[];
  side?: Side;
  description?: string;
  source: string;
}

export interface OpeningEntry {
  id: string;
  eco: string;
  /** Full name, e.g. "Sicilian Defense: Najdorf Variation, English Attack" */
  name: string;
  /** Opening family, e.g. "Sicilian Defense" */
  family: string;
  /** Everything after the family name, or null for the family's own line */
  variation: string | null;
  /** SAN moves from the starting position */
  moves: string[];
  line: string;
  /** Half-moves in the line */
  depth: number;
  /** The longest shorter opening this line grows out of */
  parentId: string | null;
  childIds: string[];
  /** Openings below this one in the tree */
  descendants: number;
  /** The side that normally chooses the line */
  side: Side;
  /** First move, e.g. "e4", "d4", "Nf3" */
  firstMove: string;
  /** 1 (easy to learn) to 5 (heavy theory) */
  difficulty: number;
  /** 1 (rare) to 5 (very common at the top level) */
  popularity: number;
  eras: EraProfile;
  description: string;
  /** On the family's main line */
  isMainLine: boolean;
  source: 'eco' | 'custom';
  /** True when popularity, difficulty and usage are editorial estimates rather than counted from games */
  estimated: boolean;
  usage?: UsageStats;
}

export interface FamilyInfo {
  name: string;
  rootId: string;
  entryIds: string[];
  /** Lowest and highest ECO code */
  ecoFrom: string;
  ecoTo: string;
  side: Side;
  firstMove: string;
  /** Last entry on the main line */
  mainLineId: string;
  popularity: number;
  difficulty: number;
}

export interface Classification {
  entry: OpeningEntry;
  /** Half-moves that stay inside the opening tree (the game may leave the tree after this) */
  bookPlies: number;
}
