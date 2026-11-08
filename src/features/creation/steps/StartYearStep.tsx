import { useMemo, useState } from 'react';
import { getEventsForYear } from '@/data/chess/historicalEvents';
import { GAME_CONFIG } from '@/data/config';
import { getEra } from '@/data/eras';
import { getCountry } from '@/data/world/countries';
import { previewLegends } from '@/game/npc/legends';
import { ageAtStart, birthDateProblem, toIsoDate } from '@/game/player/birth';
import { cn } from '@/utils/cn';
import type { CharacterDraft } from '../useCharacterDraft';

const PREVIEW_ROWS = 8;

export function StartYearStep({ draft, update }: { draft: CharacterDraft; update: (p: Partial<CharacterDraft>) => void }) {
  const { min, max, presets } = GAME_CONFIG.startYear;
  const [text, setText] = useState(String(draft.startYear));
  const year = draft.startYear;
  const era = getEra(year);
  const legends = useMemo(() => previewLegends(year, draft.alternateHistory), [year, draft.alternateHistory]);
  const events = useMemo(() => getEventsForYear(year), [year]);
  const parsed = Number(text);
  const inputValid = Number.isInteger(parsed) && parsed >= min && parsed <= max;
  const birthProblem = birthDateProblem(draft.birthDate, year);

  const choose = (y: number) => {
    setText(String(y));
    update({ startYear: y });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm text-ink-muted">Pick the year your career begins. The players, events and rating levels you meet depend on it.</p>
        <div role="radiogroup" aria-label="Career start year" className="flex flex-wrap gap-2">
          {presets.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={year === y}
              onClick={() => choose(y)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums transition-colors',
                year === y ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 text-ink-muted hover:text-ink',
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm text-ink-muted">
          Or enter any year from {min} to {max}
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= min && n <= max) update({ startYear: n });
            }}
            aria-invalid={!inputValid}
            className="mt-1.5 w-32 rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 tabular-nums text-ink outline-none focus:border-gold-500"
          />
        </label>
        <p className="mt-1.5 min-h-5 text-xs text-red-300" aria-live="polite">
          {inputValid ? '' : `Enter a whole year between ${min} and ${max}. Your career will start in ${year}.`}
        </p>
      </div>

      <p className={cn('rounded-lg border p-3 text-sm', birthProblem ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-white/[0.06] bg-navy-900 text-ink')} aria-live="polite">
        {birthProblem ? (
          <>
            {birthProblem} Go back to Identity to change your date of birth ({toIsoDate(draft.birthDate)}).
          </>
        ) : (
          <>
            Born {toIsoDate(draft.birthDate)}: you are <span className="font-semibold">{ageAtStart(draft.birthDate, year)}</span> when your career starts in {year}.
          </>
        )}
      </p>

      <div className="rounded-xl border border-white/[0.06] bg-navy-900 p-4">
        <p className="font-display text-lg font-bold text-gold-400">
          {era.name} <span className="text-sm font-medium text-ink-muted">{era.fromYear}–{era.toYear}</span>
        </p>
        <p className="mt-1 text-sm text-ink">{era.summary}</p>
        <p className="mt-1 text-xs text-ink-faint">{era.ratings}</p>
      </div>

      <div>
        <h3 className="mb-2 font-display text-lg font-bold text-ink">Legends you may meet in {year}</h3>
        {legends.length === 0 ? (
          <p className="text-sm text-ink-muted">No historical legends are competing yet. You will face only fictional players.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-faint">
                <tr className="border-b border-white/5">
                  <th className="py-2 pr-2 font-medium">Player</th>
                  <th className="py-2 pr-2 font-medium">Age</th>
                  <th className="py-2 pr-2 font-medium">Stage</th>
                  <th className="py-2 text-right font-medium">Elo</th>
                </tr>
              </thead>
              <tbody>
                {legends.slice(0, PREVIEW_ROWS).map((l) => (
                  <tr key={l.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-2 font-semibold text-ink">
                      <span aria-hidden>{getCountry(l.nationality)?.flag}</span> {l.name}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-ink-muted">{l.age}</td>
                    <td className="py-2 pr-2 text-ink-muted">{l.stage}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-gold-400">{l.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-faint">
          {legends.length > PREVIEW_ROWS ? `Showing ${PREVIEW_ROWS} of ${legends.length} active legends. ` : ''}
          Thousands of fictional players of every level fill the rest of the field.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-display text-lg font-bold text-ink">Competitive calendar in {year}</h3>
        <ul className="grid gap-x-4 gap-y-1 text-sm text-ink sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-2 border-b border-white/5 py-1.5">
              <span className="truncate">{e.name}</span>
              <span className="shrink-0 text-xs text-ink-faint">{e.city}</span>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input type="checkbox" checked={draft.alternateHistory} onChange={(e) => update({ alternateHistory: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#d4a94a]" />
        <span>
          <span className="font-semibold text-ink">Alternate history mode (optional)</span>
          <span className="block">Every historical legend competes in {year} at their peak, whatever their real era. You can change this later in Profile.</span>
        </span>
      </label>
    </div>
  );
}
