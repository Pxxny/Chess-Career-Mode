import { ProgressBar } from '@/components/ui';
import { getOpening } from '@/data/chess/openings';
import { GAME_CONFIG } from '@/data/config';
import { SKILL_DEFINITIONS } from '@/data/skills';
import type { ArchetypeDefinition, SkillKey, Tendencies } from '@/types';

const TENDENCY_LABELS: Record<keyof Tendencies, string> = {
  aggression: 'Aggression',
  complexity: 'Likes complex positions',
  riskTaking: 'Risk-taking',
  resilience: 'Resilience under pressure',
  adaptability: 'Adaptability',
};

const skillName = (key: SkillKey) => SKILL_DEFINITIONS.find((s) => s.key === key)?.label ?? key;

interface ArchetypeSummaryProps {
  archetype: ArchetypeDefinition;
  /** Current tendencies (they drift during a career); defaults to the archetype's starting values */
  tendencies?: Tendencies;
}

export function ArchetypeSummary({ archetype, tendencies = archetype.tendencies }: ArchetypeSummaryProps) {
  const bonuses = Object.entries(archetype.skillBonuses).sort((a, b) => b[1]! - a[1]!) as Array<[SkillKey, number]>;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-sm text-ink-muted">Style</p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink">
          {archetype.traits.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mb-2 text-sm text-ink-muted">Starting skill adjustments</p>
        <ul className="flex flex-wrap gap-1.5">
          {bonuses.map(([key, value]) => (
            <li key={key} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${value > 0 ? 'bg-gold-500/15 text-gold-300' : 'bg-white/5 text-ink-muted'}`}>
              {skillName(key)} {value > 0 ? `+${value}` : value}
            </li>
          ))}
        </ul>
        <p className="mb-1 mt-4 text-sm text-ink-muted">Trains faster</p>
        <p className="text-sm text-ink">
          {archetype.trainingAffinity.map(skillName).join(', ')} (×{GAME_CONFIG.player.affinityMultiplier})
        </p>
        <p className="mb-1 mt-4 text-sm text-ink-muted">Natural openings</p>
        <p className="text-sm text-ink">{archetype.suggestedOpenings.map((id) => getOpening(id)?.name ?? id).join(', ')}</p>
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-muted">Tendencies</p>
        <ul className="space-y-3">
          {(Object.keys(TENDENCY_LABELS) as Array<keyof Tendencies>).map((key) => (
            <li key={key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink">{TENDENCY_LABELS[key]}</span>
                <span className="tabular-nums text-ink-muted">{tendencies[key]}</span>
              </div>
              <ProgressBar value={tendencies[key]} label={TENDENCY_LABELS[key]} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
