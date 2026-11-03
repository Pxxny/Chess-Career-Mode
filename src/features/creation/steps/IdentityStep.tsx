import { GAME_CONFIG } from '@/data/config';
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

export function IdentityStep({ draft, update }: StepProps) {
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
