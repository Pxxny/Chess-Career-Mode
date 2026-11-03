import type { Personality, PlayStyle, SkillKey } from '@/types';

export const PLAY_STYLES: PlayStyle[] = [
  'attacking', 'positional', 'tactical', 'defensive', 'universal', 'dynamic', 'solid', 'prophylactic',
];

export const PERSONALITIES: Personality[] = [
  'calm', 'fiery', 'methodical', 'creative', 'stubborn', 'sociable', 'reserved', 'ambitious', 'perfectionist', 'fearless',
];

/** Typical strengths and weaknesses that go with each playing style. */
export const STYLE_PROFILE: Record<PlayStyle, { strengths: SkillKey[]; weaknesses: SkillKey[] }> = {
  attacking: { strengths: ['tactics', 'calculation', 'opening'], weaknesses: ['endgame', 'timeManagement'] },
  positional: { strengths: ['strategy', 'endgame', 'middlegame'], weaknesses: ['tactics', 'calculation'] },
  tactical: { strengths: ['tactics', 'calculation', 'middlegame'], weaknesses: ['strategy', 'endgame'] },
  defensive: { strengths: ['endgame', 'psychology', 'calculation'], weaknesses: ['opening', 'tactics'] },
  universal: { strengths: ['middlegame', 'strategy', 'tactics'], weaknesses: ['timeManagement', 'psychology'] },
  dynamic: { strengths: ['middlegame', 'tactics', 'strategy'], weaknesses: ['endgame', 'timeManagement'] },
  solid: { strengths: ['opening', 'endgame', 'timeManagement'], weaknesses: ['tactics', 'calculation'] },
  prophylactic: { strengths: ['strategy', 'psychology', 'endgame'], weaknesses: ['tactics', 'opening'] },
};
