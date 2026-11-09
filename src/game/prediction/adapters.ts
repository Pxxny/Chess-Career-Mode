import { getBookOpening } from "@/data/chess/openingBook";
import type {
  ActiveTournament,
  GameSave,
  Npc,
  PieceColor,
  PlayStyle,
} from "@/types";
import type { Opponent } from "@/game/play/opponent";
import { bounded } from "./config";
import {
  eloExpected,
  predictMatch,
  scoreOf,
  invertOutcome,
  outcomeOf,
} from "./model";
import { predictionOf, recordPredictions } from "./statistics";
import type {
  PredictionActor,
  PredictionConditions,
  PredictionEnvironment,
  PredictionObservation,
  PredictionSnapshot,
  PredictionTime,
} from "./types";

export const predictionStamp = (
  save: GameSave,
): PredictionSnapshot["stamp"] => ({ ...save.world.date, day: save.world.day });
export const predictionEnvironment = (
  save: GameSave,
): PredictionEnvironment => ({
  state: predictionOf(save),
  stamp: predictionStamp(save),
  player: playerActor(save),
});
const openingCode = (id: string): string =>
  getBookOpening(id)?.eco ?? id.match(/^[A-E]\d{2}/)?.[0] ?? id;
const actorStyle = (save: GameSave): PlayStyle =>
  save.player.tendencies.aggression >= 65
    ? "attacking"
    : save.player.tendencies.aggression <= 35
      ? "solid"
      : save.player.tendencies.complexity >= 65
        ? "dynamic"
        : "universal";
export function playerActor(
  save: GameSave,
  elo = save.player.rating,
): PredictionActor {
  const p = save.player,
    a = p.attributes,
    s = p.skills;
  const games = save.history.games.slice(-10);
  const formResidual = games.reduce(
    (sum, g) =>
      sum + scoreOf(g.outcome) - eloExpected(g.ratingBefore, g.opponentElo),
    0,
  );
  return {
    id: "player",
    name: p.name,
    elo,
    peakElo: Math.max(elo, p.peakRating),
    style: actorStyle(save),
    archetype: p.archetype,
    data: "career",
    openings: {
      white: save.repertoire.preferences.white.slice(0, 4).map(openingCode),
      black: save.repertoire.preferences.black.slice(0, 4).map(openingCode),
    },
    skills: {
      tactics: s.tactics,
      calculation: s.calculation,
      opening: s.opening,
      positional: a.positionalUnderstanding,
      endgame: s.endgame,
      visualization: a.visualization,
      timeManagement: s.timeManagement,
      concentration: a.concentration,
      mental: (a.mentalStability + a.resilience + s.psychology) / 3,
      preparation: a.openingPreparation,
    },
    morale: p.morale,
    fatigue: save.training.fatigue,
    form: bounded(50 + (50 * formResidual) / (games.length + 10), 0, 100),
    preparation: 0,
  };
}
/** Deterministic proxies use ONLY real fields. The UI identifies them as NPC estimates; no fictitious measured attributes. */
export function npcActor(npc: Npc, round = 1): PredictionActor {
  const reference = bounded((npc.currentElo - 500) / 25, 5, 95);
  const skill = (key: string): number =>
    bounded(
      reference +
        (npc.strengths.some((s) => s === key) ? 10 : 0) -
        (npc.weaknesses.some((s) => s === key) ? 10 : 0),
      0,
      100,
    );
  const openings: NonNullable<PredictionActor["openings"]> = {
    white: [],
    black: [],
  };
  for (const id of npc.preferredOpenings) {
    const entry = getBookOpening(id);
    if (entry) openings[entry.side].push(entry.eco);
  }
  const fatigue = {
    minimal: 4,
    casual: 8,
    regular: 12,
    intense: 18,
    obsessive: 24,
  }[npc.training.intensity];
  return {
    id: npc.id,
    name: npc.name,
    elo: npc.currentElo,
    peakElo: npc.peakElo,
    style: npc.style,
    archetype: npc.style,
    data: "npc-estimate",
    openings,
    skills: {
      tactics: skill("tactics"),
      calculation: skill("calculation"),
      opening: skill("opening"),
      positional: skill("strategy"),
      endgame: skill("endgame"),
      visualization: skill("calculation"),
      timeManagement: skill("timeManagement"),
      concentration: skill("psychology"),
      mental: skill("psychology"),
      preparation: skill("opening"),
    },
    morale: npc.morale,
    form: npc.form,
    fatigue: bounded(
      fatigue + (round - 1) * 4.5 + Math.max(0, npc.age - 55) * 0.4,
      0,
      90,
    ),
    preparation: 0,
  };
}
export const ratingActor = (
  elo: number,
  name: string,
  id = "calculator",
  style?: PlayStyle,
): PredictionActor => ({
  id,
  name,
  elo,
  data: "rating-only",
  ...(style ? { style, archetype: style } : {}),
});
export function conditionsFor(
  timeControl: PredictionTime = "classical",
  color: PieceColor | "unknown" = "unknown",
  tournamentType = "calculator",
): PredictionConditions {
  return {
    color,
    timeControl,
    tournamentType,
    importance: 0,
    pressure: 0,
    opening: "unknown",
  };
}
export interface CareerPredictionOptions {
  id: string;
  color: PieceColor | "unknown";
  timeControl: PredictionTime;
  eventId?: string;
  eventName?: string;
  tournamentType?: string;
  importance?: number;
  round?: number;
  rounds?: number;
  playerElo?: number;
  opponentElo?: number;
  opening?: string;
}
export function careerPrediction(
  save: GameSave,
  opponent: Npc | Opponent,
  options: CareerPredictionOptions,
): PredictionSnapshot {
  const a = playerActor(save, options.playerElo),
    b =
      "currentElo" in opponent
        ? npcActor(opponent, options.round)
        : ratingActor(
            opponent.elo,
            opponent.name,
            opponent.id ?? "engine",
            opponent.style,
          );
  if (options.opponentElo !== undefined) b.elo = options.opponentElo;
  const prepared =
    options.eventId && save.competition?.prepared?.eventId === options.eventId
      ? save.competition.prepared
      : null;
  const repIds = prepared
    ? options.color === "black"
      ? [
          ...prepared.repertoire.black,
          ...prepared.repertoire["vs-e4"],
          ...prepared.repertoire["vs-d4"],
        ]
      : prepared.repertoire.white
    : [];
  const planned =
    options.opening ??
    repIds[0] ??
    (options.color === "white"
      ? save.repertoire.preferences.white[0]
      : options.color === "black"
        ? b.openings?.white[0]
        : undefined);
  // Preparation costs are paid in Prepare, not by merely selecting a repertoire here.
  if (prepared) {
    a.preparation = bounded((prepared.depth / 12) * 100, 0, 100);
    a.style = (
      {
        "Rock Solid": "defensive",
        Careful: "solid",
        Balanced: "universal",
        Ambitious: "dynamic",
        "All Out Attacks": "attacking",
      } as const
    )[prepared.plan.approach];
  }
  if (
    options.eventId &&
    save.competition?.scouts.some(
      (s) => s.eventId === options.eventId && s.npcId === opponent.id,
    )
  )
    a.preparation = bounded((a.preparation ?? 0) + 20, 0, 100);
  if (planned) {
    const studied = save.repertoire.study.filter(
      (s) => s.openingId === planned,
    ).length;
    a.openingFamiliarity = bounded(
      (a.skills?.opening ?? 50) + Math.min(15, studied * 3),
      0,
      100,
    );
    if ("preferredOpenings" in opponent)
      b.openingFamiliarity = opponent.preferredOpenings.some(
        (id) => openingCode(id) === openingCode(planned),
      )
        ? 80
        : 50;
  }
  // Online Blitz has its own rating pool: peak, recent form and head-to-head must use that pool too.
  const history =
    options.tournamentType === "practice-blitz"
      ? save.practice.games.filter((g) => g.mode === "blitz")
      : save.history.games;
  if (options.tournamentType === "practice-blitz") {
    a.peakElo = Math.max(a.elo, save.practice.blitzPeak);
    const recent = history.slice(-10);
    a.form = bounded(
      50 +
        (50 *
          recent.reduce(
            (sum, g) =>
              sum +
              scoreOf(g.outcome) -
              eloExpected(g.ratingBefore ?? a.elo, g.opponentElo),
            0,
          )) /
          (recent.length + 10),
      0,
      100,
    );
  }
  const h2h = history
    .filter((g) => !!opponent.id && g.opponentId === opponent.id)
    .slice(-30);
  const conditions: PredictionConditions = {
    ...conditionsFor(
      options.timeControl,
      options.color,
      options.tournamentType ?? "friendly",
    ),
    tournamentName: options.eventName,
    eventId: options.eventId,
    round: options.round,
    rounds: options.rounds,
    importance: options.importance ?? (options.eventId ? 0.65 : 0.2),
    pressure: options.eventId
      ? bounded((options.round ?? 1) / (options.rounds ?? 5), 0, 1)
      : 0,
    opening: planned ? openingCode(planned) : "unknown",
    ...(h2h.length
      ? {
          headToHead: {
            games: h2h.length,
            score: h2h.reduce((s, g) => s + scoreOf(g.outcome), 0),
            expected: h2h.reduce(
              (s, g) => s + eloExpected(g.ratingBefore ?? a.elo, g.opponentElo),
              0,
            ),
          },
        }
      : {}),
  };
  return predictMatch({
    id: options.id,
    stamp: predictionStamp(save),
    player: a,
    opponent: b,
    conditions,
    state: predictionOf(save),
  });
}
/** Freeze every announced pairing before any result is sampled. White is the canonical NPC perspective. */
export function freezeTournamentRound(
  t: ActiveTournament,
  env?: PredictionEnvironment,
): ActiveTournament {
  const index = t.round - 1,
    round = t.pairings[index];
  if (!round) return t;
  const byId = new Map(t.players.map((p) => [p.id, p]));
  return {
    ...t,
    pairings: t.pairings.map((r, i) =>
      i !== index
        ? r
        : r.map((p) => {
            if (p.prediction || p.black === "bye" || p.result !== null)
              return p;
            const w = byId.get(p.white)!,
              b = byId.get(p.black)!;
            const actor = (side: typeof w): PredictionActor => {
              if (side.isPlayer && env?.player) return env.player;
              const original =
                side.predictionActor ??
                ratingActor(side.elo, side.name, side.id);
              return original.data === "npc-estimate"
                ? {
                    ...original,
                    fatigue: bounded(
                      (original.fatigue ?? 0) + (t.round - 1) * 4.5,
                      0,
                      90,
                    ),
                  }
                : original;
            };
            return {
              ...p,
              prediction: predictMatch({
                id: `t:${t.year}:${t.eventId}:${t.seed}:${t.round}:${p.white}:${p.black}`,
                stamp: env?.stamp ?? { year: t.year, week: t.week, day: 1 },
                player: actor(w),
                opponent: actor(b),
                conditions: {
                  ...plannedOpeningConditions(
                    actor(w),
                    actor(b),
                    conditionsFor(
                      t.timeControl.category,
                      "white",
                      t.details?.category ?? t.details?.format ?? "swiss",
                    ),
                  ),
                  importance:
                    t.level === "elite" ? 1 : t.level === "local" ? 0.3 : 0.65,
                  pressure: t.round / t.rounds,
                  tournamentName: t.name,
                  eventId: t.eventId,
                  round: t.round,
                  rounds: t.rounds,
                },
                state: env?.state,
              }),
            };
          }),
    ),
  };
}
export function tournamentObservations(
  t: ActiveTournament,
): PredictionObservation[] {
  return t.pairings.flatMap((round) =>
    round.flatMap((p) =>
      p.prediction &&
      p.result !== null &&
      p.black !== "bye" &&
      p.white !== "player" &&
      p.black !== "player"
        ? [
            {
              prediction: p.prediction,
              result: outcomeOf(p.result),
              scope: "npc" as const,
              source: "abstract" as const,
              eligible: true,
            },
          ]
        : [],
    ),
  );
}
export function recordTournamentPredictions(
  save: GameSave,
  t: ActiveTournament,
): GameSave {
  const first = t.predictionRecordedRounds ?? 0;
  let through = first;
  while (
    through < t.pairings.length &&
    t.pairings[through].every((p) => p.result !== null)
  )
    through++;
  if (through === first) return save;
  const observations = tournamentObservations({
    ...t,
    pairings: t.pairings.slice(first, through),
  });
  const result = recordPredictions(save, observations);
  return result.tournament?.eventId === t.eventId
    ? { ...result, tournament: { ...t, predictionRecordedRounds: through } }
    : result;
}
export function playerView(p: PredictionSnapshot): PredictionSnapshot {
  if (p.player.id === "player") return p;
  if (p.opponent.id !== "player") return p;
  const reverse = (d: typeof p.adjusted) => ({
    win: d.loss,
    draw: d.draw,
    loss: d.win,
    expected: 1 - d.expected,
  });
  return {
    ...p,
    player: p.opponent,
    opponent: p.player,
    conditions: {
      ...p.conditions,
      color: p.conditions.color === "white" ? "black" : "white",
    },
    baseline: reverse(p.baseline),
    adjusted: reverse(p.adjusted),
    eloDifference: -p.eloDifference,
    modifierElo: -p.modifierElo,
    factors: p.factors.map((f) => ({ ...f, elo: -f.elo })),
    classification: (
      {
        "Heavy Underdog": "Heavy Favorite",
        Underdog: "Favorite",
        "Slight Underdog": "Slight Favorite",
        "Even Match": "Even Match",
        "Slight Favorite": "Slight Underdog",
        Favorite: "Underdog",
        "Heavy Favorite": "Heavy Underdog",
      } as const
    )[p.classification],
  };
}
export { invertOutcome };

/** This is the White repertoire plan known beforehand, not a claim about the opening eventually played. */
export function plannedOpeningConditions(
  a: PredictionActor,
  b: PredictionActor,
  conditions: PredictionConditions,
): PredictionConditions {
  if (conditions.opening !== "unknown") return conditions;
  const white =
    conditions.color === "white" ? a : conditions.color === "black" ? b : null;
  return { ...conditions, opening: white?.openings?.white[0] ?? "unknown" };
}

export function compactPrediction(
  p: PredictionSnapshot,
): import("./types").CompactPrediction {
  const {
    id,
    version,
    stamp,
    conditions,
    baseline,
    adjusted,
    eloDifference,
    modifierElo,
    classification,
    confidence,
    support,
  } = p;
  return {
    id,
    version,
    stamp,
    conditions,
    baseline,
    adjusted,
    eloDifference,
    modifierElo,
    classification,
    confidence,
    support,
  };
}
export function compactTournament(t: ActiveTournament): ActiveTournament {
  return {
    ...t,
    players: t.players.map((p) => ({ ...p, predictionActor: undefined })),
    pairings: t.pairings.map((r) =>
      r.map((p) =>
        p.prediction && p.white !== "player" && p.black !== "player"
          ? {
              ...p,
              forecast: compactPrediction(p.prediction),
              prediction: undefined,
            }
          : p,
      ),
    ),
  };
}
