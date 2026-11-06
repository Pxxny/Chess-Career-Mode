import { useState } from 'react';
import { Button, Card, CardTitle, ProgressBar } from '@/components/ui';
import { getArchetype } from '@/data/archetypes';
import { GAME_CONFIG } from '@/data/config';
import { SKILL_DEFINITIONS } from '@/data/skills';
import { upgradeBlock, upgradeCost, upgradeGain } from '@/game/player/training';
import { useSave } from '@/hooks/useGame';
import { useGameStore } from '@/store/gameStore';
import type { SkillKey } from '@/types';

export function SkillsTab() {
  const save = useSave();
  const upgradeSkill = useGameStore((s) => s.upgradeSkill);
  const [message, setMessage] = useState('');
  const { player } = save;
  const affinity = getArchetype(player.archetype).trainingAffinity;

  const upgrade = (key: SkillKey, label: string) => {
    const gain = upgradeGain(save, key);
    const ok = upgradeSkill(key);
    setMessage(ok ? `${label} improved by ${gain}.` : `${label} could not be upgraded.`);
  };

  return (
    <Card>
      <CardTitle aside={<span className="text-sm font-semibold tabular-nums text-gold-400">{player.ap.current}/{player.ap.max} AP</span>}>Skills</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Spend action points to raise a skill. Higher skills cost more AP per upgrade. Skills marked Affinity improve faster.
      </p>
      <ul className="grid gap-5 sm:grid-cols-2">
        {SKILL_DEFINITIONS.map(({ key, label, description }) => {
          const value = player.skills[key];
          const block = upgradeBlock(save, key);
          const cost = upgradeCost(value);
          return (
            <li key={key} className="rounded-lg bg-navy-700/40 p-3">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-semibold text-ink">
                  {label}
                  {affinity.includes(key) && <span className="ml-2 rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-semibold text-gold-300">Affinity</span>}
                </span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {value}/{GAME_CONFIG.player.maxSkill}
                </span>
              </div>
              <ProgressBar value={(value / GAME_CONFIG.player.maxSkill) * 100} label={`${label} skill`} />
              <p className="mt-1.5 text-xs text-ink-faint">{description}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-ink-muted">
                  {block === 'max' ? 'Maximum reached' : block === 'ap' ? `Needs ${cost} AP` : `+${upgradeGain(save, key)} for ${cost} AP`}
                </span>
                <Button type="button" onClick={() => upgrade(key, label)} disabled={block !== null} aria-label={`Upgrade ${label}`}>
                  Upgrade
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-ink-muted">
        {message}
      </p>
    </Card>
  );
}
