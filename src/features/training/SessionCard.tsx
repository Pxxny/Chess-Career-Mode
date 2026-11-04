import { Clock, Coins, Zap } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { DIFFICULTY_LABELS } from '@/data/trainingSessions';
import { previewSession } from '@/game/training/engine';
import type { GameSave, TrainingSessionDef } from '@/types';
import { formatMoney } from '@/utils/format';

interface Props {
  def: TrainingSessionDef;
  save: GameSave;
  onStart: (def: TrainingSessionDef) => void;
}

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(4 - n);

export function SessionCard({ def, save, onStart }: Props) {
  const preview = previewSession(save, def);
  const blocked = preview.blocks.length > 0;
  const moraleText = def.morale === 0 ? 'No change' : `${def.morale > 0 ? '+' : ''}${def.morale}`;

  return (
    <li className="rounded-xl border border-white/[0.06] bg-navy-700/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{def.name}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">{def.description}</p>
        </div>
        <Badge>
          <span aria-hidden>{stars(def.difficulty)}</span>
          <span className="sr-only">Difficulty: </span>
          <span className="ml-1">{DIFFICULTY_LABELS[def.difficulty]}</span>
        </Badge>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <li className="flex items-center gap-1">
          <Clock size={14} aria-hidden /> {def.hours} h
        </li>
        <li className="flex items-center gap-1">
          <Zap size={14} aria-hidden /> {def.ap > 0 ? `${def.ap} AP` : 'No AP'}
        </li>
        <li className="flex items-center gap-1">
          <Coins size={14} aria-hidden /> {def.money > 0 ? formatMoney(def.money) : 'Free'}
        </li>
        <li>Fatigue {preview.fatigue > 0 ? `+${preview.fatigue}` : preview.fatigue}%</li>
        <li>Morale {moraleText}</li>
      </ul>

      <details className="group mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-gold-400">Details</summary>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-semibold text-ink">Expected experience</p>
            <ul className="mt-1 space-y-1">
              {preview.effects.map((e) => (
                <li key={e.stat} className="flex justify-between gap-3 text-ink-muted">
                  <span>
                    {e.label} <span className="text-ink-faint">({e.value})</span>
                  </span>
                  <span className="tabular-nums">
                    ~{e.expectedXp} XP <span className="text-ink-faint">of {e.needed}, ×{e.multiplier.toFixed(2)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink-faint">
              Results vary by session quality. Skills you have already developed gain less
              {preview.efficiency < 1 ? `, and fatigue cuts everything to ${Math.round(preview.efficiency * 100)}%` : ''}
              {preview.repeatFactor < 1 ? `, and repeating today earns ${Math.round(preview.repeatFactor * 100)}%` : ''}.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Required skills</p>
            {preview.requirements.length === 0 ? (
              <p className="text-ink-muted">None</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {preview.requirements.map((r) => (
                  <li key={r.stat} className={r.met ? 'text-emerald-300' : 'text-red-300'}>
                    {r.met ? '✓' : '✗'} {r.label} {r.min}+ <span className="text-ink-faint">(you have {r.value})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-semibold text-ink">Potential benefits</p>
            <ul className="mt-1 list-inside list-disc text-ink-muted">
              {def.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-red-300">{blocked ? preview.blocks[0].text : ''}</p>
        <Button onClick={() => onStart(def)} disabled={blocked} aria-label={`Train: ${def.name}`}>
          {def.choice ? 'Choose…' : 'Train'}
        </Button>
      </div>
    </li>
  );
}
