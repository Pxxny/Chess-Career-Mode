import { GAME_CONFIG } from '@/data/config';
import { ageAtStart, BIRTH_YEAR_MAX, BIRTH_YEAR_MIN, birthDateProblem, daysInMonth, MONTH_NAMES, type BirthDate } from '@/game/player/birth';
import type { PlayerGender } from '@/types';
import { cn } from '@/utils/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CitySelect } from '../CitySelect';
import { CountrySelect } from '../CountrySelect';
import type { CharacterDraft } from '../useCharacterDraft';

export const GENDER_OPTIONS: Array<{ value: PlayerGender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

export const genderLabel = (g: PlayerGender | null): string => GENDER_OPTIONS.find((o) => o.value === g)?.label ?? '–';

interface StepProps {
  draft: CharacterDraft;
  update: (patch: Partial<CharacterDraft>) => void;
}

const SELECT_CLASS =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 text-ink outline-none focus:border-gold-500';
const BIRTH_YEARS = Array.from({ length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 }, (_, i) => BIRTH_YEAR_MAX - i);

export function IdentityStep({ draft, update }: StepProps) {
  const { birthDate } = draft;
  // Changing the month or year can make the chosen day impossible (31 February), so the day follows.
  const setBirth = (patch: Partial<BirthDate>) => {
    const next = { ...birthDate, ...patch };
    next.day = Math.min(next.day, daysInMonth(next.year, next.month));
    update({ birthDate: next });
  };
  const problem = birthDateProblem(birthDate, draft.startYear);
  return (
    <div className="flex flex-col gap-5">
      <label className="text-sm text-ink-muted">
        Full name
        <input
          value={draft.name}
          maxLength={GAME_CONFIG.maxNameLength}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Your full name"
          autoComplete="name"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 text-ink outline-none placeholder:text-ink-faint focus:border-gold-500"
        />
      </label>

      <fieldset>
        <legend className="text-sm text-ink-muted">Date of birth</legend>
        <div className="grid grid-cols-[1fr_2fr_1.3fr] gap-2">
          <label className="text-xs text-ink-faint">
            Day
            <select aria-label="Birth day" value={birthDate.day} onChange={(e) => setBirth({ day: Number(e.target.value) })} className={SELECT_CLASS}>
              {Array.from({ length: daysInMonth(birthDate.year, birthDate.month) }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-faint">
            Month
            <select aria-label="Birth month" value={birthDate.month} onChange={(e) => setBirth({ month: Number(e.target.value) })} className={SELECT_CLASS}>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-faint">
            Year
            <select aria-label="Birth year" value={birthDate.year} onChange={(e) => setBirth({ year: Number(e.target.value) })} className={SELECT_CLASS}>
              {BIRTH_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={cn('mt-1.5 text-xs', problem ? 'text-red-300' : 'text-ink-faint')} aria-live="polite">
          {problem ?? `You will be ${ageAtStart(birthDate, draft.startYear)} when your career starts in ${draft.startYear}. You can change the start year later in this form.`}
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-sm text-ink-muted">Gender</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GENDER_OPTIONS.map((g) => (
            <label
              key={g.value}
              className={cn(
                'cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-400',
                draft.gender === g.value ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 text-ink-muted hover:text-ink',
              )}
            >
              <input type="radio" name="gender" value={g.value} checked={draft.gender === g.value} onChange={() => update({ gender: g.value })} className="sr-only" />
              {g.label}
            </label>
          ))}
        </div>
      </fieldset>

      <CountrySelect
        value={draft.country}
        onChange={(country) => {
          // Re-picking the same nationality keeps the chosen city; a different one clears it.
          if (country.code !== draft.country?.code) update({ country, city: null });
        }}
      />
      {/* Keyed by country so a failed city list resets when the nationality changes; the rest of the form survives. */}
      <ErrorBoundary key={draft.country?.code ?? 'none'} scope="city selection" compact>
        <CitySelect country={draft.country} value={draft.city} onChange={(city) => update({ city })} />
      </ErrorBoundary>
    </div>
  );
}
