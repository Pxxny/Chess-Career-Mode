import type { PlayStyle } from '@/types';

export interface Opening {
  id: string;
  name: string;
  eco: string;
  side: 'white' | 'black';
  styles: PlayStyle[];
}

export const OPENINGS: Opening[] = [
  { id: 'ruy-lopez', name: 'Ruy Lopez', eco: 'C60', side: 'white', styles: ['positional', 'solid', 'universal'] },
  { id: 'italian', name: 'Italian Game', eco: 'C50', side: 'white', styles: ['universal', 'solid'] },
  { id: 'scotch', name: 'Scotch Game', eco: 'C45', side: 'white', styles: ['attacking', 'tactical'] },
  { id: 'kings-gambit', name: "King's Gambit", eco: 'C30', side: 'white', styles: ['attacking', 'dynamic'] },
  { id: 'vienna', name: 'Vienna Game', eco: 'C25', side: 'white', styles: ['attacking', 'universal'] },
  { id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06', side: 'white', styles: ['positional', 'universal', 'solid'] },
  { id: 'london', name: 'London System', eco: 'D02', side: 'white', styles: ['solid', 'defensive', 'prophylactic'] },
  { id: 'catalan', name: 'Catalan Opening', eco: 'E00', side: 'white', styles: ['positional', 'prophylactic'] },
  { id: 'english', name: 'English Opening', eco: 'A10', side: 'white', styles: ['positional', 'dynamic', 'universal'] },
  { id: 'reti', name: 'Réti Opening', eco: 'A04', side: 'white', styles: ['prophylactic', 'positional'] },
  { id: 'trompowsky', name: 'Trompowsky Attack', eco: 'A45', side: 'white', styles: ['dynamic', 'tactical'] },
  { id: 'birds', name: "Bird's Opening", eco: 'A02', side: 'white', styles: ['dynamic', 'attacking'] },
  { id: 'sicilian-najdorf', name: 'Sicilian Najdorf', eco: 'B90', side: 'black', styles: ['attacking', 'tactical', 'dynamic'] },
  { id: 'sicilian-dragon', name: 'Sicilian Dragon', eco: 'B70', side: 'black', styles: ['attacking', 'tactical'] },
  { id: 'caro-kann', name: 'Caro-Kann Defence', eco: 'B10', side: 'black', styles: ['solid', 'defensive', 'positional'] },
  { id: 'french', name: 'French Defence', eco: 'C00', side: 'black', styles: ['defensive', 'positional', 'solid'] },
  { id: 'pirc', name: 'Pirc Defence', eco: 'B07', side: 'black', styles: ['dynamic', 'defensive'] },
  { id: 'scandinavian', name: 'Scandinavian Defence', eco: 'B01', side: 'black', styles: ['solid', 'defensive'] },
  { id: 'alekhine', name: "Alekhine's Defence", eco: 'B02', side: 'black', styles: ['dynamic'] },
  { id: 'kings-indian', name: "King's Indian Defence", eco: 'E60', side: 'black', styles: ['attacking', 'dynamic'] },
  { id: 'nimzo-indian', name: 'Nimzo-Indian Defence', eco: 'E20', side: 'black', styles: ['positional', 'universal'] },
  { id: 'grunfeld', name: 'Grünfeld Defence', eco: 'D80', side: 'black', styles: ['dynamic', 'tactical', 'attacking'] },
  { id: 'queens-indian', name: "Queen's Indian Defence", eco: 'E12', side: 'black', styles: ['positional', 'prophylactic'] },
  { id: 'slav', name: 'Slav Defence', eco: 'D10', side: 'black', styles: ['solid', 'positional', 'defensive'] },
  { id: 'semi-slav', name: 'Semi-Slav Defence', eco: 'D43', side: 'black', styles: ['tactical', 'dynamic'] },
  { id: 'qgd', name: "Queen's Gambit Declined", eco: 'D30', side: 'black', styles: ['solid', 'universal'] },
  { id: 'dutch', name: 'Dutch Defence', eco: 'A80', side: 'black', styles: ['attacking', 'dynamic'] },
  { id: 'berlin', name: 'Berlin Defence', eco: 'C65', side: 'black', styles: ['defensive', 'prophylactic', 'solid'] },
  { id: 'petroff', name: 'Petroff Defence', eco: 'C42', side: 'black', styles: ['defensive', 'solid'] },
  { id: 'benoni', name: 'Modern Benoni', eco: 'A60', side: 'black', styles: ['attacking', 'dynamic'] },
];

const BY_ID = new Map(OPENINGS.map((o) => [o.id, o]));
export const getOpening = (id: string): Opening | undefined => BY_ID.get(id);
