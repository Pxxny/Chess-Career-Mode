import type { ArchetypeDefinition, ArchetypeId } from '@/types';

/**
 * Archetypes shape the starting skills (each adds a net +16 points) and the
 * tendencies the match engine will use. They never lock anything: every skill
 * can be trained by every player, and tendencies drift with experience.
 */
export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'attacker',
    label: 'Attacker',
    tagline: 'Sharp positions, initiative first.',
    traits: ['Strong attacking intuition', 'Aggressive tactical decisions', 'Prefers sharp positions'],
    playStyle: 'attacking',
    skillBonuses: { tactics: 6, opening: 4, calculation: 3, middlegame: 3, psychology: 3, endgame: -2, timeManagement: -1 },
    tendencies: { aggression: 85, complexity: 70, riskTaking: 80, resilience: 40, adaptability: 45 },
    trainingAffinity: ['tactics', 'opening', 'calculation'],
    suggestedOpenings: ['kings-gambit', 'sicilian-najdorf', 'scotch'],
  },
  {
    id: 'tactician',
    label: 'Tactician',
    tagline: 'Calculates deeper than the opponent.',
    traits: ['Strong calculation', 'Excellent tactical awareness', 'Enjoys complicated positions'],
    playStyle: 'tactical',
    skillBonuses: { calculation: 6, tactics: 6, middlegame: 2, opening: 2, psychology: 1, endgame: -1 },
    tendencies: { aggression: 65, complexity: 90, riskTaking: 60, resilience: 50, adaptability: 50 },
    trainingAffinity: ['calculation', 'tactics', 'middlegame'],
    suggestedOpenings: ['semi-slav', 'grunfeld', 'sicilian-najdorf'],
  },
  {
    id: 'balanced',
    label: 'Balanced',
    tagline: 'No weak spots, ready for anything.',
    traits: ['No extreme weaknesses', 'Adaptable playing style', 'Steady improvement everywhere'],
    playStyle: 'solid',
    skillBonuses: { opening: 2, middlegame: 2, endgame: 2, tactics: 2, calculation: 2, strategy: 2, timeManagement: 2, psychology: 2 },
    tendencies: { aggression: 50, complexity: 50, riskTaking: 50, resilience: 50, adaptability: 60 },
    trainingAffinity: ['middlegame', 'strategy', 'timeManagement'],
    suggestedOpenings: ['italian', 'queens-gambit', 'caro-kann'],
  },
  {
    id: 'universal',
    label: 'Universal',
    tagline: 'At home in every kind of position.',
    traits: ['Comfortable in various types of positions', 'Strong adaptability', 'Switches plans smoothly'],
    playStyle: 'universal',
    skillBonuses: { middlegame: 3, strategy: 3, tactics: 3, opening: 2, endgame: 2, calculation: 2, psychology: 1 },
    tendencies: { aggression: 55, complexity: 60, riskTaking: 50, resilience: 55, adaptability: 85 },
    trainingAffinity: ['middlegame', 'strategy', 'tactics'],
    suggestedOpenings: ['ruy-lopez', 'english', 'nimzo-indian'],
  },
  {
    id: 'positional',
    label: 'Positional',
    tagline: 'Squeezes small, lasting advantages.',
    traits: ['Strong positional understanding', 'Excellent strategic decisions', 'Prefers long-term advantages'],
    playStyle: 'positional',
    skillBonuses: { strategy: 6, endgame: 5, middlegame: 4, opening: 2, timeManagement: 1, psychology: 1, tactics: -2, calculation: -1 },
    tendencies: { aggression: 30, complexity: 40, riskTaking: 30, resilience: 60, adaptability: 50 },
    trainingAffinity: ['strategy', 'endgame', 'middlegame'],
    suggestedOpenings: ['queens-gambit', 'catalan', 'nimzo-indian'],
  },
  {
    id: 'defender',
    label: 'Defender',
    tagline: 'Hard to beat, harder to crack.',
    traits: ['Strong defensive technique', 'Excellent resistance under pressure', 'Difficult to defeat'],
    playStyle: 'defensive',
    skillBonuses: { endgame: 5, psychology: 5, calculation: 3, strategy: 3, timeManagement: 2, opening: -2 },
    tendencies: { aggression: 20, complexity: 35, riskTaking: 25, resilience: 90, adaptability: 45 },
    trainingAffinity: ['endgame', 'psychology', 'calculation'],
    suggestedOpenings: ['berlin', 'caro-kann', 'slav'],
  },
];

const BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));
export const getArchetype = (id: ArchetypeId): ArchetypeDefinition => BY_ID.get(id) ?? ARCHETYPES[2];
