import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GAME_CONFIG } from "@/data/config";
import { toIsoDate } from "@/game/player/birth";
import { useSlotUi } from "@/store/slotUi";
import { ArchetypeStep } from "./steps/ArchetypeStep";
import { ConfirmStep } from "./steps/ConfirmStep";
import { IdentityStep } from "./steps/IdentityStep";
import { LookStep } from "./steps/LookStep";
import { StartYearStep } from "./steps/StartYearStep";
import { startCareer } from "./startCareer";
import { Stepper } from "./Stepper";
import {
  isStepValid,
  STEPS,
  useCharacterDraft,
  type CharacterDraft,
} from "./useCharacterDraft";

const HEADINGS = [
  "Who are you?",
  "What kind of player?",
  "Create your look",
  "When does your career begin?",
  "Confirm your career",
];

function missingForIdentity(d: CharacterDraft): string {
  const missing = [
    !d.name.trim() && "a name",
    !d.gender && "a gender",
    !d.country && "a nationality",
    d.country && !d.city && "a city",
    d.separateBirthPlace &&
      (!d.birthCountry || !d.birthCity.trim()) &&
      "a birth place",
  ].filter(Boolean);
  return missing.length ? `Choose ${missing.join(", ")} to continue.` : "";
}

export function CharacterWizard({ slot }: { slot: number }) {
  const cancelCreation = useSlotUi((s) => s.cancel);
  const { draft, update } = useCharacterDraft();
  const [index, setIndex] = useState(0);
  const [reachable, setReachable] = useState(0);
  const creationLock = useRef(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = STEPS[index];
  const valid = isStepValid(step.id, draft);
  const isLast = index === STEPS.length - 1;

  // Steps stay reachable only up to the first one that is no longer valid.
  let jumpLimit = reachable;
  for (let i = 0; i <= reachable; i++) {
    if (!isStepValid(STEPS[i].id, draft)) {
      jumpLimit = i;
      break;
    }
  }

  useEffect(() => headingRef.current?.focus(), [index]);

  const go = (i: number) => {
    if (i <= jumpLimit) setIndex(i);
  };
  const next = () => {
    if (!valid || isLast) return;
    setIndex(index + 1);
    setReachable((r) => Math.max(r, index + 1));
  };

  const confirm = async () => {
    if (
      !draft.gender ||
      !draft.country ||
      !draft.city ||
      !isStepValid("identity", draft) ||
      creationLock.current
    )
      return;
    creationLock.current = true;
    setCreating(true);
    setError(null);
    try {
      await startCareer(
        {
          name: draft.name,
          gender: draft.gender,
          countryCode: draft.country.code,
          city: draft.city,
          archetype: draft.archetype,
          appearance: draft.appearance,
          startYear: draft.startYear,
          alternateHistory: draft.alternateHistory,
          dateOfBirth: toIsoDate(draft.birthDate),
          birthPlace: {
            countryCode: draft.separateBirthPlace
              ? draft.birthCountry!.code
              : draft.country.code,
            city: draft.separateBirthPlace
              ? draft.birthCity.trim()
              : draft.city.name,
            source: "chosen",
          },
        },
        slot,
      );
    } catch {
      setError(
        "Something went wrong while building your world. Please try again.",
      );
      creationLock.current = false;
      setCreating(false);
    }
  };

  return (
    <div>
      <p className="font-display text-3xl font-bold text-gold-400">
        {GAME_CONFIG.appName}
      </p>
      <p className="mb-6 mt-1 text-ink-muted">
        Create your player for character slot {slot}. This becomes a permanent
        career profile.{" "}
        <button
          type="button"
          onClick={cancelCreation}
          disabled={creating}
          className="font-semibold text-gold-400 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Back to character slots
        </button>
      </p>
      <Stepper current={index} reachable={jumpLimit} onGo={go} />

      <Card>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-5 font-display text-2xl font-bold text-ink outline-none"
        >
          {HEADINGS[index]}
        </h1>
        <ErrorBoundary key={step.id} scope={`${step.title} step`} compact>
          {step.id === "identity" && (
            <IdentityStep draft={draft} update={update} />
          )}
          {step.id === "archetype" && (
            <ArchetypeStep draft={draft} update={update} />
          )}
          {step.id === "look" && <LookStep draft={draft} update={update} />}
          {step.id === "year" && (
            <StartYearStep draft={draft} update={update} />
          )}
          {step.id === "confirm" && <ConfirmStep draft={draft} />}
        </ErrorBoundary>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
          <Button
            variant="secondary"
            onClick={() => go(index - 1)}
            disabled={index === 0 || creating}
          >
            Back
          </Button>
          <div className="flex items-center gap-3">
            {step.id === "identity" && !valid && (
              <span className="hidden text-xs text-ink-faint sm:inline">
                {missingForIdentity(draft)}
              </span>
            )}
            {isLast ? (
              <Button onClick={confirm} disabled={creating}>
                {creating ? "Building your world…" : "Create career"}
              </Button>
            ) : (
              <Button onClick={next} disabled={!valid}>
                Next
              </Button>
            )}
          </div>
        </div>
        {step.id === "identity" && !valid && (
          <p className="mt-2 text-xs text-ink-faint sm:hidden">
            {missingForIdentity(draft)}
          </p>
        )}
      </Card>
    </div>
  );
}
