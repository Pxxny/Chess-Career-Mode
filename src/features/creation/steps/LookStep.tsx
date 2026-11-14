import {ageAtStart} from "@/game/player/birth";
import { Dices, RotateCcw } from 'lucide-react';
import { CharacterPortrait } from '@/components/game/CharacterPortrait';
import { Button } from '@/components/ui';
import { appearanceFor, optionsForGender, DEFAULT_APPEARANCE, randomAppearance } from '@/data/appearance';
import type { AppearanceField } from '@/types';
import { cn } from '@/utils/cn';
import type { CharacterDraft } from '../useCharacterDraft';

const GROUPS: Array<{ field: AppearanceField; label: string; swatches?: boolean }> = [
  { field: 'facePreset', label: 'Face' },
  { field: 'skinTone', label: 'Skin tone', swatches: true },
  { field: 'hairStyle', label: 'Hairstyle' },
  { field: 'hairColor', label: 'Hair color', swatches: true },
  { field: 'eyeColor', label: 'Eye color', swatches: true },
  { field: 'facialHair', label: 'Facial hair' },
  { field: 'clothing', label: 'Clothing' },
  { field: 'clothingColor', label: 'Clothing color', swatches: true },
  { field: 'glasses', label: 'Glasses' },
  { field: 'accessory', label: 'Accessory' },
];

export function LookStep({ draft, update }: { draft: CharacterDraft; update: (p: Partial<CharacterDraft>) => void }) {
  const age=ageAtStart(draft.birthDate,draft.startYear),look=appearanceFor(draft.appearance,draft.gender,age);
  const set = (field: AppearanceField, id: string) => update({ appearance: { ...look, [field]: id } });

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="md:sticky md:top-4 md:self-start">
        <CharacterPortrait appearance={look} age={age} gender={draft.gender} label={`${draft.name || 'Your player'} portrait`} className="mx-auto h-44 w-44 border-2 border-gold-500/70 md:h-52 md:w-52" />
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => update({ appearance: randomAppearance(Math.random, draft.gender,age) })}>
            <Dices size={16} aria-hidden /> Randomize
          </Button>
          <Button variant="secondary" onClick={() => update({ appearance: appearanceFor(DEFAULT_APPEARANCE,draft.gender,age) })}>
            <RotateCcw size={16} aria-hidden /> Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5"><p className="text-sm text-ink-muted">Male and female wardrobes use separate hairstyles and outfits. Faces grow with age. Regional face presets are optional and can be chosen for any nationality.</p>
        <p className="text-sm font-semibold text-gold-300">{draft.gender==='female'?'Female wardrobe':draft.gender==='male'?'Male wardrobe':'Open wardrobe'} · Age {age}</p>{age<16&&<p className="text-xs text-ink-muted">Facial hair is unavailable before age 16.</p>}
        {GROUPS.map(({ field, label, swatches }) => (
          <fieldset key={field}>
            <legend className="mb-2 text-sm text-ink-muted">{label}</legend>
            <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
              {optionsForGender(field, draft.gender,age).map((opt) => {
                const active = look[field] === opt.id;
                return swatches ? (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={opt.label}
                    title={opt.label}
                    onClick={() => set(field, opt.id)}
                    className={cn('h-8 w-8 rounded-full border-2 transition-transform', active ? 'scale-110 border-gold-400' : 'border-white/15 hover:border-white/40')}
                    style={{ background: opt.color }}
                  />
                ) : (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set(field, opt.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm font-semibold transition-colors',
                      active ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 text-ink-muted hover:text-ink',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
