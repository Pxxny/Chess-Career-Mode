import { useCallback, useState } from 'react';
import { DEFAULT_APPEARANCE } from '@/data/appearance';
import { GAME_CONFIG } from '@/data/config';
import { birthDateProblem, defaultBirthDate, isRealDate, type BirthDate } from '@/game/player/birth';
import type { Appearance, ArchetypeId, Country, PlayerCity, PlayerGender } from '@/types';

export interface CharacterDraft {
  name: string;
  gender: PlayerGender | null;
  birthDate: BirthDate;
  country: Country | null;
  city: PlayerCity | null;
  archetype: ArchetypeId;
  appearance: Appearance;
  startYear: number;
  alternateHistory: boolean;
}

export const STEPS = [
  { id: 'identity', title: 'Identity' },
  { id: 'archetype', title: 'Player type' },
  { id: 'look', title: 'Look' },
  { id: 'year', title: 'Start year' },
  { id: 'confirm', title: 'Confirm' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

const initialDraft = (): CharacterDraft => ({
  name: '',
  gender: null,
  birthDate: defaultBirthDate(GAME_CONFIG.startYear.default),
  country: null,
  city: null,
  archetype: 'balanced',
  appearance: { ...DEFAULT_APPEARANCE },
  startYear: GAME_CONFIG.startYear.default,
  alternateHistory: false,
});

export function isStepValid(step: StepId, draft: CharacterDraft): boolean {
  switch (step) {
    case 'identity':
      return draft.name.trim().length > 0 && draft.gender !== null && isRealDate(draft.birthDate) && draft.country !== null && draft.city !== null;
    case 'year':
      return (
        Number.isInteger(draft.startYear) &&
        draft.startYear >= GAME_CONFIG.startYear.min &&
        draft.startYear <= GAME_CONFIG.startYear.max &&
        birthDateProblem(draft.birthDate, draft.startYear) === null
      );
    default:
      return true;
  }
}

export function useCharacterDraft() {
  const [draft, setDraft] = useState<CharacterDraft>(initialDraft);
  const update = useCallback((patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  return { draft, update };
}
