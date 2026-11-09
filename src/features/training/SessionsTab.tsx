import { SectionMenu } from "@/components/ui";
import { useState } from "react";
import { Badge, Card, CardTitle } from "@/components/ui";
import {
  CATEGORY_INFO,
  CATEGORY_ORDER,
  sessionsIn,
} from "@/data/trainingSessions";
import { MASTER_STYLE_STAT } from "@/data/stats";
import { isEligible, registrationOpen } from "@/game/world/schedule";
import type { SessionOptions, SessionResult } from "@/game/training/engine";
import { useGameStore } from "@/store/gameStore";
import type { TrainingCategory, TrainingSessionDef } from "@/types";
import { ChoiceDialog, type ChoiceOption } from "./ChoiceDialog";
import { DevelopmentCard } from "./DevelopmentCard";
import { RestCard } from "./RestCard";
import { SessionCard } from "./SessionCard";
import { ThematicDialog, type ThematicResult } from "./ThematicDialog";
import { TrainingStatus } from "./TrainingStatus";
import { useTraining } from "./useTraining";

type Outcome = Extract<SessionResult, { ok: true }>["outcome"];

const NEARBY_ELO = 300;
const MAX_CHOICES = 8;

export function SessionsTab() {
  const { save, ranked, schedule, recommendation, morale } = useTraining();
  const train = useGameStore((s) => s.train);
  const recordOpeningStudy = useGameStore((s) => s.recordOpeningStudy);
  const [category, setCategory] = useState<TrainingCategory>(
    recommendation.category,
  );
  const [active, setActive] = useState<TrainingSessionDef | null>(null);
  const [thematic, setThematic] = useState(false);
  const [result, setResult] = useState<{
    name: string;
    outcome?: Outcome;
    error?: string;
  } | null>(null);

  const run = (def: TrainingSessionDef, options?: SessionOptions) => {
    const r = train(def.id, options);
    setResult(
      r.ok
        ? { name: def.name, outcome: r.outcome }
        : { name: def.name, error: r.error },
    );
    setActive(null);
    setThematic(false);
  };

  const start = (def: TrainingSessionDef) => {
    if (def.id === "thematic-games") setThematic(true);
    else if (def.choice) setActive(def);
    else run(def);
  };

  const { player } = save;
  const opponents: ChoiceOption[] = ranked
    .filter((n) => Math.abs(n.currentElo - player.rating) <= NEARBY_ELO)
    .sort(
      (a, b) =>
        Math.abs(a.currentElo - player.rating) -
        Math.abs(b.currentElo - player.rating),
    )
    .slice(0, MAX_CHOICES)
    .map((n) => ({
      id: n.id,
      label: n.name,
      detail: `Elo ${n.currentElo} · ${n.style} style`,
    }));
  const events: ChoiceOption[] = schedule
    .filter(
      (e) =>
        registrationOpen(e) && isEligible(e, player.rating, player.reputation),
    )
    .slice(0, MAX_CHOICES)
    .map((e) => ({
      id: e.id,
      label: e.name,
      detail: `${e.level} · starts year ${e.year}, week ${e.week}`,
    }));
  const masters = ranked
    .filter((n) => n.kind === "legend")
    .slice(0, MAX_CHOICES);
  const masterOptions: ChoiceOption[] = masters.map((n) => ({
    id: n.id,
    label: n.name,
    detail: `${n.style} style · Elo ${n.currentElo}`,
  }));

  const pick = (id: string) => {
    if (!active) return;
    if (active.choice === "opponent") {
      const n = ranked.find((x) => x.id === id);
      if (n)
        run(active, {
          opponent: { id: n.id, name: n.name, elo: n.currentElo },
        });
    } else if (active.choice === "tournament") {
      const e = schedule.find((x) => x.id === id);
      if (e) run(active, { event: { id: e.id, name: e.name } });
    } else if (active.choice === "master") {
      const n = masters.find((x) => x.id === id);
      if (n)
        run(active, {
          master: { name: n.name, stat: MASTER_STYLE_STAT[n.style] },
        });
    }
  };

  const finishThematic = (r: ThematicResult) => {
    const def = sessionsIn("chess").find((s) => s.id === "thematic-games");
    if (def) {
      run(def, {
        openingId: r.openingId,
        openingName: r.openingName,
        color: r.color,
        score: r.score,
      });
      // Studying an opening raises the player's knowledge of it. Book openings and the ECO database share their names.
      recordOpeningStudy(r.openingId, r.openingName, r.score);
    }
  };

  const dialog =
    active?.choice === "opponent"
      ? {
          title: "Scout Opponent",
          description: "Pick a rival close to your rating to study.",
          options: opponents,
          empty: "No ranked players are near your rating right now.",
        }
      : active?.choice === "tournament"
        ? {
            title: "Tournament Preparation",
            description: "Pick a tournament you can still register for.",
            options: events,
            empty: "No tournaments are open for you to prepare for.",
          }
        : {
            title: "Study Master Game",
            description: "Pick a master. Their style adds extra experience.",
            options: masterOptions,
            empty: "No master games are available in this era.",
          };

  return (
    <>
      <TrainingStatus save={save} morale={morale} />
      <RestCard />

      {result && (
        <Card className="mb-4" aria-live="polite">
          <CardTitle>{result.name}</CardTitle>
          {result.error ? (
            <p className="text-sm text-red-300">{result.error}</p>
          ) : (
            result.outcome && (
              <>
                <p className="text-sm text-ink">
                  Session quality:{" "}
                  <span className="font-semibold text-gold-400">
                    {result.outcome.record.qualityLabel}
                  </span>{" "}
                  · morale {result.outcome.record.moraleDelta >= 0 ? "+" : ""}
                  {result.outcome.record.moraleDelta} · fatigue now{" "}
                  {Math.round(result.outcome.record.fatigueAfter)}%
                </p>
                {result.outcome.record.detail && (
                  <p className="text-sm text-ink-muted">
                    {result.outcome.record.detail}
                  </p>
                )}
                <ul className="mt-2 space-y-0.5 text-sm text-ink-muted">
                  {result.outcome.record.gains.map((g) => (
                    <li key={g.stat}>
                      +{g.xp} XP {g.stat}
                      {g.levels > 0 && (
                        <span className="ml-1 font-semibold text-emerald-300">
                          level up to {g.value}!
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )
          )}
        </Card>
      )}

      <SectionMenu
        label="Training categories"
        items={CATEGORY_ORDER.map((id) => ({
          id,
          label: CATEGORY_INFO[id].label,
          detail: recommendation.category === id ? "Recommended" : undefined,
        }))}
        active={category}
        onChange={setCategory}
      />
      {recommendation.category === category ? (
        <p className="mb-3 text-sm text-gold-300">
          Recommended: {recommendation.reason}
        </p>
      ) : (
        <p className="mb-3 text-sm text-ink-muted">
          {CATEGORY_INFO[category].description}
        </p>
      )}

      <Card className="mb-4">
        <CardTitle
          aside={<Badge>{sessionsIn(category).length} sessions</Badge>}
        >
          {CATEGORY_INFO[category].label}
        </CardTitle>
        <ul className="space-y-3">
          {sessionsIn(category).map((def) => (
            <SessionCard key={def.id} def={def} save={save} onStart={start} />
          ))}
        </ul>
      </Card>

      <DevelopmentCard save={save} />

      <ChoiceDialog
        open={active !== null}
        title={dialog.title}
        description={dialog.description}
        options={dialog.options}
        emptyText={dialog.empty}
        onPick={pick}
        onClose={() => setActive(null)}
      />
      <ThematicDialog
        open={thematic}
        seed={save.training.sessionCounter + save.world.date.week * 31}
        onFinish={finishThematic}
        onClose={() => setThematic(false)}
      />
    </>
  );
}
