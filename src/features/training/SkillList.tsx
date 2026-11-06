import { ProgressBar } from '@/components/ui';
import { GAME_CONFIG } from '@/data/config';
import { SKILL_DEFINITIONS } from '@/data/skills';
import type { Skills } from '@/types';

export function SkillList({ skills }: { skills: Skills }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {SKILL_DEFINITIONS.map(({ key, label, description }) => {
        const value = skills[key];
        return (
          <li key={key}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-semibold text-ink">{label}</span>
              <span className="text-sm tabular-nums text-ink-muted">
                {value}/{GAME_CONFIG.player.maxSkill}
              </span>
            </div>
            <ProgressBar value={(value / GAME_CONFIG.player.maxSkill) * 100} label={`${label} skill`} />
            <p className="mt-1.5 text-xs text-ink-faint">{description}</p>
          </li>
        );
      })}
    </ul>
  );
}
