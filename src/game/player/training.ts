import { getArchetype } from '@/data/archetypes';
import { GAME_CONFIG } from '@/data/config';
import type { GameSave, SkillKey } from '@/types';

export const upgradeCost = (skillValue: number): number => GAME_CONFIG.training.baseCost + Math.floor(skillValue / GAME_CONFIG.training.tierSize);

export type UpgradeBlock = 'max' | 'ap' | null;

/** Why a skill cannot be upgraded right now (null = eligible). */
export function upgradeBlock(save: GameSave, key: SkillKey): UpgradeBlock {
  const value = save.player.skills[key];
  if (value >= GAME_CONFIG.player.maxSkill) return 'max';
  if (save.player.ap.current < upgradeCost(value)) return 'ap';
  return null;
}

/** Points the next upgrade will add: affinity skills gain +2 on every fourth upgrade of that skill. */
export function upgradeGain(save: GameSave, key: SkillKey): number {
  const base = GAME_CONFIG.training.gain;
  const affinity = getArchetype(save.player.archetype).trainingAffinity.includes(key);
  const done = save.history.training.filter((t) => t.skill === key).length;
  const gain = affinity && (done + 1) % 4 === 0 ? base * 2 : base;
  return Math.min(gain, GAME_CONFIG.player.maxSkill - save.player.skills[key]);
}

/** Spends action points to raise one skill. Returns null when not eligible. */
export function applySkillUpgrade(save: GameSave, key: SkillKey): GameSave | null {
  if (upgradeBlock(save, key) !== null) return null;
  const from = save.player.skills[key];
  const cost = upgradeCost(from);
  const to = from + upgradeGain(save, key);
  return {
    ...save,
    player: {
      ...save.player,
      skills: { ...save.player.skills, [key]: to },
      ap: { ...save.player.ap, current: save.player.ap.current - cost },
    },
    history: { ...save.history, training: [...save.history.training, { ...save.world.date, skill: key, from, to, apCost: cost }] },
  };
}
