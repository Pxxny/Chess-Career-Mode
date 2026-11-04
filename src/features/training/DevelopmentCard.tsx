import { Card, CardTitle, ProgressBar } from '@/components/ui';
import { GAME_CONFIG } from '@/data/config';
import { ATTRIBUTE_DEFINITIONS, SKILL_LABELS } from '@/data/stats';
import { SKILL_DEFINITIONS } from '@/data/skills';
import { xpNeeded } from '@/game/training/engine';
import type { GameSave, StatKey } from '@/types';

export function DevelopmentCard({ save }: { save: GameSave }) {
  const row = (key: StatKey, label: string, value: number) => {
    const need = xpNeeded(value);
    const have = save.training.xp[key] ?? 0;
    return (
      <li key={key}>
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="text-ink">{label}</span>
          <span className="tabular-nums text-ink-muted">
            {value}/{GAME_CONFIG.player.maxSkill}
          </span>
        </div>
        <ProgressBar value={value >= GAME_CONFIG.player.maxSkill ? 100 : (have / need) * 100} label={`${label}: progress to next level`} />
        <p className="mt-0.5 text-xs text-ink-faint">{value >= GAME_CONFIG.player.maxSkill ? 'Maximum' : `${Math.round(have)}/${need} XP to next level`}</p>
      </li>
    );
  };
  return (
    <Card className="mb-4">
      <CardTitle>Your development</CardTitle>
      <h3 className="mb-2 text-sm font-semibold text-ink-muted">Skills</h3>
      <ul className="grid gap-3 sm:grid-cols-2">{SKILL_DEFINITIONS.map((s) => row(s.key, SKILL_LABELS[s.key], save.player.skills[s.key]))}</ul>
      <h3 className="mb-2 mt-5 text-sm font-semibold text-ink-muted">Attributes</h3>
      <ul className="grid gap-3 sm:grid-cols-2">{ATTRIBUTE_DEFINITIONS.map((a) => row(a.key, a.label, save.player.attributes[a.key]))}</ul>
    </Card>
  );
}
