import { Card, CardTitle, ProgressBar } from '@/components/ui';
import { getArchetype } from '@/data/archetypes';
import { GAME_CONFIG } from '@/data/config';
import { SKILL_DEFINITIONS } from '@/data/skills';
import { xpNeeded } from '@/game/training/engine';
import { useSave } from '@/hooks/useGame';

export function SkillsTab() {
  const save = useSave();
  const { player, training } = save;
  const affinity = getArchetype(player.archetype).trainingAffinity;

  return (
    <Card>
      <CardTitle aside={<span className="text-sm font-semibold tabular-nums text-gold-400">{player.ap.current}/{player.ap.max} AP</span>}>Skills</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Skills grow through Train: sessions and games earn experience, and action points pay for them. Skills marked Affinity improve faster.
      </p>
      <ul className="grid gap-5 sm:grid-cols-2">
        {SKILL_DEFINITIONS.map(({ key, label, description }) => {
          const value = player.skills[key];
          const atMax = value >= GAME_CONFIG.player.maxSkill;
          const needed = xpNeeded(value);
          const progress = training.xp[key] ?? 0;
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
              <p className="mt-2 text-xs text-ink-muted">{atMax ? 'Maximum reached' : `Next level: ${Math.round(progress)}/${needed} XP`}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
