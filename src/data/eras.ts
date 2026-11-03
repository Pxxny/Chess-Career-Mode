export interface Era {
  id: string;
  name: string;
  fromYear: number;
  toYear: number;
  summary: string;
  ratings: string;
}

export const ERAS: Era[] = [
  { id: 'soviet-rise', name: 'The Soviet School', fromYear: 1950, toYear: 1969, summary: 'The Soviet school dominates the world title and the Candidates cycle. Players travel by train to correspondence-era congresses.', ratings: 'No official Elo yet: ratings are retrospective estimates.' },
  { id: 'fischer', name: 'The Fischer Years', fromYear: 1970, toYear: 1974, summary: 'Bobby Fischer breaks Soviet dominance and chess goes mainstream.', ratings: 'FIDE introduces the Elo system in 1970.' },
  { id: 'rivalry', name: 'Karpov and Kasparov', fromYear: 1975, toYear: 1989, summary: 'The great rivalry of the Cold War era. Super tournaments appear and grandmaster titles multiply.', ratings: 'Official FIDE ratings, published twice a year.' },
  { id: 'computers', name: 'Computers Arrive', fromYear: 1990, toYear: 1999, summary: 'Kasparov reigns as engines improve. Deep Blue beats him in 1997. The Soviet Union dissolves into new federations.', ratings: 'Official FIDE ratings, rising slowly.' },
  { id: 'engines', name: 'The Engine Age', fromYear: 2000, toYear: 2009, summary: 'Kramnik, Anand and Topalov lead the world while teenage prodigies such as Carlsen emerge. Engines transform preparation.', ratings: 'Official FIDE ratings, monthly from 2012.' },
  { id: 'carlsen', name: 'The Carlsen Years', fromYear: 2010, toYear: 2019, summary: 'Magnus Carlsen sets record ratings. Online play and the Grand Chess Tour reshape the circuit.', ratings: 'Official FIDE ratings.' },
  { id: 'online', name: 'The Online Era', fromYear: 2020, toYear: 2026, summary: 'Online chess booms, a new generation of young grandmasters rises and engines are central to training.', ratings: 'Official FIDE ratings.' },
];

export const getEra = (year: number): Era =>
  ERAS.find((e) => year >= e.fromYear && year <= e.toYear) ?? ERAS[ERAS.length - 1];
