import type { PlayStyle } from '@/types';
import { OPENINGS } from './openings';

/**
 * The opening database used by training. Every entry has a main line in standard algebraic notation,
 * validated move by move against the rules engine by `npm run test:world`.
 * Ids of the original opening list are kept so NPC repertoires and archetype suggestions keep working.
 */
export interface BookOpening {
  id: string;
  name: string;
  eco: string;
  /** The side that normally plays the opening */
  side: 'white' | 'black';
  family: string;
  styles: PlayStyle[];
  /** Main line, SAN, space separated */
  line: string;
  /** Extra search words */
  aliases?: string[];
}

type Entry = Omit<BookOpening, 'styles' | 'side' | 'eco' | 'name'> & Partial<Pick<BookOpening, 'styles' | 'side' | 'eco' | 'name'>>;

const LINES: Entry[] = [
  { id: 'ruy-lopez', family: 'Open Games', line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', aliases: ['spanish'] },
  { id: 'italian', family: 'Open Games', line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', aliases: ['giuoco piano'] },
  { id: 'scotch', family: 'Open Games', line: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7' },
  { id: 'kings-gambit', family: 'Open Games', line: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6' },
  { id: 'vienna', family: 'Open Games', line: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7' },
  { id: 'evans-gambit', name: 'Evans Gambit', eco: 'C51', side: 'white', family: 'Open Games', styles: ['attacking', 'tactical'], line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O Nge7' },
  { id: 'four-knights', name: 'Four Knights Game', eco: 'C47', side: 'white', family: 'Open Games', styles: ['solid', 'universal'], line: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6' },
  { id: 'queens-gambit', family: "Queen's Gambit", line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6' },
  { id: 'london', family: 'Queen Pawn Games', line: 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6' },
  { id: 'colle', name: 'Colle System', eco: 'D05', side: 'white', family: 'Queen Pawn Games', styles: ['solid', 'positional'], line: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6' },
  { id: 'catalan', family: "Queen's Gambit", line: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4' },
  { id: 'english', family: 'Flank Openings', line: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6' },
  { id: 'reti', family: 'Flank Openings', line: 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3 c5' },
  { id: 'kings-indian-attack', name: "King's Indian Attack", eco: 'A07', side: 'white', family: 'Flank Openings', styles: ['solid', 'prophylactic'], line: 'Nf3 d5 g3 Nf6 Bg2 c5 O-O Nc6 d3 e6' },
  { id: 'trompowsky', family: 'Queen Pawn Games', line: 'd4 Nf6 Bg5 Ne4 Bf4 c5 f3 Qa5+ c3 Nf6 d5 Qb6' },
  { id: 'birds', family: 'Flank Openings', line: 'f4 d5 Nf3 Nf6 e3 g6 b3 Bg7 Bb2 O-O' },
  { id: 'sicilian', name: 'Sicilian Defence', eco: 'B30', side: 'black', family: 'Sicilian', styles: ['attacking', 'dynamic', 'tactical'], line: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bg5 e6', aliases: ['sicilian defense'] },
  { id: 'sicilian-najdorf', family: 'Sicilian', line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6' },
  { id: 'sicilian-dragon', family: 'Sicilian', line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O' },
  { id: 'sicilian-sveshnikov', name: 'Sicilian Sveshnikov', eco: 'B33', side: 'black', family: 'Sicilian', styles: ['dynamic', 'tactical'], line: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5' },
  { id: 'caro-kann', family: 'Semi-Open', line: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6', aliases: ['caro-kann defense'] },
  { id: 'caro-kann-advance', name: 'Caro-Kann Advance', eco: 'B12', side: 'black', family: 'Semi-Open', styles: ['solid', 'positional'], line: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6' },
  { id: 'french', family: 'Semi-Open', line: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7', aliases: ['french defense'] },
  { id: 'french-winawer', name: 'French Winawer', eco: 'C15', side: 'black', family: 'Semi-Open', styles: ['dynamic', 'tactical'], line: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7' },
  { id: 'pirc', family: 'Semi-Open', line: 'e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O' },
  { id: 'scandinavian', family: 'Semi-Open', line: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6' },
  { id: 'alekhine', family: 'Semi-Open', line: 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7' },
  { id: 'philidor', name: 'Philidor Defence', eco: 'C41', side: 'black', family: 'Open Games', styles: ['solid', 'defensive'], line: 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O', aliases: ['philidor defense'] },
  { id: 'berlin', family: 'Open Games', line: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5' },
  { id: 'petroff', family: 'Open Games', line: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6' },
  { id: 'kings-indian', family: 'Indian Defences', line: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5', aliases: ["king's indian defense", 'kid'] },
  { id: 'nimzo-indian', family: 'Indian Defences', line: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5' },
  { id: 'grunfeld', family: 'Indian Defences', line: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7', aliases: ['grunfeld defense'] },
  { id: 'queens-indian', family: 'Indian Defences', line: 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7' },
  { id: 'benoni', family: 'Indian Defences', line: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6' },
  { id: 'slav', family: "Queen's Gambit", line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6' },
  { id: 'semi-slav', family: "Queen's Gambit", line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5' },
  { id: 'qgd', family: "Queen's Gambit", line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7' },
  { id: 'qga', name: "Queen's Gambit Accepted", eco: 'D20', side: 'black', family: "Queen's Gambit", styles: ['dynamic', 'universal'], line: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6' },
  { id: 'dutch', family: 'Indian Defences', line: 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6', aliases: ['dutch defense'] },
];

const ORIGINAL = new Map(OPENINGS.map((o) => [o.id, o]));

export const OPENING_BOOK: BookOpening[] = LINES.map((entry) => {
  const base = ORIGINAL.get(entry.id);
  const name = entry.name ?? base?.name;
  const eco = entry.eco ?? base?.eco;
  const side = entry.side ?? base?.side;
  const styles = entry.styles ?? base?.styles;
  if (!name || !eco || !side || !styles) throw new Error(`Opening ${entry.id} is not in the original list and is missing details.`);
  return { ...entry, name, eco, side, styles };
});

const BY_ID = new Map(OPENING_BOOK.map((o) => [o.id, o]));
export const getBookOpening = (id: string): BookOpening | undefined => BY_ID.get(id);
export const bookMoves = (opening: BookOpening): string[] => opening.line.split(/\s+/);
export const OPENING_FAMILIES: string[] = [...new Set(OPENING_BOOK.map((o) => o.family))];
