import type { EraProfile, Side } from '@/game/openings/types';

/**
 * Editorial metadata for the opening families of the ECO database.
 * The move lists and names come from the Lichess chess-openings dataset. Popularity, difficulty and the
 * era profile are estimates written for this game (they are shown as estimates in the interface), and
 * are replaced by real counts when a PGN game collection is imported.
 * Eras: before 1900, 1900-1945, 1946-1989, 1990-2009, 2010 onwards. 0 = unknown or unplayed, 5 = dominant.
 */
export interface FamilyMeta {
  side: Side;
  /** 1-5 */
  popularity: number;
  /** 1-5 */
  difficulty: number;
  eras: EraProfile;
  description: string;
}

export const FAMILY_META: Record<string, FamilyMeta> = {
  'Sicilian Defense': { side: 'black', popularity: 5, difficulty: 4, eras: [1, 2, 5, 5, 5], description: "Black's most combative answer to 1.e4. 1...c5 trades a wing pawn for a central one and aims for queenside counterplay. Enormous theory, from the Najdorf and Dragon to the Sveshnikov and Taimanov. It became the main reply to 1.e4 at top level in the mid twentieth century." },
  'Ruy Lopez': { side: 'white', popularity: 5, difficulty: 4, eras: [3, 4, 5, 5, 5], description: 'White pins the knight that guards e5 with 3.Bb5 and plays for a lasting initiative and a favourable structure. Named after the sixteenth-century priest Ruy López. Main branches are the Closed lines, the Open Ruy, the Berlin Defence, the Marshall Attack and the Exchange.' },
  'Italian Game': { side: 'white', popularity: 4, difficulty: 2, eras: [5, 3, 3, 3, 4], description: 'Quick development of the bishop to c4 aiming at f7. Dominant in the nineteenth century and revived at elite level by slower setups (the Giuoco Pianissimo with c3 and d3). Home of the Evans Gambit and the Two Knights Defence.' },
  'French Defense': { side: 'black', popularity: 4, difficulty: 3, eras: [2, 3, 4, 4, 3], description: 'Black challenges the centre with ...d5 after ...e6, accepting a solid but sometimes cramped structure and counterplay against the pawn chain. Winawer, Advance, Tarrasch, Classical and Exchange variations lead to very different games.' },
  'Caro-Kann Defense': { side: 'black', popularity: 4, difficulty: 2, eras: [1, 2, 4, 4, 4], description: 'A sound answer to 1.e4: ...c6 supports ...d5 without blocking the c8 bishop. Favoured by strategic players for its healthy structure; the Advance, Classical, Panov Attack and Exchange are the main tests.' },
  "Queen's Gambit Declined": { side: 'black', popularity: 4, difficulty: 3, eras: [3, 5, 4, 3, 3], description: "Black keeps the centre pawn with ...e6 after 1.d4 d5 2.c4. Classical, reliable and strategic. Orthodox, Tartakower, Lasker, Cambridge Springs, Exchange and the Semi-Tarrasch are the main systems." },
  "Queen's Gambit Accepted": { side: 'black', popularity: 3, difficulty: 2, eras: [2, 3, 3, 3, 3], description: 'Black takes the c4 pawn and gives it back later in exchange for free development and a healthy central structure. Less theory than the Declined lines.' },
  "Queen's Gambit": { side: 'white', popularity: 5, difficulty: 3, eras: [3, 5, 5, 5, 5], description: 'White offers the c-pawn to gain control of the centre. Not a true gambit: the pawn can almost always be regained. The core of the 1.d4 repertoire.' },
  'Slav Defense': { side: 'black', popularity: 4, difficulty: 3, eras: [0, 3, 4, 4, 4], description: 'Black supports the d5 pawn with ...c6 and keeps the light-squared bishop free. Solid and resilient, with the Czech, Exchange and Chebanenko systems.' },
  'Semi-Slav Defense': { side: 'black', popularity: 4, difficulty: 5, eras: [0, 3, 4, 5, 4], description: 'A hybrid of the Slav and the Queen\'s Gambit Declined (...c6 and ...e6). Sharp, heavily analysed lines such as the Meran, Botvinnik, Moscow and Anti-Moscow Gambit.' },
  "King's Indian Defense": { side: 'black', popularity: 4, difficulty: 4, eras: [0, 2, 5, 4, 3], description: "A hypermodern defence: Black lets White build a big centre, then attacks it with ...e5 or ...c5 and a kingside pawn storm. Classic weapon of Bronstein, Fischer and Kasparov. Sämisch, Classical, Fianchetto and Four Pawns lines differ greatly." },
  'Nimzo-Indian Defense': { side: 'black', popularity: 5, difficulty: 3, eras: [0, 3, 5, 5, 4], description: 'Black pins the c3 knight with ...Bb4 to control e4, accepting doubled pawns in some lines. Strategic and flexible; Classical, Rubinstein, Sämisch and Leningrad variations.' },
  "Queen's Indian Defense": { side: 'black', popularity: 4, difficulty: 3, eras: [0, 2, 4, 4, 4], description: 'Black fianchettoes the queen\'s bishop to control e4 and fights for the centre indirectly. A classic of positional play against 1.d4 followed by Nf3.' },
  'Grünfeld Defense': { side: 'black', popularity: 4, difficulty: 4, eras: [0, 2, 4, 5, 4], description: 'Black lets White build a broad pawn centre and then attacks it with pieces and ...c5. Very theoretical (Exchange, Russian and Three Knights systems).' },
  'Benoni Defense': { side: 'black', popularity: 3, difficulty: 4, eras: [0, 1, 3, 3, 2], description: 'An unbalanced structure after ...c5 and d5: Black gets queenside pawn majority and active pieces, White a central majority. The Modern Benoni is double-edged.' },
  'Dutch Defense': { side: 'black', popularity: 3, difficulty: 3, eras: [1, 2, 3, 3, 2], description: 'Black plays ...f5 to control e4 and unbalance the game at once. Leningrad, Stonewall and Classical setups.' },
  'Catalan Opening': { side: 'white', popularity: 4, difficulty: 3, eras: [0, 1, 3, 4, 5], description: 'White combines the Queen\'s Gambit with a fianchettoed king\'s bishop for long-term pressure on the queenside. A favourite of positional players.' },
  'English Opening': { side: 'white', popularity: 5, difficulty: 3, eras: [0, 2, 4, 5, 5], description: '1.c4 controls d5 and keeps many options open, often transposing to other openings. Flexible and strategically rich, popular at every level.' },
  'Réti Opening': { side: 'white', popularity: 4, difficulty: 3, eras: [0, 3, 4, 4, 4], description: 'A hypermodern opening (1.Nf3 followed by c4) that attacks the centre from the flanks. Flexible move orders and easy transpositions.' },
  'Zukertort Opening': { side: 'white', popularity: 3, difficulty: 2, eras: [3, 2, 3, 4, 4], description: '1.Nf3 keeps the choice between d4, c4, g3 and other setups open and avoids sharp theory.' },
  'Scotch Game': { side: 'white', popularity: 3, difficulty: 2, eras: [3, 2, 2, 4, 4], description: 'White opens the centre at once with 3.d4. Revived at the top level by Kasparov in the 1990s.' },
  'Vienna Game': { side: 'white', popularity: 3, difficulty: 2, eras: [3, 3, 2, 2, 3], description: 'White develops the b1-knight first and keeps the option of f4. Flexible, with attacking chances.' },
  "King's Gambit Accepted": { side: 'white', popularity: 2, difficulty: 3, eras: [5, 2, 1, 1, 1], description: 'White sacrifices the f-pawn for quick development and an attack on the kingside. The great romantic opening of the nineteenth century; rare at the top level today.' },
  "King's Gambit Declined": { side: 'white', popularity: 2, difficulty: 3, eras: [4, 2, 1, 1, 1], description: 'Black refuses the gambit pawn, for example with 2...Bc5 or 2...d5.' },
  "King's Gambit": { side: 'white', popularity: 2, difficulty: 3, eras: [5, 2, 1, 1, 1], description: '2.f4 offers a pawn to open the f-file and the centre.' },
  "Bishop's Opening": { side: 'white', popularity: 2, difficulty: 2, eras: [4, 2, 2, 2, 2], description: 'White develops the bishop before the knight and keeps f4 and Nf3 options.' },
  'Four Knights Game': { side: 'white', popularity: 3, difficulty: 1, eras: [4, 3, 3, 3, 3], description: 'Symmetrical, sensible development of all four knights. The Spanish variation (4.Bb5) is the main line.' },
  "Petrov's Defense": { side: 'black', popularity: 4, difficulty: 2, eras: [2, 2, 3, 4, 5], description: 'Black counterattacks e4 instead of defending e5. Drawish reputation but accurate play is needed; a solid choice at the top level.' },
  'Philidor Defense': { side: 'black', popularity: 2, difficulty: 2, eras: [3, 2, 2, 2, 2], description: 'Black defends e5 with ...d6 and accepts a slightly passive but sound position.' },
  'Pirc Defense': { side: 'black', popularity: 2, difficulty: 3, eras: [0, 1, 3, 3, 2], description: 'A flexible hypermodern defence: Black allows a big centre and strikes at it later.' },
  'Modern Defense': { side: 'black', popularity: 2, difficulty: 3, eras: [0, 1, 2, 3, 2], description: 'Black fianchettoes the king\'s bishop without committing the g8 knight. Flexible and hard to prepare against.' },
  'Alekhine Defense': { side: 'black', popularity: 2, difficulty: 3, eras: [0, 2, 3, 2, 1], description: 'Black provokes the e-pawn forward with 1...Nf6 and hopes to undermine the advanced centre.' },
  'Scandinavian Defense': { side: 'black', popularity: 3, difficulty: 1, eras: [2, 1, 2, 3, 3], description: 'Black challenges e4 at once with 1...d5. Simple to learn, with early queen development.' },
  'Nimzowitsch Defense': { side: 'black', popularity: 2, difficulty: 2, eras: [0, 1, 2, 2, 2], description: 'An unusual 1...Nc6 reply to 1.e4 inspired by Aron Nimzowitsch.' },
  'Latvian Gambit': { side: 'black', popularity: 1, difficulty: 3, eras: [3, 1, 1, 1, 1], description: 'A sharp counter-gambit with 2...f5 against the Knight\'s Opening.' },
  'Danish Gambit': { side: 'white', popularity: 2, difficulty: 2, eras: [4, 2, 1, 1, 1], description: 'White gives two pawns for rapid development and attacking chances.' },
  'Danish Gambit Accepted': { side: 'white', popularity: 2, difficulty: 2, eras: [4, 2, 1, 1, 1], description: 'The accepted lines of the Danish Gambit.' },
  'Center Game': { side: 'white', popularity: 1, difficulty: 2, eras: [4, 2, 1, 1, 1], description: 'White opens the centre with 2.d4, usually bringing the queen out early.' },
  'Ponziani Opening': { side: 'white', popularity: 1, difficulty: 2, eras: [3, 1, 1, 2, 2], description: 'White supports d4 with 3.c3. Old but still playable.' },
  'Trompowsky Attack': { side: 'white', popularity: 3, difficulty: 2, eras: [0, 0, 2, 3, 4], description: '1.d4 Nf6 2.Bg5 sidesteps main-line theory against Indian defences.' },
  'London System': { side: 'white', popularity: 4, difficulty: 1, eras: [0, 1, 2, 3, 5], description: 'A reliable development scheme with Bf4 that can be played against almost anything, so it needs little theory.' },
  'Colle System': { side: 'white', popularity: 2, difficulty: 1, eras: [0, 3, 3, 2, 2], description: 'A restrained system with e3, Nf3 and Bd3 and a later e4 break.' },
  'Torre Attack': { side: 'white', popularity: 2, difficulty: 1, eras: [0, 3, 3, 2, 2], description: 'White develops the dark-squared bishop to g5 early against Indian setups.' },
  'Blackmar-Diemer Gambit': { side: 'white', popularity: 2, difficulty: 3, eras: [1, 1, 2, 2, 2], description: 'White offers a pawn on move two for quick development and an attack.' },
  'Blackmar-Diemer Gambit Accepted': { side: 'white', popularity: 2, difficulty: 3, eras: [1, 1, 2, 2, 2], description: 'Black takes the d4 or e4 pawn offered by the Blackmar-Diemer Gambit and White plays for attack.' },
  'Blackmar-Diemer Gambit Declined': { side: 'white', popularity: 1, difficulty: 3, eras: [1, 1, 2, 2, 2], description: 'Black declines the Blackmar-Diemer pawn offer.' },
  'Bird Opening': { side: 'white', popularity: 2, difficulty: 2, eras: [3, 2, 2, 2, 2], description: '1.f4 fights for e5, a "reversed Dutch".' },
  'Benko Gambit': { side: 'black', popularity: 3, difficulty: 4, eras: [0, 0, 3, 3, 3], description: 'Black sacrifices a pawn for long-term pressure on the queenside files and diagonals.' },
  'Benko Gambit Accepted': { side: 'black', popularity: 3, difficulty: 4, eras: [0, 0, 3, 3, 3], description: 'The main lines of the Benko Gambit after White takes the pawn.' },
  'Tarrasch Defense': { side: 'black', popularity: 2, difficulty: 3, eras: [0, 3, 3, 2, 2], description: 'Black accepts an isolated d-pawn for active pieces.' },
  'Bogo-Indian Defense': { side: 'black', popularity: 3, difficulty: 2, eras: [0, 2, 3, 4, 4], description: 'A safe alternative to the Nimzo-Indian when White plays Nf3.' },
  'Old Indian Defense': { side: 'black', popularity: 2, difficulty: 2, eras: [1, 2, 2, 2, 2], description: 'A solid but slightly passive ...d6 setup.' },
  'Indian Defense': { side: 'black', popularity: 3, difficulty: 2, eras: [0, 2, 3, 3, 3], description: 'Early ...Nf6 against 1.d4 with several possible structures.' },
  'Richter-Veresov Attack': { side: 'white', popularity: 2, difficulty: 2, eras: [0, 2, 2, 2, 3], description: '1.d4 d5 2.Nc3 Nf6 3.Bg5: a quiet but trappy way to avoid Queen\'s Gambit theory.' },
  "King's Indian Attack": { side: 'white', popularity: 3, difficulty: 2, eras: [0, 1, 4, 4, 3], description: 'A system with Nf3, g3, Bg2, O-O and d3, played against many defences. Fischer used it with success.' },
  'Nimzo-Larsen Attack': { side: 'white', popularity: 2, difficulty: 2, eras: [0, 1, 3, 2, 2], description: '1.b3 aims the bishop at the long diagonal. Favoured by Bent Larsen.' },
  'Polish Opening': { side: 'white', popularity: 1, difficulty: 2, eras: [1, 3, 2, 1, 1], description: '1.b4 grabs space on the queenside (the Sokolsky or Orangutan).' },
  'Grob Opening': { side: 'white', popularity: 1, difficulty: 2, eras: [0, 1, 1, 1, 1], description: '1.g4 is an offbeat flank opening that relies on surprise.' },
  'Hungarian Opening': { side: 'white', popularity: 1, difficulty: 1, eras: [0, 1, 1, 1, 1], description: '1.g3 is a flexible, modest fianchetto opening.' },
  'Van Geet Opening': { side: 'white', popularity: 1, difficulty: 1, eras: [0, 0, 1, 1, 1], description: '1.Nc3 develops a piece first and keeps the centre options open.' },
  'English Defense': { side: 'black', popularity: 1, difficulty: 3, eras: [0, 0, 1, 2, 1], description: 'An offbeat reply to 1.d4 with ...e6 and ...b6.' },
  'Englund Gambit': { side: 'black', popularity: 1, difficulty: 3, eras: [0, 1, 1, 1, 1], description: 'A trappy gambit with 1.d4 e5. Dubious against best play.' },
  "Queen's Pawn Game": { side: 'white', popularity: 4, difficulty: 1, eras: [3, 4, 5, 5, 5], description: 'Positions that start 1.d4, before the choice of setup is clear. Many lines transpose to main openings.' },
  "King's Pawn Game": { side: 'white', popularity: 4, difficulty: 1, eras: [4, 4, 5, 5, 5], description: 'Positions that start 1.e4 and are not covered by a more specific opening name.' },
  'Hippopotamus Defense': { side: 'black', popularity: 1, difficulty: 2, eras: [0, 0, 1, 1, 1], description: 'A flexible, ultra-passive setup that avoids early commitments.' },
  'Owen Defense': { side: 'black', popularity: 1, difficulty: 2, eras: [2, 1, 1, 1, 1], description: '1...b6 against 1.e4.' },
  'Lion Defense': { side: 'black', popularity: 1, difficulty: 2, eras: [0, 0, 1, 2, 2], description: 'A flexible Pirc-like setup with an early ...Nbd7.' },
  'Elephant Gambit': { side: 'black', popularity: 1, difficulty: 2, eras: [2, 1, 1, 1, 1], description: '2...d5 against the King\'s Knight\'s opening.' },
  'Blumenfeld Countergambit': { side: 'black', popularity: 2, difficulty: 3, eras: [0, 3, 2, 1, 1], description: 'A pawn sacrifice in the Benoni family to gain a strong centre.' },
};

/** Descriptions and numbers for well-known variations. Keyed by "family|variation" (first part of the variation name). */
export interface VariationMeta {
  popularity?: number;
  difficulty?: number;
  description: string;
}

export const VARIATION_META: Record<string, VariationMeta> = {
  'Sicilian Defense|Najdorf Variation': { popularity: 5, difficulty: 5, description: 'The most analysed Sicilian: 5...a6 prepares ...e5 or ...b5 and keeps Black flexible. Fischer and Kasparov made it famous.' },
  'Sicilian Defense|Dragon Variation': { popularity: 3, difficulty: 4, description: 'Black fianchettoes the bishop on g7 on the long diagonal. White usually castles queenside and attacks on the kingside (Yugoslav Attack).' },
  'Sicilian Defense|Scheveningen Variation': { popularity: 4, difficulty: 4, description: 'A flexible small centre with pawns on d6 and e6.' },
  'Sicilian Defense|Richter-Rauzer Variation': { popularity: 3, difficulty: 4, description: 'White develops Bg5 and Qd2 against the Classical Sicilian with 6.Bg5.' },
  'Sicilian Defense|Taimanov Variation': { popularity: 3, difficulty: 3, description: 'Black plays ...e6 and ...Nc6 for flexible development.' },
  'Sicilian Defense|Kan Variation': { popularity: 3, difficulty: 3, description: 'Black plays ...a6 and ...e6 and keeps the knight options open.' },
  'Sicilian Defense|Alapin Variation': { popularity: 3, difficulty: 2, description: '2.c3 prepares d4 and avoids the main Open Sicilian theory.' },
  'Sicilian Defense|Smith-Morra Gambit Accepted': { popularity: 2, difficulty: 3, description: 'White gives a pawn after 2.d4 cxd4 3.c3 for rapid development.' },
  'Sicilian Defense|Closed': { popularity: 3, difficulty: 2, description: 'White avoids the Open Sicilian with Nc3 and g3 and plays on the kingside.' },
  'Sicilian Defense|Classical Variation': { popularity: 3, difficulty: 3, description: 'Black plays ...Nc6 and ...Nf6 with natural development.' },
  'Sicilian Defense|Sozin Attack': { popularity: 2, difficulty: 4, description: 'White develops the bishop to c4 and often castles queenside.' },
  'Sicilian Defense|Accelerated Dragon': { popularity: 3, difficulty: 3, description: 'Black fianchettoes at once without ...d6, aiming for ...d5 in one move.' },
  'Sicilian Defense|Lasker-Pelikan Variation': { popularity: 3, difficulty: 4, description: 'The Sveshnikov complex: Black accepts a backward d6 pawn for active pieces.' },
  'Sicilian Defense|Nyezhmetdinov-Rossolimo Attack': { popularity: 3, difficulty: 3, description: 'White pins the c6 knight with Bb5 and avoids Open Sicilian theory.' },
  'Ruy Lopez|Closed': { popularity: 5, difficulty: 5, description: 'The classical main line: both sides complete development and manoeuvre. Chigorin, Breyer, Zaitsev, Smyslov and Marshall setups.' },
  'Ruy Lopez|Berlin Defense': { popularity: 5, difficulty: 3, description: 'Black plays 3...Nf6 and accepts the queenless "Berlin Wall" endgame. Made famous by Kramnik against Kasparov in 2000.' },
  'Ruy Lopez|Marshall Attack': { popularity: 4, difficulty: 5, description: 'Black sacrifices a pawn with ...d5 for a strong initiative.' },
  'Ruy Lopez|Open': { popularity: 4, difficulty: 4, description: 'Black captures on e4 and White regains the pawn.' },
  'Ruy Lopez|Exchange Variation': { popularity: 3, difficulty: 2, description: 'White gives up the bishop for the knight to damage Black\'s pawn structure. Fischer\'s weapon.' },
  'Ruy Lopez|Schliemann Defense': { popularity: 2, difficulty: 3, description: 'A sharp counter-gambit with 3...f5.' },
  'Italian Game|Evans Gambit': { popularity: 3, difficulty: 3, description: 'White sacrifices the b-pawn with 4.b4 for a strong centre and rapid development. Kasparov revived it in the 1990s.' },
  'Italian Game|Two Knights Defense': { popularity: 3, difficulty: 3, description: 'Black develops the knight to f6 and invites sharp play (the Fried Liver Attack and Traxler Counterattack).' },
  'Italian Game|Giuoco Piano': { popularity: 4, difficulty: 2, description: 'The "quiet game": both sides develop bishops to c4 and c5.' },
  'Italian Game|Giuoco Pianissimo': { popularity: 4, difficulty: 2, description: 'The "very quiet game" with c3 and d3, a strategic favourite today.' },
  'French Defense|Winawer Variation': { popularity: 4, difficulty: 4, description: 'Black pins the c3 knight with 3...Bb4 and fights for the dark squares.' },
  'French Defense|Advance Variation': { popularity: 4, difficulty: 2, description: 'White gains space with 3.e5.' },
  'French Defense|Tarrasch Variation': { popularity: 4, difficulty: 3, description: 'White develops the knight to d2 to avoid the Winawer pin.' },
  'French Defense|Classical Variation': { popularity: 3, difficulty: 3, description: 'Black develops the knight to f6 and White attacks the centre.' },
  'French Defense|Exchange Variation': { popularity: 3, difficulty: 1, description: 'White simplifies the centre with exd5. Drawish but safe.' },
  'Caro-Kann Defense|Advance Variation': { popularity: 4, difficulty: 2, description: 'White plays 3.e5 and Black gets the bishop outside the pawn chain.' },
  'Caro-Kann Defense|Panov Attack': { popularity: 3, difficulty: 3, description: 'White plays exd5 and c4 to get an isolated queen pawn structure with activity.' },
  'Caro-Kann Defense|Classical Variation': { popularity: 4, difficulty: 2, description: 'Black captures on e4 and develops the bishop before playing ...e6.' },
  'Caro-Kann Defense|Karpov Variation': { popularity: 3, difficulty: 3, description: 'Black develops the knight to d7 instead of the bishop.' },
  "King's Indian Defense|Sämisch Variation": { popularity: 3, difficulty: 3, description: 'White supports the centre with f3, preparing Be3 and Qd2.' },
  "King's Indian Defense|Fianchetto Variation": { popularity: 3, difficulty: 3, description: 'White develops the bishop to g2.' },
  "King's Indian Defense|Orthodox Variation": { popularity: 4, difficulty: 4, description: 'The main line with Be2 and Nf3 followed by ...e5.' },
  "King's Indian Defense|Four Pawns Attack": { popularity: 2, difficulty: 4, description: 'White grabs space with f4 and a huge pawn centre.' },
  'Nimzo-Indian Defense|Classical Variation': { popularity: 4, difficulty: 3, description: 'White plays Qc2 to avoid doubled pawns.' },
  'Nimzo-Indian Defense|Sämisch Variation': { popularity: 2, difficulty: 3, description: 'White takes the bishop pair at the cost of doubled c-pawns.' },
  'Nimzo-Indian Defense|Rubinstein System': { popularity: 4, difficulty: 3, description: 'White develops with e3 and Nge2 or Bd3 and keeps a solid structure.' },
  'English Opening|Symmetrical Variation': { popularity: 4, difficulty: 3, description: 'Both players play ...c5. Often leads to strategic manoeuvring.' },
  "English Opening|King's English Variation": { popularity: 4, difficulty: 3, description: 'Black replies ...e5, a reversed Sicilian.' },
  'Slav Defense|Czech Variation': { popularity: 3, difficulty: 3, description: 'Black defends with ...dxc4 and ...Bf5.' },
  'Semi-Slav Defense|Meran Variation': { popularity: 4, difficulty: 5, description: 'A complicated line where Black plays ...dxc4 and ...b5.' },
  'Semi-Slav Defense|Botvinnik Variation': { popularity: 3, difficulty: 5, description: 'A razor-sharp line with a pawn sacrifice on both sides.' },
  'Grünfeld Defense|Exchange Variation': { popularity: 4, difficulty: 4, description: 'White builds a big pawn centre and Black attacks it.' },
  'Grünfeld Defense|Russian Variation': { popularity: 3, difficulty: 4, description: 'White plays Qb3 and prepares e4.' },
  'Scotch Game|Scotch Gambit': { popularity: 2, difficulty: 2, description: 'White delays recapturing for development and activity.' },
  "Queen's Gambit Declined|Orthodox Defense": { popularity: 4, difficulty: 3, description: 'Black develops with ...Be7, ...Nbd7 and ...O-O.' },
  "Queen's Gambit Declined|Exchange Variation": { popularity: 4, difficulty: 2, description: 'White captures on d5 and plays the minority attack.' },
  "Queen's Gambit Declined|Semi-Tarrasch Defense": { popularity: 3, difficulty: 3, description: 'Black plays ...c5 with ...Nf6 and keeps good piece play.' },
  "Queen's Gambit Declined|Cambridge Springs Defense": { popularity: 2, difficulty: 3, description: 'Black counterattacks with ...Qa5 pinning the knight on c3.' },
  'Dutch Defense|Stonewall Variation': { popularity: 3, difficulty: 2, description: 'Black builds a pawn wall with ...f5, ...e6, ...d5 and ...c6.' },
  'Dutch Defense|Leningrad Variation': { popularity: 3, difficulty: 3, description: 'Black fianchettoes the king\'s bishop.' },
  "Petrov's Defense|Classical Attack": { popularity: 4, difficulty: 2, description: 'The main line: 3.Nxe5 d6 4.Nf3 Nxe4 5.d4.' },
};
