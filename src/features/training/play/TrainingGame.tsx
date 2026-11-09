import { careerPrediction } from "@/game/prediction/adapters";
import { CareerPredictionPanel } from "@/features/prediction/CareerPrediction";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { getRankedNpcs } from "@/game/npc/rankings";
import { createRng, mixSeed } from "@/game/rng";
import {
  chooseOpening,
  situationOrder,
  type OpeningContext,
} from "@/game/openings/situations";
import { simulateGame } from "@/game/openings/simulate";
import {
  ENDINGS,
  OBJECTIVES,
  OBJECTIVE_BY_ID,
  ODDS,
  setupFor,
  type OddsId,
} from "@/game/play/objectives";
import { opponentFromNpc, type Opponent } from "@/game/play/opponent";
import { practiceBlock, trainingHoursFor } from "@/game/play/practice";
import {
  findTimeControl,
  TRAINING_TIME_CONTROLS,
} from "@/game/play/timeControls";
import { strengthFor } from "@/game/engine/strength";
import { analyzeGame } from "@/game/engine/analysis";
import { engineManager } from "@/game/engine/manager";
import { gameFromSans } from "@/game/chess/rules";
import { GAME_CONFIG } from "@/data/config";
import "@/game/match/chessjs";
import { playSimulatedGame } from "@/game/match/headless";
import { useNpcs } from "@/hooks/useNpcs";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { useOpeningDb } from "@/store/openingStore";
import type { ObjectiveId, PieceColor } from "@/types";
import {
  Field,
  gameSeed,
  Segmented,
  selectClass,
  skillAverage,
  StatusLine,
} from "./controls";
import { GameScreen } from "./GameScreen";
import type { SessionConfig } from "./useGameSession";

type ColorChoice = PieceColor | "random";

export function TrainingGame() {
  const save = useSave();
  const simulationAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      simulationAbort.current?.abort();
    },
    [],
  );
  const npcs = useNpcs();
  const db = useOpeningDb();
  const [started, setStarted] = useState<SessionConfig | null>(null);
  const [simulated, setSimulated] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [run, setRun] = useState(0);

  const [opponentId, setOpponentId] = useState<string>("");
  const [elo, setElo] = useState<number | null>(null);
  const [colorChoice, setColorChoice] = useState<ColorChoice>("white");
  const [tcId, setTcId] = useState("none");
  const [objectiveId, setObjectiveId] = useState<ObjectiveId>("free");
  const [odds, setOdds] = useState<OddsId>("pawn");
  const [endingId, setEndingId] = useState(ENDINGS[0].id);
  const [openingId, setOpeningId] = useState("");
  const [query, setQuery] = useState("");
  const [liveFeedback, setLiveFeedback] = useState(true);

  const rating = save.player.rating;
  const candidates = useMemo(
    () =>
      getRankedNpcs(npcs)
        .filter((n) => Math.abs(n.currentElo - rating) <= 700)
        .sort(
          (a, b) =>
            Math.abs(a.currentElo - rating) - Math.abs(b.currentElo - rating),
        )
        .slice(0, 40)
        .sort((a, b) => a.currentElo - b.currentElo),
    [npcs, rating],
  );
  const npc =
    candidates.find((n) => n.id === opponentId) ??
    candidates[Math.floor(candidates.length / 2)] ??
    null;
  const objective = OBJECTIVE_BY_ID[objectiveId];
  const tc = findTimeControl(tcId);
  const block = practiceBlock(save, "training", tc);
  const needsClockProblem = objective.needsClock && tc.category === "none";

  // The openings the player's repertoire would choose in this situation. A suggestion, never a restriction.
  const effectiveColor: PieceColor =
    colorChoice === "random" ? "white" : colorChoice;
  const suggestion = useMemo(() => {
    if (!npc) return null;
    const opponent = opponentFromNpc(npc);
    const ctx: OpeningContext = {
      color: effectiveColor,
      opponent: opponent.temperament,
      whiteFirstMove:
        effectiveColor === "black"
          ? (opponent.lines.white[0]?.[0] ?? null)
          : null,
    };
    return chooseOpening(
      db,
      save.repertoire.preferences,
      ctx,
      createRng(mixSeed(1, 2)),
    );
  }, [db, npc, effectiveColor, save.repertoire.preferences]);

  const openingList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const preferred = new Set(
      Object.values(save.repertoire.preferences).flat(),
    );
    const all = db.entries.filter(
      (e) =>
        !q || e.name.toLowerCase().includes(q) || e.eco.toLowerCase() === q,
    );
    return all
      .sort(
        (a, b) =>
          Number(preferred.has(b.id)) - Number(preferred.has(a.id)) ||
          b.popularity - a.popularity,
      )
      .slice(0, 60);
  }, [db, query, save.repertoire.preferences]);
  const chosenOpening = openingId ? (db.byId.get(openingId) ?? null) : null;

  const needsOpening = !!objective.chooseOpening;
  const ready =
    !!npc && !block && !needsClockProblem && (!needsOpening || !!chosenOpening);

  const build = (): SessionConfig | null => {
    if (!npc) return null;
    const rng = createRng(gameSeed(save));
    const base = opponentFromNpc(npc);
    const opponent: Opponent = { ...base, elo: elo ?? base.elo };
    // The Opening objective fixes the colour to the side that plays the chosen line.
    const color: PieceColor =
      needsOpening && chosenOpening
        ? chosenOpening.side
        : colorChoice === "random"
          ? rng.chance(0.5)
            ? "white"
            : "black"
          : colorChoice;
    const setup = setupFor(objectiveId, color, { odds, ending: endingId }, rng);
    const forced = needsOpening && chosenOpening ? chosenOpening.moves : null;
    const ctx: OpeningContext = {
      color,
      opponent: opponent.temperament,
      whiteFirstMove:
        color === "black"
          ? (forced?.[0] ?? opponent.lines.white[0]?.[0] ?? null)
          : null,
    };
    const situation = chosenOpening
      ? (situationOrder(ctx).find((s) =>
          save.repertoire.preferences[s]?.includes(chosenOpening.id),
        ) ?? null)
      : null;
    return {
      prediction: setup.fen
        ? undefined
        : careerPrediction(save, npc, {
            id: `practice:${save.career.id}:training:${gameSeed(save, 7)}:${save.practice.gameCounter}`,
            color,
            timeControl: tc.category,
            opponentElo: opponent.elo,
            tournamentType: "practice-training",
            opening: chosenOpening?.id,
          }),
      mode: "training",
      opponent,
      color,
      timeControl: tc,
      startFen: setup.fen,
      objective: objectiveId,
      situation,
      rated: false,
      forcedLine: forced,
      strength: strengthFor(opponent.elo),
      noResign: !!objective.noResign,
      allowTakeback: true,
      allowHint: true,
      liveFeedback,
      seed: gameSeed(save, 7),
    };
  };

  if (started) {
    return (
      <GameScreen
        key={run}
        config={started}
        title="Training Game"
        onExit={() => setStarted(null)}
        onAgain={() => {
          setRun((r) => r + 1);
          setStarted(build());
        }}
      />
    );
  }

  /**
   * Simulates the game: both sides are played by the engine at the players' strengths, so the game has real moves
   * that can be reviewed and analysed. If that fails, the result is rolled from the ratings (opening moves only).
   */
  const simulate = async () => {
    const config = build();
    if (!config || !npc || simulationAbort.current) return;
    const controller = new AbortController();
    simulationAbort.current = controller;
    setSimulating(true);
    setSimulated("Simulating the game…");
    const seed = gameSeed(save, 13);
    const played = await playSimulatedGame({
      save,
      npc,
      eloOverride: elo,
      color: config.color,
      timeControl: tc,
      seed,
      db,
      engine: engineManager,
      signal: controller.signal,
    }).catch(() => null);
    simulationAbort.current = null;
    setSimulating(false);
    if (
      controller.signal.aborted ||
      useGameStore.getState().save?.career.id !== save.career.id
    )
      return;
    const fallback = played
      ? null
      : simulateGame(db, save.repertoire.preferences, {
          seed,
          playerRating: rating,
          playerSkill: skillAverage(save),
          color: config.color,
          opponent: config.opponent,
          prediction: config.prediction,
        });
    const moves = played?.moves ?? fallback!.moves;
    const outcome = played?.outcome ?? fallback!.outcome;
    const termination = played?.termination ?? fallback!.termination;
    const result = useGameStore.getState().recordPracticeGame(
      {
        prediction: fallback?.prediction ?? config.prediction,
        predictionSource: fallback ? "abstract" : "engine-simulated",
        mode: "training",
        opponent: config.opponent,
        color: config.color,
        outcome,
        termination,
        timeControl: tc,
        startFen: null,
        moves,
        objective: objectiveId,
        situation: fallback?.situation ?? null,
        rated: false,
        simulated: true,
      },
      db,
    );
    setSimulating(false);
    if (!result) return setSimulated("No career is loaded.");
    setSimulated(
      `Simulated game against ${config.opponent.name}: ${outcome}${result.game.openingName ? `, ${result.game.openingName}` : ""}. ${played ? "Analysing it now: open Games > History to read the analysis." : "Only the opening moves could be simulated."} ${result.gains.map((g) => `+${g.xp} ${g.stat}${g.levels ? ` (level ${g.value}!)` : ""}`).join(" · ")} · -${result.apSpent} AP`,
    );
    if (!played || moves.length < 2) return;
    // Analyse in the background; the result is stored on the game.
    const careerId = save.career.id;
    const state = gameFromSans(moves);
    analyzeGame(engineManager, {
      game: state,
      depth: GAME_CONFIG.practice.analysisDepth,
      bookPlies: db.classify(moves)?.bookPlies ?? 0,
    })
      .then((data) => {
        if (useGameStore.getState().save?.career.id === careerId)
          useGameStore.getState().attachAnalysis(result.game.id, {
            engine: data.engine,
            depth: data.depth,
            evals: data.evals,
            labels: data.labels,
            whiteAccuracy: data.whiteAccuracy,
            blackAccuracy: data.blackAccuracy,
          });
      })
      .catch(() => undefined);
  };

  return (
    <Card>
      <CardTitle
        aside={
          <Badge>
            Costs {GAME_CONFIG.practice.ap.training} AP · {trainingHoursFor(tc)}{" "}
            training hour{trainingHoursFor(tc) === 1 ? "" : "s"}
          </Badge>
        }
      >
        Training Game
      </CardTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Play a full game against a ranked player with a goal in mind. You get
        feedback and an engine analysis afterwards, and experience in the skills
        the goal trains.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Opponent"
          hint={
            npc
              ? `${npc.title !== "none" ? `${npc.title} · ` : ""}${npc.style} style`
              : undefined
          }
        >
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={npc?.id ?? ""}
              onChange={(e) => {
                setOpponentId(e.target.value);
                setElo(null);
              }}
            >
              {candidates.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · Elo {n.currentElo}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label={`Opponent Elo: ${elo ?? npc?.currentElo ?? "-"}`}
          hint={
            elo === null
              ? "Their own rating. Move the slider to play a stronger or weaker version."
              : "Adjusted. Slide fully back to the rating to reset."
          }
        >
          {(id) => (
            <input
              id={id}
              type="range"
              min={600}
              max={3000}
              step={25}
              value={elo ?? npc?.currentElo ?? 1500}
              onChange={(e) =>
                setElo(
                  Number(e.target.value) === npc?.currentElo
                    ? null
                    : Number(e.target.value),
                )
              }
              className="w-full accent-gold-500"
            />
          )}
        </Field>
        <Segmented<ColorChoice>
          label="Colour"
          value={
            needsOpening && chosenOpening ? chosenOpening.side : colorChoice
          }
          onChange={setColorChoice}
          options={[
            {
              id: "white",
              label: "White",
              disabled: needsOpening && !!chosenOpening,
            },
            {
              id: "black",
              label: "Black",
              disabled: needsOpening && !!chosenOpening,
            },
            { id: "random", label: "Random", disabled: needsOpening },
          ]}
        />
        <Field
          label="Time control"
          hint={
            tc.category === "none"
              ? "No clock: take as long as you like."
              : `${tc.category} · the opponent plays at human speed`
          }
        >
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={tcId}
              onChange={(e) => setTcId(e.target.value)}
            >
              {TRAINING_TIME_CONTROLS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold text-ink">
          Training objective
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {OBJECTIVES.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${objectiveId === o.id ? "border-gold-500 bg-gold-500/10" : "border-white/10 bg-navy-900 hover:border-gold-500/40"}`}
            >
              <input
                type="radio"
                name="objective"
                className="mt-1 accent-gold-500"
                checked={objectiveId === o.id}
                onChange={() => setObjectiveId(o.id)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {o.label}
                </span>
                <span className="block text-xs text-ink-muted">
                  {o.description}
                </span>
                <span className="mt-1 block text-[11px] text-gold-300">
                  Trains{" "}
                  {o.effects
                    .slice(0, 3)
                    .map((e) => e.stat)
                    .join(", ")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {objective.chooseSetup === "odds" && (
        <div className="mt-4 max-w-xs">
          <Field
            label={objectiveId === "conversion" ? "You are up" : "You are down"}
          >
            {(id) => (
              <select
                id={id}
                className={selectClass}
                value={odds}
                onChange={(e) => setOdds(e.target.value as OddsId)}
              >
                {ODDS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}
      {objective.chooseSetup === "ending" && (
        <div className="mt-4 max-w-md">
          <Field
            label="Ending"
            hint={ENDINGS.find((e) => e.id === endingId)?.goal}
          >
            {(id) => (
              <select
                id={id}
                className={selectClass}
                value={endingId}
                onChange={(e) => setEndingId(e.target.value)}
              >
                {ENDINGS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}
      {needsOpening && (
        <div className="mt-4">
          <Field
            label="Opening to practise"
            hint="Your preferred openings come first. The opponent follows the book so you reach this line, and you play the side that chooses it."
          >
            {(id) => (
              <>
                <input
                  id={id}
                  type="search"
                  placeholder="Search by name or ECO code"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={selectClass}
                />
                <ul
                  className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-white/10"
                  aria-label="Openings"
                >
                  {openingList.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-pressed={openingId === e.id}
                        onClick={() => setOpeningId(e.id)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${openingId === e.id ? "bg-gold-500/15 text-gold-300" : "text-ink hover:bg-white/5"}`}
                      >
                        <span>
                          {e.eco} · {e.name}
                        </span>
                        <span className="text-xs text-ink-faint">{e.side}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Field>
        </div>
      )}

      {suggestion && !needsOpening && (
        <p className="mt-4 text-sm text-ink-muted">
          Your repertoire would steer you toward{" "}
          <span className="font-semibold text-ink">
            {suggestion.entry.name}
          </span>{" "}
          here. Choose "Opening practice" to drill it.
        </p>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={liveFeedback}
          onChange={(e) => setLiveFeedback(e.target.checked)}
          className="accent-gold-500"
        />
        Tell me after each move how good it was
      </label>

      <div className="mt-5 space-y-2">
        {block && <StatusLine tone="warn">{block}</StatusLine>}
        {needsClockProblem && (
          <StatusLine tone="warn">
            Time management needs a time control. Pick one with a clock.
          </StatusLine>
        )}
        {needsOpening && !chosenOpening && (
          <StatusLine>Pick an opening to practise.</StatusLine>
        )}
        {simulated && <StatusLine>{simulated}</StatusLine>}
        {npc && objectiveId === "free" && (
          <CareerPredictionPanel
            opponent={npc}
            options={{
              color: colorChoice === "random" ? "unknown" : colorChoice,
              timeControl: tc.category,
              opponentElo: elo ?? npc.currentElo,
              tournamentType: "practice-training",
            }}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!ready} onClick={() => setStarted(build())}>
            Start game
          </Button>
          <Button
            variant="secondary"
            disabled={
              !npc ||
              !!block ||
              needsOpening ||
              objectiveId !== "free" ||
              simulating
            }
            onClick={() => void simulate()}
            title="Skip the board: the engine plays both sides at their strengths, and the game is analysed afterwards"
          >
            {simulating ? "Simulating…" : "Simulate instead"}
          </Button>
        </div>
        <p className="text-xs text-ink-faint">
          A simulated game costs the same AP and hours and earns{" "}
          {Math.round(GAME_CONFIG.practice.simulatedXp * 100)}% of the
          experience. Your preferred openings are used for the opening that is
          recorded, and never change the result.
        </p>
      </div>
    </Card>
  );
}
