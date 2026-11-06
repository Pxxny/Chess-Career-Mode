import type { AttributeKey, PlayStyle, SkillKey, StatKey } from '@/types';

export interface AttributeDefinition {
  key: AttributeKey;
  label: string;
  description: string;
  /** The core skill whose starting bonus this attribute follows */
  related: SkillKey;
}

export const ATTRIBUTE_DEFINITIONS: AttributeDefinition[] = [
  { key: 'patternRecognition', label: 'Pattern recognition', description: 'Seeing familiar motifs at a glance.', related: 'tactics' },
  { key: 'visualization', label: 'Visualization', description: 'Holding the board in your head.', related: 'calculation' },
  { key: 'concentration', label: 'Concentration', description: 'Staying focused for the whole game.', related: 'psychology' },
  { key: 'openingPreparation', label: 'Opening preparation', description: 'Depth of your prepared lines.', related: 'opening' },
  { key: 'positionalUnderstanding', label: 'Positional understanding', description: 'Reading structure and piece placement.', related: 'strategy' },
  { key: 'mentalStability', label: 'Mental stability', description: 'Calm after mistakes and bad news.', related: 'psychology' },
  { key: 'stamina', label: 'Stamina', description: 'Lowers the fatigue every session causes.', related: 'timeManagement' },
  { key: 'physicalFitness', label: 'Physical fitness', description: 'Speeds up recovery each night.', related: 'timeManagement' },
  { key: 'resilience', label: 'Psychological resilience', description: 'Bouncing back from losses.', related: 'psychology' },
  { key: 'pressure', label: 'Performance under pressure', description: 'Playing well when it matters.', related: 'psychology' },
];

export const SKILL_LABELS: Record<SkillKey, string> = {
  opening: 'Opening knowledge',
  middlegame: 'Middlegame',
  endgame: 'Endgame technique',
  tactics: 'Tactics',
  calculation: 'Calculation',
  strategy: 'Strategic planning',
  timeManagement: 'Time management',
  psychology: 'Psychology',
};

export const STAT_LABELS: Record<StatKey, string> = {
  ...SKILL_LABELS,
  ...(Object.fromEntries(ATTRIBUTE_DEFINITIONS.map((a) => [a.key, a.label])) as Record<AttributeKey, string>),
};

export const ATTRIBUTE_KEYS: AttributeKey[] = ATTRIBUTE_DEFINITIONS.map((a) => a.key);
export const isAttribute = (key: StatKey): key is AttributeKey => ATTRIBUTE_KEYS.includes(key as AttributeKey);


/** The stat a master's playing style trains when you study their games. */
export const MASTER_STYLE_STAT: Record<PlayStyle, StatKey> = {
  attacking: 'tactics',
  tactical: 'calculation',
  dynamic: 'middlegame',
  positional: 'positionalUnderstanding',
  solid: 'endgame',
  defensive: 'resilience',
  prophylactic: 'strategy',
  universal: 'strategy',
};
