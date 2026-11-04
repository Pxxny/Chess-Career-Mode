import { Card, ProgressBar } from '@/components/ui';
import { GAME_CONFIG } from '@/data/config';
import type { Morale } from '@/game/player/morale';
import { hoursLeft } from '@/game/training/engine';
import type { GameSave } from '@/types';
import { formatMoney } from '@/utils/format';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function fatigueLabel(f: number): string {
  if (f >= GAME_CONFIG.sessions.exhaustedAt) return 'Exhausted';
  if (f >= 70) return 'Very tired';
  if (f >= 40) return 'Tired';
  if (f >= 15) return 'Warm';
  return 'Fresh';
}

export function TrainingStatus({ save, morale }: { save: GameSave; morale: Morale }) {
  const { player, training, world } = save;
  const left = hoursLeft(training);
  const items: Array<[string, string]> = [
    ['Time left today', `${left} of ${GAME_CONFIG.sessions.hoursPerDay} h`],
    ['Action points', `${player.ap.current}/${player.ap.max} AP`],
    ['Morale', `${morale.value} (${morale.label})`],
    ['Money', formatMoney(player.money)],
  ];
  return (
    <Card className="mb-4">
      <p className="text-sm text-ink-muted">
        Year {world.date.year}, week {world.date.week}
      </p>
      <p className="font-display text-xl font-bold text-ink">{DAYS[world.day - 1] ?? `Day ${world.day}`}</p>
      <div className="mt-3">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-ink-muted">Fatigue</span>
          <span className="font-semibold tabular-nums text-ink">
            {Math.round(training.fatigue)}% · {fatigueLabel(training.fatigue)}
          </span>
        </div>
        <ProgressBar value={training.fatigue} label="Fatigue" />
        {training.fatigue >= 40 && <p className="mt-1.5 text-xs text-ink-muted">Tired players learn less from every session. Rest to recover.</p>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-navy-700/60 p-3">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {(training.scouting || training.tournamentPrep) && (
        <ul className="mt-4 space-y-1 text-sm text-ink-muted">
          {training.scouting && <li>Scouting report ready: {training.scouting.opponentName} (+3 accuracy against them).</li>}
          {training.tournamentPrep && <li>Tournament plan ready: {training.tournamentPrep.name} (+2 accuracy there).</li>}
        </ul>
      )}
    </Card>
  );
}
