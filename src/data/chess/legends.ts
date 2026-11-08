import type { Personality, PlayStyle, SkillKey } from '@/types';

/**
 * Historical chess legends. Dates and results are best-effort. Elo values before
 * 1970 are retrospective estimates ("estimate"); later values are FIDE-era
 * ("official") figures rounded to the nearest few points. `city` is the city
 * the player is most associated with, and `country` the nationality they
 * mainly represented.
 */
export interface LegendSeed {
  gender?: 'male' | 'female';
  title?: 'none' | 'GM';
  slug: string;
  name: string;
  country: string;
  city: string;
  dob: string;
  deathDate?: string;
  activeFrom: number;
  /** null = still active */
  activeTo: number | null;
  peakYear: number;
  peakElo: number;
  eloSource: 'official' | 'estimate';
  /** [year, elo] points; Elo between points is interpolated */
  ratings: Array<[number, number]>;
  titles: string[];
  style: PlayStyle;
  personality: Personality;
  strengths: SkillKey[];
  weaknesses: SkillKey[];
  openings: string[];
  /** [year, event, rank, fieldSize] */
  events: Array<[number, string, number, number]>;
}

export const LEGENDS: LegendSeed[] = [
  { slug: 'paul-morphy', name: 'Paul Morphy', country: 'US', city: 'New Orleans', dob: '1837-06-22', deathDate: '1884-07-10', activeFrom: 1850, activeTo: 1862, peakYear: 1859, peakElo: 2650, eloSource: 'estimate', ratings: [[1850, 2450], [1858, 2620], [1859, 2650], [1862, 2600]], titles: ['Unofficial World Champion'], style: 'attacking', personality: 'creative', strengths: ['tactics', 'opening', 'calculation'], weaknesses: ['psychology', 'endgame'], openings: ['kings-gambit', 'italian', 'scotch', 'french'], events: [[1857, 'First American Chess Congress', 1, 16]] },
  { slug: 'wilhelm-steinitz', name: 'Wilhelm Steinitz', country: 'US', city: 'New York', dob: '1836-05-17', deathDate: '1900-08-12', activeFrom: 1862, activeTo: 1899, peakYear: 1876, peakElo: 2640, eloSource: 'estimate', ratings: [[1862, 2500], [1876, 2640], [1886, 2620], [1899, 2500]], titles: ['World Champion 1886–1894'], style: 'positional', personality: 'stubborn', strengths: ['strategy', 'middlegame', 'endgame'], weaknesses: ['timeManagement', 'psychology'], openings: ['ruy-lopez', 'italian', 'vienna', 'french'], events: [[1886, 'World Championship match vs Zukertort', 1, 2]] },
  { slug: 'emanuel-lasker', name: 'Emanuel Lasker', country: 'DE', city: 'Berlin', dob: '1868-12-24', deathDate: '1941-01-11', activeFrom: 1889, activeTo: 1935, peakYear: 1896, peakElo: 2720, eloSource: 'estimate', ratings: [[1889, 2550], [1896, 2720], [1914, 2700], [1935, 2600]], titles: ['World Champion 1894–1921'], style: 'universal', personality: 'fearless', strengths: ['psychology', 'endgame', 'middlegame'], weaknesses: ['opening'], openings: ['ruy-lopez', 'queens-gambit', 'french', 'qgd'], events: [[1894, 'World Championship match vs Steinitz', 1, 2]] },
  { slug: 'jose-raul-capablanca', name: 'José Raúl Capablanca', country: 'CU', city: 'Havana', dob: '1888-11-19', deathDate: '1942-03-08', activeFrom: 1901, activeTo: 1939, peakYear: 1921, peakElo: 2725, eloSource: 'estimate', ratings: [[1901, 2450], [1914, 2680], [1921, 2725], [1939, 2650]], titles: ['World Champion 1921–1927'], style: 'positional', personality: 'calm', strengths: ['endgame', 'strategy', 'middlegame'], weaknesses: ['opening', 'timeManagement'], openings: ['queens-gambit', 'ruy-lopez', 'qgd', 'french'], events: [[1921, 'World Championship match vs Lasker', 1, 2], [1927, 'New York International', 1, 6]] },
  { slug: 'alexander-alekhine', name: 'Alexander Alekhine', country: 'FR', city: 'Paris', dob: '1892-10-31', deathDate: '1946-03-24', activeFrom: 1908, activeTo: 1946, peakYear: 1930, peakElo: 2715, eloSource: 'estimate', ratings: [[1908, 2450], [1927, 2700], [1930, 2715], [1946, 2600]], titles: ['World Champion 1927–1935, 1937–1946'], style: 'attacking', personality: 'ambitious', strengths: ['tactics', 'calculation', 'opening'], weaknesses: ['psychology'], openings: ['queens-gambit', 'ruy-lopez', 'alekhine', 'french'], events: [[1927, 'World Championship match vs Capablanca', 1, 2], [1931, 'Bled International', 1, 15]] },
  { slug: 'aron-nimzowitsch', name: 'Aron Nimzowitsch', country: 'DK', city: 'Copenhagen', dob: '1886-11-07', deathDate: '1935-03-16', activeFrom: 1904, activeTo: 1934, peakYear: 1926, peakElo: 2640, eloSource: 'estimate', ratings: [[1904, 2400], [1926, 2640], [1934, 2580]], titles: ['Chess theorist and author of My System'], style: 'prophylactic', personality: 'stubborn', strengths: ['strategy', 'middlegame'], weaknesses: ['psychology', 'timeManagement'], openings: ['english', 'reti', 'nimzo-indian', 'french'], events: [] },
  { slug: 'akiba-rubinstein', name: 'Akiba Rubinstein', country: 'PL', city: 'Lodz', dob: '1880-12-01', deathDate: '1961-03-14', activeFrom: 1903, activeTo: 1932, peakYear: 1912, peakElo: 2680, eloSource: 'estimate', ratings: [[1903, 2450], [1912, 2680], [1932, 2550]], titles: ['Master of the rook endgame'], style: 'positional', personality: 'reserved', strengths: ['endgame', 'strategy', 'calculation'], weaknesses: ['psychology', 'timeManagement'], openings: ['queens-gambit', 'ruy-lopez', 'qgd', 'slav'], events: [] },
  { slug: 'max-euwe', name: 'Max Euwe', country: 'NL', city: 'Amsterdam', dob: '1901-05-20', deathDate: '1981-11-26', activeFrom: 1920, activeTo: 1963, peakYear: 1935, peakElo: 2650, eloSource: 'estimate', ratings: [[1920, 2450], [1935, 2650], [1963, 2550]], titles: ['World Champion 1935–1937', 'FIDE President 1970–1978'], style: 'universal', personality: 'methodical', strengths: ['calculation', 'opening', 'middlegame'], weaknesses: ['psychology'], openings: ['queens-gambit', 'ruy-lopez', 'qgd', 'nimzo-indian'], events: [[1935, 'World Championship match vs Alekhine', 1, 2]] },
  { slug: 'mikhail-botvinnik', name: 'Mikhail Botvinnik', country: 'RU', city: 'Saint Petersburg', dob: '1911-08-17', deathDate: '1995-05-05', activeFrom: 1925, activeTo: 1970, peakYear: 1948, peakElo: 2700, eloSource: 'estimate', ratings: [[1925, 2400], [1938, 2680], [1948, 2700], [1970, 2600]], titles: ['World Champion 1948–1957, 1958–1960, 1961–1963'], style: 'positional', personality: 'perfectionist', strengths: ['strategy', 'opening', 'middlegame'], weaknesses: ['timeManagement'], openings: ['english', 'queens-gambit', 'nimzo-indian', 'slav'], events: [] },
  { slug: 'paul-keres', name: 'Paul Keres', country: 'EE', city: 'Tallinn', dob: '1916-01-07', deathDate: '1975-06-05', activeFrom: 1930, activeTo: 1975, peakYear: 1955, peakElo: 2690, eloSource: 'estimate', ratings: [[1930, 2400], [1955, 2690], [1975, 2610]], titles: ['Candidates Tournament winner 1965 (match)'], style: 'tactical', personality: 'calm', strengths: ['tactics', 'opening', 'calculation'], weaknesses: ['psychology'], openings: ['ruy-lopez', 'scotch', 'sicilian-najdorf', 'queens-gambit'], events: [] },
  { slug: 'vasily-smyslov', name: 'Vasily Smyslov', country: 'RU', city: 'Moscow', dob: '1921-03-24', deathDate: '2010-03-27', activeFrom: 1938, activeTo: 2001, peakYear: 1957, peakElo: 2690, eloSource: 'estimate', ratings: [[1938, 2450], [1957, 2690], [1983, 2640], [2001, 2500]], titles: ['World Champion 1957–1958'], style: 'positional', personality: 'calm', strengths: ['endgame', 'strategy', 'middlegame'], weaknesses: ['timeManagement'], openings: ['english', 'queens-gambit', 'nimzo-indian', 'ruy-lopez'], events: [[1957, 'World Championship match vs Botvinnik', 1, 2]] },
  { slug: 'mikhail-tal', name: 'Mikhail Tal', country: 'LV', city: 'Riga', dob: '1936-11-09', deathDate: '1992-06-28', activeFrom: 1953, activeTo: 1992, peakYear: 1980, peakElo: 2705, eloSource: 'official', ratings: [[1953, 2350], [1960, 2690], [1980, 2705], [1992, 2600]], titles: ['World Champion 1960–1961'], style: 'attacking', personality: 'fearless', strengths: ['tactics', 'calculation', 'psychology'], weaknesses: ['endgame', 'timeManagement'], openings: ['sicilian-najdorf', 'kings-gambit', 'kings-indian', 'caro-kann'], events: [[1960, 'World Championship match vs Botvinnik', 1, 2]] },
  { slug: 'tigran-petrosian', name: 'Tigran Petrosian', country: 'AM', city: 'Yerevan', dob: '1929-06-17', deathDate: '1984-08-13', activeFrom: 1946, activeTo: 1983, peakYear: 1971, peakElo: 2645, eloSource: 'official', ratings: [[1946, 2400], [1963, 2630], [1971, 2645], [1983, 2600]], titles: ['World Champion 1963–1969'], style: 'prophylactic', personality: 'reserved', strengths: ['strategy', 'psychology', 'endgame'], weaknesses: ['tactics'], openings: ['queens-indian', 'caro-kann', 'english', 'kings-indian'], events: [[1963, 'World Championship match vs Botvinnik', 1, 2]] },
  { slug: 'boris-spassky', name: 'Boris Spassky', country: 'RU', city: 'Saint Petersburg', dob: '1937-01-30', deathDate: '2025-02-27', activeFrom: 1955, activeTo: 2010, peakYear: 1971, peakElo: 2690, eloSource: 'official', ratings: [[1955, 2400], [1969, 2680], [1971, 2690], [1992, 2560], [2010, 2450]], titles: ['World Champion 1969–1972'], style: 'universal', personality: 'sociable', strengths: ['middlegame', 'tactics', 'strategy'], weaknesses: ['timeManagement'], openings: ['ruy-lopez', 'kings-gambit', 'french', 'kings-indian'], events: [[1969, 'World Championship match vs Petrosian', 1, 2]] },
  { slug: 'bobby-fischer', name: 'Bobby Fischer', country: 'US', city: 'Chicago', dob: '1943-03-09', deathDate: '2008-01-17', activeFrom: 1956, activeTo: 1975, peakYear: 1972, peakElo: 2785, eloSource: 'official', ratings: [[1956, 2300], [1964, 2700], [1972, 2785], [1975, 2780]], titles: ['World Champion 1972–1975 (retired from competition 1975, rematch with Spassky in 1992)'], style: 'universal', personality: 'perfectionist', strengths: ['opening', 'calculation', 'endgame'], weaknesses: ['psychology'], openings: ['ruy-lopez', 'sicilian-najdorf', 'kings-indian', 'grunfeld'], events: [[1972, 'World Championship match vs Spassky', 1, 2]] },
  { slug: 'viktor-korchnoi', name: 'Viktor Korchnoi', country: 'CH', city: 'Zurich', dob: '1931-03-23', deathDate: '2016-06-06', activeFrom: 1947, activeTo: 2016, peakYear: 1979, peakElo: 2695, eloSource: 'official', ratings: [[1947, 2300], [1979, 2695], [2000, 2630], [2016, 2500]], titles: ['Two-time World Championship finalist'], style: 'dynamic', personality: 'stubborn', strengths: ['calculation', 'middlegame', 'psychology'], weaknesses: ['timeManagement'], openings: ['english', 'queens-gambit', 'french', 'nimzo-indian'], events: [] },
  { slug: 'bent-larsen', name: 'Bent Larsen', country: 'DK', city: 'Copenhagen', dob: '1935-03-04', deathDate: '2010-09-09', activeFrom: 1954, activeTo: 2010, peakYear: 1971, peakElo: 2660, eloSource: 'official', ratings: [[1954, 2350], [1971, 2660], [1990, 2550], [2010, 2400]], titles: ['Candidates semi-finalist 1968, 1971'], style: 'dynamic', personality: 'creative', strengths: ['middlegame', 'tactics'], weaknesses: ['endgame', 'timeManagement'], openings: ['birds', 'english', 'sicilian-dragon', 'pirc'], events: [] },
  { slug: 'anatoly-karpov', name: 'Anatoly Karpov', country: 'RU', city: 'Zlatoust', dob: '1951-05-23', activeFrom: 1966, activeTo: 2010, peakYear: 1994, peakElo: 2780, eloSource: 'official', ratings: [[1966, 2300], [1975, 2705], [1985, 2720], [1994, 2780], [2010, 2620]], titles: ['World Champion 1975–1985 (FIDE 1993–1999)'], style: 'prophylactic', personality: 'methodical', strengths: ['strategy', 'endgame', 'psychology'], weaknesses: ['timeManagement'], openings: ['ruy-lopez', 'queens-gambit', 'caro-kann', 'nimzo-indian'], events: [[1994, 'Linares', 1, 14]] },
  { slug: 'garry-kasparov', name: 'Garry Kasparov', country: 'RU', city: 'Moscow', dob: '1963-04-13', activeFrom: 1978, activeTo: 2005, peakYear: 1999, peakElo: 2851, eloSource: 'official', ratings: [[1978, 2380], [1985, 2700], [1990, 2800], [1999, 2851], [2005, 2812]], titles: ['World Champion 1985–2000'], style: 'dynamic', personality: 'ambitious', strengths: ['opening', 'tactics', 'calculation'], weaknesses: ['timeManagement'], openings: ['sicilian-najdorf', 'ruy-lopez', 'kings-indian', 'grunfeld'], events: [[1999, 'Linares', 1, 8]] },
  { slug: 'vladimir-kramnik', name: 'Vladimir Kramnik', country: 'RU', city: 'Tuapse', dob: '1975-06-25', activeFrom: 1990, activeTo: 2019, peakYear: 2016, peakElo: 2817, eloSource: 'official', ratings: [[1990, 2400], [2000, 2790], [2008, 2799], [2016, 2817], [2019, 2780]], titles: ['World Champion 2000–2007'], style: 'positional', personality: 'calm', strengths: ['strategy', 'opening', 'endgame'], weaknesses: ['timeManagement'], openings: ['berlin', 'catalan', 'queens-gambit', 'slav'], events: [[2000, 'World Championship match vs Kasparov', 1, 2], [2006, 'World Championship match vs Topalov', 1, 2]] },
  { slug: 'veselin-topalov', name: 'Veselin Topalov', country: 'BG', city: 'Sofia', dob: '1975-03-15', activeFrom: 1990, activeTo: 2020, peakYear: 2015, peakElo: 2816, eloSource: 'official', ratings: [[1990, 2400], [2005, 2800], [2015, 2816], [2020, 2740]], titles: ['FIDE World Champion 2005–2006'], style: 'attacking', personality: 'fiery', strengths: ['tactics', 'calculation', 'opening'], weaknesses: ['psychology'], openings: ['sicilian-najdorf', 'queens-gambit', 'kings-indian', 'slav'], events: [] },
  { slug: 'viswanathan-anand', name: 'Viswanathan Anand', country: 'IN', city: 'Chennai', dob: '1969-12-11', activeFrom: 1985, activeTo: null, peakYear: 2011, peakElo: 2817, eloSource: 'official', ratings: [[1985, 2400], [1991, 2650], [2000, 2762], [2008, 2803], [2011, 2817], [2016, 2770], [2022, 2756], [2026, 2750]], titles: ['World Champion 2007–2013'], style: 'universal', personality: 'sociable', strengths: ['calculation', 'timeManagement', 'opening'], weaknesses: ['psychology'], openings: ['sicilian-najdorf', 'ruy-lopez', 'slav', 'semi-slav'], events: [[2008, 'World Championship match vs Kramnik', 1, 2]] },
  { slug: 'magnus-carlsen', name: 'Magnus Carlsen', country: 'NO', city: 'Tonsberg', dob: '1990-11-30', activeFrom: 2004, activeTo: null, peakYear: 2014, peakElo: 2882, eloSource: 'official', ratings: [[2004, 2484], [2006, 2625], [2010, 2826], [2014, 2882], [2019, 2876], [2023, 2853], [2026, 2840]], titles: ['World Champion 2013–2023'], style: 'universal', personality: 'ambitious', strengths: ['endgame', 'strategy', 'psychology'], weaknesses: ['opening'], openings: ['ruy-lopez', 'english', 'catalan', 'berlin'], events: [[2013, 'World Championship match vs Anand', 1, 2]] },
];

// Additional curated identities; all added rating curves are gameplay estimates.
LEGENDS.push(...[
  {
    "slug": "johannes-zukertort",
    "name": "Johannes Zukertort",
    "country": "PL",
    "city": "National circuit",
    "dob": "1842-09-07",
    "activeFrom": 1862,
    "activeTo": 1888,
    "peakYear": 1886,
    "peakElo": 2620,
    "eloSource": "estimate",
    "ratings": [
      [
        1862,
        2400
      ],
      [
        1886,
        2620
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1888-06-20"
  },
  {
    "slug": "siegbert-tarrasch",
    "name": "Siegbert Tarrasch",
    "country": "DE",
    "city": "National circuit",
    "dob": "1862-03-05",
    "activeFrom": 1883,
    "activeTo": 1928,
    "peakYear": 1894,
    "peakElo": 2660,
    "eloSource": "estimate",
    "ratings": [
      [
        1883,
        2400
      ],
      [
        1894,
        2660
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1934-02-17"
  },
  {
    "slug": "harry-pillsbury",
    "name": "Harry Pillsbury",
    "country": "US",
    "city": "National circuit",
    "dob": "1872-12-05",
    "activeFrom": 1892,
    "activeTo": 1904,
    "peakYear": 1896,
    "peakElo": 2640,
    "eloSource": "estimate",
    "ratings": [
      [
        1892,
        2400
      ],
      [
        1896,
        2640
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1906-06-17"
  },
  {
    "slug": "frank-marshall",
    "name": "Frank Marshall",
    "country": "US",
    "city": "National circuit",
    "dob": "1877-08-10",
    "activeFrom": 1899,
    "activeTo": 1936,
    "peakYear": 1913,
    "peakElo": 2630,
    "eloSource": "estimate",
    "ratings": [
      [
        1899,
        2400
      ],
      [
        1913,
        2630
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1944-11-09"
  },
  {
    "slug": "savielly-tartakower",
    "name": "Savielly Tartakower",
    "country": "PL",
    "city": "National circuit",
    "dob": "1887-02-21",
    "activeFrom": 1906,
    "activeTo": 1950,
    "peakYear": 1929,
    "peakElo": 2580,
    "eloSource": "estimate",
    "ratings": [
      [
        1906,
        2400
      ],
      [
        1929,
        2580
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1956-02-04"
  },
  {
    "slug": "rudolf-spielmann",
    "name": "Rudolf Spielmann",
    "country": "AT",
    "city": "National circuit",
    "dob": "1883-05-05",
    "activeFrom": 1904,
    "activeTo": 1939,
    "peakYear": 1926,
    "peakElo": 2610,
    "eloSource": "estimate",
    "ratings": [
      [
        1904,
        2400
      ],
      [
        1926,
        2610
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1942-08-20"
  },
  {
    "slug": "reuben-fine",
    "name": "Reuben Fine",
    "country": "US",
    "city": "National circuit",
    "dob": "1914-10-11",
    "activeFrom": 1932,
    "activeTo": 1951,
    "peakYear": 1938,
    "peakElo": 2690,
    "eloSource": "estimate",
    "ratings": [
      [
        1932,
        2400
      ],
      [
        1938,
        2690
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1993-03-26"
  },
  {
    "slug": "samuel-reshevsky",
    "name": "Samuel Reshevsky",
    "country": "US",
    "city": "National circuit",
    "dob": "1911-11-26",
    "activeFrom": 1920,
    "activeTo": 1990,
    "peakYear": 1953,
    "peakElo": 2680,
    "eloSource": "estimate",
    "ratings": [
      [
        1920,
        2400
      ],
      [
        1953,
        2680
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1992-04-04"
  },
  {
    "slug": "david-bronstein",
    "name": "David Bronstein",
    "country": "UA",
    "city": "National circuit",
    "dob": "1924-02-19",
    "activeFrom": 1940,
    "activeTo": 1996,
    "peakYear": 1951,
    "peakElo": 2690,
    "eloSource": "estimate",
    "ratings": [
      [
        1940,
        2400
      ],
      [
        1951,
        2690
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "2006-12-05"
  },
  {
    "slug": "efim-geller",
    "name": "Efim Geller",
    "country": "UA",
    "city": "National circuit",
    "dob": "1925-03-08",
    "activeFrom": 1947,
    "activeTo": 1995,
    "peakYear": 1962,
    "peakElo": 2670,
    "eloSource": "estimate",
    "ratings": [
      [
        1947,
        2400
      ],
      [
        1962,
        2670
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1998-11-17"
  },
  {
    "slug": "miguel-najdorf",
    "name": "Miguel Najdorf",
    "country": "AR",
    "city": "National circuit",
    "dob": "1910-04-15",
    "activeFrom": 1929,
    "activeTo": 1992,
    "peakYear": 1950,
    "peakElo": 2660,
    "eloSource": "estimate",
    "ratings": [
      [
        1929,
        2400
      ],
      [
        1950,
        2660
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "1997-07-04"
  },
  {
    "slug": "svetozar-gligoric",
    "name": "Svetozar Gligoric",
    "country": "RS",
    "city": "National circuit",
    "dob": "1923-02-02",
    "activeFrom": 1939,
    "activeTo": 2000,
    "peakYear": 1958,
    "peakElo": 2650,
    "eloSource": "estimate",
    "ratings": [
      [
        1939,
        2400
      ],
      [
        1958,
        2650
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male",
    "deathDate": "2012-08-14"
  },
  {
    "slug": "lajos-portisch",
    "name": "Lajos Portisch",
    "country": "HU",
    "city": "National circuit",
    "dob": "1937-04-04",
    "activeFrom": 1955,
    "activeTo": 2010,
    "peakYear": 1980,
    "peakElo": 2655,
    "eloSource": "estimate",
    "ratings": [
      [
        1955,
        2400
      ],
      [
        1980,
        2655
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "ljubomir-ljubojevic",
    "name": "Ljubomir Ljubojevic",
    "country": "RS",
    "city": "National circuit",
    "dob": "1950-11-02",
    "activeFrom": 1968,
    "activeTo": 2010,
    "peakYear": 1983,
    "peakElo": 2645,
    "eloSource": "estimate",
    "ratings": [
      [
        1968,
        2400
      ],
      [
        1983,
        2645
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "jan-timman",
    "name": "Jan Timman",
    "country": "NL",
    "city": "National circuit",
    "dob": "1951-12-14",
    "activeFrom": 1970,
    "activeTo": 2025,
    "peakYear": 1990,
    "peakElo": 2680,
    "eloSource": "estimate",
    "ratings": [
      [
        1970,
        2400
      ],
      [
        1990,
        2680
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "judit-polgar",
    "name": "Judit Polgar",
    "country": "HU",
    "city": "National circuit",
    "dob": "1976-07-23",
    "activeFrom": 1988,
    "activeTo": 2014,
    "peakYear": 2005,
    "peakElo": 2735,
    "eloSource": "estimate",
    "ratings": [
      [
        1988,
        2400
      ],
      [
        2005,
        2735
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "susan-polgar",
    "name": "Susan Polgar",
    "country": "US",
    "city": "National circuit",
    "dob": "1969-04-19",
    "activeFrom": 1984,
    "activeTo": 2005,
    "peakYear": 1996,
    "peakElo": 2575,
    "eloSource": "estimate",
    "ratings": [
      [
        1984,
        2400
      ],
      [
        1996,
        2575
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "vera-menchik",
    "name": "Vera Menchik",
    "country": "GB",
    "city": "National circuit",
    "dob": "1906-02-16",
    "activeFrom": 1923,
    "activeTo": 1944,
    "peakYear": 1935,
    "peakElo": 2440,
    "eloSource": "estimate",
    "ratings": [
      [
        1923,
        2400
      ],
      [
        1935,
        2440
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female",
    "deathDate": "1944-06-26",
    "title": "none"
  },
  {
    "slug": "nona-gaprindashvili",
    "name": "Nona Gaprindashvili",
    "country": "GE",
    "city": "National circuit",
    "dob": "1941-05-03",
    "activeFrom": 1956,
    "activeTo": 2026,
    "peakYear": 1978,
    "peakElo": 2495,
    "eloSource": "estimate",
    "ratings": [
      [
        1956,
        2400
      ],
      [
        1978,
        2495
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "maia-chiburdanidze",
    "name": "Maia Chiburdanidze",
    "country": "GE",
    "city": "National circuit",
    "dob": "1961-01-17",
    "activeFrom": 1976,
    "activeTo": 2020,
    "peakYear": 1988,
    "peakElo": 2560,
    "eloSource": "estimate",
    "ratings": [
      [
        1976,
        2400
      ],
      [
        1988,
        2560
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "xie-jun",
    "name": "Xie Jun",
    "country": "CN",
    "city": "National circuit",
    "dob": "1970-10-30",
    "activeFrom": 1986,
    "activeTo": 2004,
    "peakYear": 2000,
    "peakElo": 2570,
    "eloSource": "estimate",
    "ratings": [
      [
        1986,
        2400
      ],
      [
        2000,
        2570
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "hikaru-nakamura",
    "name": "Hikaru Nakamura",
    "country": "US",
    "city": "National circuit",
    "dob": "1987-12-09",
    "activeFrom": 2003,
    "activeTo": null,
    "peakYear": 2015,
    "peakElo": 2816,
    "eloSource": "estimate",
    "ratings": [
      [
        2003,
        2400
      ],
      [
        2015,
        2816
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "fabiano-caruana",
    "name": "Fabiano Caruana",
    "country": "US",
    "city": "National circuit",
    "dob": "1992-07-30",
    "activeFrom": 2007,
    "activeTo": null,
    "peakYear": 2014,
    "peakElo": 2844,
    "eloSource": "estimate",
    "ratings": [
      [
        2007,
        2400
      ],
      [
        2014,
        2844
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "ding-liren",
    "name": "Ding Liren",
    "country": "CN",
    "city": "National circuit",
    "dob": "1992-10-24",
    "activeFrom": 2009,
    "activeTo": null,
    "peakYear": 2018,
    "peakElo": 2816,
    "eloSource": "estimate",
    "ratings": [
      [
        2009,
        2400
      ],
      [
        2018,
        2816
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "ian-nepomniachtchi",
    "name": "Ian Nepomniachtchi",
    "country": "RU",
    "city": "National circuit",
    "dob": "1990-07-14",
    "activeFrom": 2007,
    "activeTo": null,
    "peakYear": 2023,
    "peakElo": 2795,
    "eloSource": "estimate",
    "ratings": [
      [
        2007,
        2400
      ],
      [
        2023,
        2795
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "levon-aronian",
    "name": "Levon Aronian",
    "country": "AM",
    "city": "National circuit",
    "dob": "1982-10-06",
    "activeFrom": 1997,
    "activeTo": null,
    "peakYear": 2014,
    "peakElo": 2830,
    "eloSource": "estimate",
    "ratings": [
      [
        1997,
        2400
      ],
      [
        2014,
        2830
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "anish-giri",
    "name": "Anish Giri",
    "country": "NL",
    "city": "National circuit",
    "dob": "1994-06-28",
    "activeFrom": 2009,
    "activeTo": null,
    "peakYear": 2015,
    "peakElo": 2798,
    "eloSource": "estimate",
    "ratings": [
      [
        2009,
        2400
      ],
      [
        2015,
        2798
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "wesley-so",
    "name": "Wesley So",
    "country": "US",
    "city": "National circuit",
    "dob": "1993-10-09",
    "activeFrom": 2008,
    "activeTo": null,
    "peakYear": 2017,
    "peakElo": 2822,
    "eloSource": "estimate",
    "ratings": [
      [
        2008,
        2400
      ],
      [
        2017,
        2822
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "maxime-vachier-lagrave",
    "name": "Maxime Vachier-Lagrave",
    "country": "FR",
    "city": "National circuit",
    "dob": "1990-10-21",
    "activeFrom": 2005,
    "activeTo": null,
    "peakYear": 2016,
    "peakElo": 2819,
    "eloSource": "estimate",
    "ratings": [
      [
        2005,
        2400
      ],
      [
        2016,
        2819
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "alexander-grischuk",
    "name": "Alexander Grischuk",
    "country": "RU",
    "city": "National circuit",
    "dob": "1983-10-31",
    "activeFrom": 2000,
    "activeTo": null,
    "peakYear": 2014,
    "peakElo": 2810,
    "eloSource": "estimate",
    "ratings": [
      [
        2000,
        2400
      ],
      [
        2014,
        2810
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "shakhriyar-mamedyarov",
    "name": "Shakhriyar Mamedyarov",
    "country": "AZ",
    "city": "National circuit",
    "dob": "1985-04-12",
    "activeFrom": 2002,
    "activeTo": null,
    "peakYear": 2018,
    "peakElo": 2820,
    "eloSource": "estimate",
    "ratings": [
      [
        2002,
        2400
      ],
      [
        2018,
        2820
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "teimour-radjabov",
    "name": "Teimour Radjabov",
    "country": "AZ",
    "city": "National circuit",
    "dob": "1987-03-12",
    "activeFrom": 2001,
    "activeTo": null,
    "peakYear": 2012,
    "peakElo": 2790,
    "eloSource": "estimate",
    "ratings": [
      [
        2001,
        2400
      ],
      [
        2012,
        2790
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "sergey-karjakin",
    "name": "Sergey Karjakin",
    "country": "RU",
    "city": "National circuit",
    "dob": "1990-01-12",
    "activeFrom": 2002,
    "activeTo": null,
    "peakYear": 2011,
    "peakElo": 2788,
    "eloSource": "estimate",
    "ratings": [
      [
        2002,
        2400
      ],
      [
        2011,
        2788
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "richard-rapport",
    "name": "Richard Rapport",
    "country": "HU",
    "city": "National circuit",
    "dob": "1996-03-25",
    "activeFrom": 2010,
    "activeTo": null,
    "peakYear": 2022,
    "peakElo": 2776,
    "eloSource": "estimate",
    "ratings": [
      [
        2010,
        2400
      ],
      [
        2022,
        2776
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "jan-krzysztof-duda",
    "name": "Jan-Krzysztof Duda",
    "country": "PL",
    "city": "National circuit",
    "dob": "1998-04-26",
    "activeFrom": 2013,
    "activeTo": null,
    "peakYear": 2021,
    "peakElo": 2760,
    "eloSource": "estimate",
    "ratings": [
      [
        2013,
        2400
      ],
      [
        2021,
        2760
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "le-quang-liem",
    "name": "Le Quang Liem",
    "country": "VN",
    "city": "National circuit",
    "dob": "1991-03-13",
    "activeFrom": 2006,
    "activeTo": null,
    "peakYear": 2024,
    "peakElo": 2740,
    "eloSource": "estimate",
    "ratings": [
      [
        2006,
        2400
      ],
      [
        2024,
        2740
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "yu-yangyi",
    "name": "Yu Yangyi",
    "country": "CN",
    "city": "National circuit",
    "dob": "1994-06-08",
    "activeFrom": 2009,
    "activeTo": null,
    "peakYear": 2018,
    "peakElo": 2765,
    "eloSource": "estimate",
    "ratings": [
      [
        2009,
        2400
      ],
      [
        2018,
        2765
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "wei-yi",
    "name": "Wei Yi",
    "country": "CN",
    "city": "National circuit",
    "dob": "1999-06-02",
    "activeFrom": 2013,
    "activeTo": null,
    "peakYear": 2024,
    "peakElo": 2755,
    "eloSource": "estimate",
    "ratings": [
      [
        2013,
        2400
      ],
      [
        2024,
        2755
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "wang-hao",
    "name": "Wang Hao",
    "country": "CN",
    "city": "National circuit",
    "dob": "1989-08-04",
    "activeFrom": 2005,
    "activeTo": 2021,
    "peakYear": 2019,
    "peakElo": 2760,
    "eloSource": "estimate",
    "ratings": [
      [
        2005,
        2400
      ],
      [
        2019,
        2760
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "d-gukesh",
    "name": "D Gukesh",
    "country": "IN",
    "city": "National circuit",
    "dob": "2006-05-29",
    "activeFrom": 2019,
    "activeTo": null,
    "peakYear": 2024,
    "peakElo": 2780,
    "eloSource": "estimate",
    "ratings": [
      [
        2019,
        2400
      ],
      [
        2024,
        2780
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "arjun-erigaisi",
    "name": "Arjun Erigaisi",
    "country": "IN",
    "city": "National circuit",
    "dob": "2003-09-03",
    "activeFrom": 2018,
    "activeTo": null,
    "peakYear": 2024,
    "peakElo": 2800,
    "eloSource": "estimate",
    "ratings": [
      [
        2018,
        2400
      ],
      [
        2024,
        2800
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "r-praggnanandhaa",
    "name": "R Praggnanandhaa",
    "country": "IN",
    "city": "National circuit",
    "dob": "2005-08-10",
    "activeFrom": 2018,
    "activeTo": null,
    "peakYear": 2025,
    "peakElo": 2770,
    "eloSource": "estimate",
    "ratings": [
      [
        2018,
        2400
      ],
      [
        2025,
        2770
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "nodirbek-abdusattorov",
    "name": "Nodirbek Abdusattorov",
    "country": "UZ",
    "city": "National circuit",
    "dob": "2004-09-18",
    "activeFrom": 2017,
    "activeTo": null,
    "peakYear": 2024,
    "peakElo": 2766,
    "eloSource": "estimate",
    "ratings": [
      [
        2017,
        2400
      ],
      [
        2024,
        2766
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "nihal-sarin",
    "name": "Nihal Sarin",
    "country": "IN",
    "city": "National circuit",
    "dob": "2004-07-13",
    "activeFrom": 2018,
    "activeTo": null,
    "peakYear": 2025,
    "peakElo": 2700,
    "eloSource": "estimate",
    "ratings": [
      [
        2018,
        2400
      ],
      [
        2025,
        2700
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "vincent-keymer",
    "name": "Vincent Keymer",
    "country": "DE",
    "city": "National circuit",
    "dob": "2004-11-15",
    "activeFrom": 2019,
    "activeTo": null,
    "peakYear": 2025,
    "peakElo": 2750,
    "eloSource": "estimate",
    "ratings": [
      [
        2019,
        2400
      ],
      [
        2025,
        2750
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "javokhir-sindarov",
    "name": "Javokhir Sindarov",
    "country": "UZ",
    "city": "National circuit",
    "dob": "2005-12-08",
    "activeFrom": 2018,
    "activeTo": null,
    "peakYear": 2025,
    "peakElo": 2710,
    "eloSource": "estimate",
    "ratings": [
      [
        2018,
        2400
      ],
      [
        2025,
        2710
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "yagiz-kaan-erdogmus",
    "name": "Yagiz Kaan Erdogmus",
    "country": "TR",
    "city": "National circuit",
    "dob": "2011-06-03",
    "activeFrom": 2024,
    "activeTo": null,
    "peakYear": 2026,
    "peakElo": 2650,
    "eloSource": "estimate",
    "ratings": [
      [
        2024,
        2400
      ],
      [
        2026,
        2650
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "faustino-oro",
    "name": "Faustino Oro",
    "country": "AR",
    "city": "National circuit",
    "dob": "2013-10-14",
    "activeFrom": 2024,
    "activeTo": null,
    "peakYear": 2026,
    "peakElo": 2550,
    "eloSource": "estimate",
    "ratings": [
      [
        2024,
        2400
      ],
      [
        2026,
        2550
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "male"
  },
  {
    "slug": "hou-yifan",
    "name": "Hou Yifan",
    "country": "CN",
    "city": "National circuit",
    "dob": "1994-02-27",
    "activeFrom": 2008,
    "activeTo": null,
    "peakYear": 2015,
    "peakElo": 2686,
    "eloSource": "estimate",
    "ratings": [
      [
        2008,
        2400
      ],
      [
        2015,
        2686
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "ju-wenjun",
    "name": "Ju Wenjun",
    "country": "CN",
    "city": "National circuit",
    "dob": "1991-01-31",
    "activeFrom": 2009,
    "activeTo": null,
    "peakYear": 2017,
    "peakElo": 2604,
    "eloSource": "estimate",
    "ratings": [
      [
        2009,
        2400
      ],
      [
        2017,
        2604
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "tan-zhongyi",
    "name": "Tan Zhongyi",
    "country": "CN",
    "city": "National circuit",
    "dob": "1991-05-29",
    "activeFrom": 2009,
    "activeTo": null,
    "peakYear": 2025,
    "peakElo": 2550,
    "eloSource": "estimate",
    "ratings": [
      [
        2009,
        2400
      ],
      [
        2025,
        2550
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "lei-tingjie",
    "name": "Lei Tingjie",
    "country": "CN",
    "city": "National circuit",
    "dob": "1997-03-13",
    "activeFrom": 2014,
    "activeTo": null,
    "peakYear": 2023,
    "peakElo": 2550,
    "eloSource": "estimate",
    "ratings": [
      [
        2014,
        2400
      ],
      [
        2023,
        2550
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "koneru-humpy",
    "name": "Koneru Humpy",
    "country": "IN",
    "city": "National circuit",
    "dob": "1987-03-31",
    "activeFrom": 2002,
    "activeTo": null,
    "peakYear": 2009,
    "peakElo": 2623,
    "eloSource": "estimate",
    "ratings": [
      [
        2002,
        2400
      ],
      [
        2009,
        2623
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "harika-dronavalli",
    "name": "Harika Dronavalli",
    "country": "IN",
    "city": "National circuit",
    "dob": "1991-01-12",
    "activeFrom": 2008,
    "activeTo": null,
    "peakYear": 2016,
    "peakElo": 2543,
    "eloSource": "estimate",
    "ratings": [
      [
        2008,
        2400
      ],
      [
        2016,
        2543
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "r-vaishali",
    "name": "R Vaishali",
    "country": "IN",
    "city": "National circuit",
    "dob": "2001-06-21",
    "activeFrom": 2018,
    "activeTo": null,
    "peakYear": 2024,
    "peakElo": 2500,
    "eloSource": "estimate",
    "ratings": [
      [
        2018,
        2400
      ],
      [
        2024,
        2500
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "alexandra-kosteniuk",
    "name": "Alexandra Kosteniuk",
    "country": "CH",
    "city": "National circuit",
    "dob": "1984-04-23",
    "activeFrom": 1998,
    "activeTo": null,
    "peakYear": 2016,
    "peakElo": 2560,
    "eloSource": "estimate",
    "ratings": [
      [
        1998,
        2400
      ],
      [
        2016,
        2560
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "anna-muzychuk",
    "name": "Anna Muzychuk",
    "country": "UA",
    "city": "National circuit",
    "dob": "1990-02-28",
    "activeFrom": 2004,
    "activeTo": null,
    "peakYear": 2012,
    "peakElo": 2606,
    "eloSource": "estimate",
    "ratings": [
      [
        2004,
        2400
      ],
      [
        2012,
        2606
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "mariya-muzychuk",
    "name": "Mariya Muzychuk",
    "country": "UA",
    "city": "National circuit",
    "dob": "1992-09-21",
    "activeFrom": 2007,
    "activeTo": null,
    "peakYear": 2016,
    "peakElo": 2550,
    "eloSource": "estimate",
    "ratings": [
      [
        2007,
        2400
      ],
      [
        2016,
        2550
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  },
  {
    "slug": "aleksandra-goryachkina",
    "name": "Aleksandra Goryachkina",
    "country": "RU",
    "city": "National circuit",
    "dob": "1998-09-28",
    "activeFrom": 2012,
    "activeTo": null,
    "peakYear": 2021,
    "peakElo": 2611,
    "eloSource": "estimate",
    "ratings": [
      [
        2012,
        2400
      ],
      [
        2021,
        2611
      ]
    ],
    "titles": [
      "Historical player; modeled rating curve"
    ],
    "style": "universal",
    "personality": "methodical",
    "strengths": [
      "calculation",
      "strategy"
    ],
    "weaknesses": [
      "timeManagement"
    ],
    "openings": [
      "ruy-lopez",
      "queens-gambit"
    ],
    "events": [],
    "gender": "female"
  }
] as LegendSeed[]);
