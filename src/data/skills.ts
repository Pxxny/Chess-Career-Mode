import type { SkillDefinition, SkillKey, Skills } from '@/types';
import { GAME_CONFIG } from './config';

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  { key: 'opening', label: 'Opening', description: 'Preparation and theory knowledge.' },
  { key: 'middlegame', label: 'Middlegame', description: 'Plans, piece activity and structure.' },
  { key: 'endgame', label: 'Endgame', description: 'Technique in reduced-material positions.' },
  { key: 'tactics', label: 'Tactics', description: 'Spotting combinations quickly.' },
  { key: 'calculation', label: 'Calculation', description: 'Accuracy of deep variations.' },
  { key: 'strategy', label: 'Strategy', description: 'Long-term evaluation and planning.' },
  { key: 'timeManagement', label: 'Time management', description: 'Using the clock well.' },
  { key: 'psychology', label: 'Psychology', description: 'Composure and handling pressure.' },
];

export function createStartingSkills(): Skills {
  return Object.fromEntries(
    SKILL_DEFINITIONS.map((s) => [s.key, GAME_CONFIG.player.startingSkill]),
  ) as Record<SkillKey, number>;
}
