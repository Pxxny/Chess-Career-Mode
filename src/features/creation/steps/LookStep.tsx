import { useState } from "react";
import { Dices, RotateCcw } from "lucide-react";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import { Button } from "@/components/ui";
import { appearanceFor, optionsForGender, DEFAULT_APPEARANCE, randomAppearance } from "@/data/appearance";
import { ageAtStart } from "@/game/player/birth";
import { translateUI } from "@/i18n/translate";
import type { AppearanceField } from "@/types";
import { cn } from "@/utils/cn";
import type { CharacterDraft } from "../useCharacterDraft";

type Field = readonly [AppearanceField, string];
const SECTIONS: { label: string; fields: Field[] }[] = [
  { label: "Face", fields: [["facePreset", "Face shape"], ["skinTone", "Skin tone"], ["browStyle", "Eyebrows"], ["eyeShape", "Eye shape"], ["eyeColor", "Eye color"], ["noseShape", "Nose shape"], ["expression", "Expression"], ["faceDetail", "Face details"]] },
  { label: "Hair", fields: [["hairStyle", "Hairstyle"], ["hairColor", "Hair color"], ["facialHair", "Facial hair"]] },
  { label: "Wardrobe", fields: [["clothing", "Clothing"], ["clothingColor", "Clothing color"], ["glasses", "Glasses"], ["frameColor", "Frame color"], ["accessory", "Accessory"]] },
  { label: "Portrait background", fields: [["portraitBackground", "Background color"]] },
];

export function LookStep({ draft, update }: { draft: CharacterDraft; update: (patch: Partial<CharacterDraft>) => void }) {
  const [section, setSection] = useState(0);
  const age = ageAtStart(draft.birthDate, draft.startYear);
  const look = appearanceFor(draft.appearance, draft.gender, age);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(200px,245px)_minmax(0,1fr)]">
      <aside className="look-preview grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-navy-600 bg-navy-900 p-3 lg:top-6 lg:grid-cols-1 lg:justify-items-center lg:self-start lg:p-4">
        <CharacterPortrait appearance={look} age={age} gender={draft.gender} label="Portrait preview" className="h-20 w-20 border border-gold-500/60 sm:h-28 sm:w-28 lg:h-44 lg:w-44" />
        <div className="min-w-0 lg:text-center">
          <p className="break-words font-semibold">{draft.name || translateUI("Your player")}</p>
          <p className="text-xs text-ink-muted">{draft.gender === "female" ? "Female wardrobe" : draft.gender === "male" ? "Male wardrobe" : "Open wardrobe"} · {translateUI(`Age ${age}`)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-center">
            <Button variant="secondary" onClick={() => update({ appearance: randomAppearance(Math.random, draft.gender, age, true) })}>
              <Dices size={16} aria-hidden /> Randomize
            </Button>
            <Button variant="secondary" onClick={() => update({ appearance: appearanceFor(DEFAULT_APPEARANCE, draft.gender, age) })}>
              <RotateCcw size={16} aria-hidden /> Reset
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div role="group" aria-label="Look sections" className="mb-4 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {SECTIONS.map(({ label }, index) => (
            <button key={label} type="button" aria-pressed={section === index} onClick={() => setSection(index)}
              className={cn("min-h-11 rounded-xl px-3 py-2 text-sm font-semibold", section === index ? "bg-gold-500/15 text-gold-300" : "bg-navy-900 text-ink-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 rounded-2xl border border-navy-600 bg-navy-900 p-3 sm:p-4">
          {SECTIONS[section].fields.map(([field, label]) => {
            const options = optionsForGender(field, draft.gender, age);
            if (options.length < 2 || (field === "frameColor" && look.glasses === "none")) return null;
            return (
              <fieldset key={field} className="min-w-0">
                <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(option => (
                    <button key={option.id} type="button" aria-pressed={look[field] === option.id} aria-label={option.label} title={translateUI(option.label)}
                      className={cn("grid min-h-11 place-items-center rounded-lg border px-2.5 text-sm", option.color && "w-11 px-0", look[field] === option.id ? "border-gold-400 bg-gold-500/15 text-gold-300" : "border-navy-600 text-ink-muted hover:text-ink")}
                      onClick={() => update({ appearance: { ...look, [field]: option.id } })}>
                      {option.color ? <span aria-hidden className="h-6 w-6 rounded-full border border-white/20" style={{ background: option.color }} /> : option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>
    </div>
  );
}
