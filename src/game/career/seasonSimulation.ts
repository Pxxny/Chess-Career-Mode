import { buildEventTeams } from "@/game/competition/teamEvents";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { captureHighlights, highlightsOf } from "./highlights";
import type { GameSave, Npc } from "@/types";
import type { MatchFinish } from "@/game/match/session";
import {
  gameDay,
  bookedStart,
  reservedUntil,
  tournamentSlot,
} from "@/game/competition/agenda";
import { careerSchedule, planningOf, type AnnualFocus } from "./planning";
import { LEARNING_FOCUSES, normalizeLearningFocus, type LearningFocus } from "./learningFocus";
import { yearReviewOf } from "./yearReview";
import { registrationIssue } from "@/game/competition/eligibility";
import {
  registerForEvent,
  registrationStates,
  startRegisteredTournament,
} from "@/game/match/registration";
import { playerOpponentId, completeRound } from "@/game/match/tournament";
import { recordTournament } from "@/game/history/recordGame";
import { archiveCompetition } from "@/game/competition/preparation";
import {
  predictionEnvironment,
  recordTournamentPredictions,
} from "@/game/prediction/adapters";
import {
  recordSharedEvent,
  recordSharedContacts,
} from "@/game/social/relationships";
import {
  AUTO_TRAINING,
  CAREER_JOBS,
  workJob,
  plannedTrainingDay,
} from "@/game/qol/career";
import {
  getStat,
  previewSession,
  performSession,
  takeRest,
} from "@/game/training/engine";
import {
  esportsCommand,
  esportsRoundDay,
  nextEsportsGame,
} from "@/game/esports/core";
export interface SeasonSimulation {
  timing?: {
    games: number;
    gameMs: number;
    searchMs: number;
    lastGameMs: number;
    runMs: number;
  };
  baseline: {
    wins: number;
    draws: number;
    losses: number;
    tournaments: number;
    sessions: number;
  };
  version: 1;
  year: number;
  startDay: number;
  targetDay: number;
  focus: AnnualFocus;
  /** Missing/empty on older saves means automatic training of weaker skills. */
  learningFocus?: LearningFocus[];
  status: "paused" | "completed";
  phase: "choose" | "end-day";
  endRating?: number;
  endMoney?: number;
  startRating: number;
  startMoney: number;
  days: number;
  sessions: number;
  restDays: number;
  workDays: number;
  registrations: number;
  tournaments: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  lastEventDay: number;
  action: string;
  notes: string[];
}
export function seasonOf(save: GameSave): SeasonSimulation | null {
  const s = save.seasonSimulation;
  return s?.version === 1 &&
    Number.isInteger(s.year) &&
    Number.isInteger(s.startDay) &&
    s.targetDay === (s.year + 1) * 364 &&
    s.startDay >= s.year * 364 &&
    s.startDay < s.targetDay &&
    ["balanced", "rating", "competition", "learning"].includes(s.focus) &&
    (s.learningFocus === undefined ||
      (Array.isArray(s.learningFocus) && s.learningFocus.every((id) =>
        LEARNING_FOCUSES.some((f) => f.id === id)))) &&
    ["paused", "completed"].includes(s.status) &&
    ["choose", "end-day"].includes(s.phase) &&
    typeof s.action === "string" &&
    Array.isArray(s.notes) &&
    s.notes.every((n) => typeof n === "string") &&
    [
      s.startRating,
      s.startMoney,
      s.days,
      s.sessions,
      s.restDays,
      s.workDays,
      s.registrations,
      s.tournaments,
      s.games,
      s.wins,
      s.draws,
      s.losses,
    ].every((n) => Number.isFinite(n) && n >= 0) &&
    s.days <= 364 &&
    (s.endRating === undefined || Number.isFinite(s.endRating)) &&
    (s.endMoney === undefined || Number.isFinite(s.endMoney)) &&
    s.baseline &&
    [
      s.baseline.wins,
      s.baseline.draws,
      s.baseline.losses,
      s.baseline.tournaments,
      s.baseline.sessions,
    ].every((n) => Number.isFinite(n) && n >= 0)
    ? s
    : null;
}
export function newSeason(
  save: GameSave,
  focus: AnnualFocus = planningOf(save).current.focus,
  learningFocus: readonly LearningFocus[] = [],
): SeasonSimulation {
  const y = yearReviewOf(save).current;
  return {
    baseline: {
      ...y.rated,
      tournaments: y.tournaments + y.esportsTournaments,
      sessions: y.sessions,
    },
    version: 1,
    year: save.world.date.year,
    startDay: gameDay(save),
    targetDay: (save.world.date.year + 1) * 364,
    focus,
    learningFocus: normalizeLearningFocus(learningFocus),
    status: "paused",
    phase: "choose",
    startRating: save.player.rating,
    startMoney: save.player.money,
    days: 0,
    sessions: 0,
    restDays: 0,
    workDays: 0,
    registrations: 0,
    tournaments: 0,
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    lastEventDay: gameDay(save) - 364,
    action: "Planning the season",
    notes: [],
  };
}
export function updateSeason(
  save: GameSave,
  patch: Partial<SeasonSimulation>,
): GameSave {
  const previous = seasonOf(save);
  if (!previous) return save;
  const review = yearReviewOf(save),
    y =
      review.current.year === previous.year
        ? review.current
        : review.reviews.find((r) => r.year === previous.year);
  const counts = y
    ? {
        wins: Math.max(0, y.rated.wins - previous.baseline.wins),
        draws: Math.max(0, y.rated.draws - previous.baseline.draws),
        losses: Math.max(0, y.rated.losses - previous.baseline.losses),
        tournaments: Math.max(
          0,
          y.tournaments + y.esportsTournaments - previous.baseline.tournaments,
        ),
        sessions: Math.max(0, y.sessions - previous.baseline.sessions),
      }
    : null;
  const completed = gameDay(save) >= previous.targetDay;
  const closing = review.reviews.find((r) => r.year === previous.year);
  return {
    ...save,
    seasonSimulation: {
      ...previous,
      ...patch,
      ...counts,
      ...(counts ? { games: counts.wins + counts.draws + counts.losses } : {}),
      ...(completed
        ? {
            status: "completed",
            endRating:
              previous.endRating ?? closing?.endRating ?? save.player.rating,
            endMoney:
              previous.endMoney ?? closing?.endMoney ?? save.player.money,
            action: "Season complete",
          }
        : {}),
    },
  };
}
export function seasonTraining(save: GameSave): GameSave {
  const s = seasonOf(save)!;
  let next = save,
    sessions = 0,
    worked = false;
  // Build a modest reserve using the same jobs/costs as manual play.
  if (next.player.money < 100 && next.training.fatigue < 65) {
    for (const job of [...CAREER_JOBS].sort((a, b) => b.pay - a.pay)) {
      const r = workJob(next, job.id);
      if (r.ok) {
        next = r.save;
        worked = true;
        break;
      }
    }
  }
  const before = yearReviewOf(next).current.sessions;
  const limit = s.focus === "learning" ? 3 : 2;
  // Rest first when exhausted; normal daily nap/break limits still apply.
  if (next.training.fatigue >= 60) {
    const r = takeRest(next, "nap");
    if (r.ok) next = r.save;
  }
  for (let i = 0; i < limit; i++) {
    // Rotate selected topics by the persisted session count, including after resume.
    const priorities = s.focus === "learning" ? normalizeLearningFocus(s.learningFocus) : [];
    const target = LEARNING_FOCUSES.find((f) =>
      f.id === priorities[yearReviewOf(next).current.sessions % priorities.length]);
    const targetStats: readonly string[] = target?.stats ?? [];
    const candidates = AUTO_TRAINING.filter(
      (d) => d.money === 0 && !previewSession(next, d).blocks.length,
    )
      .map((d) => ({
        d,
        score:
          (d.effects.reduce(
            (sum, e) => sum + e.xp * (101 - getStat(next, e.stat)) *
              (targetStats.includes(e.stat) ? 6 : 1),
            0,
          ) /
            Math.max(1, d.hours)) *
          (d.category === "mind" && next.player.morale < 45 ? 1.5 : 1),
      }))
      .sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id));
    const chosen = candidates[0];
    if (!chosen) break;
    const r = performSession(next, chosen.d.id);
    if (!r.ok) break;
    next = r.save;
  }
  sessions = yearReviewOf(next).current.sessions - before;
  next = plannedTrainingDay(next, []).save;
  return updateSeason(next, {
    phase: "end-day",
    sessions: s.sessions + sessions,
    workDays: s.workDays + Number(worked),
    restDays: s.restDays + Number(!sessions && !worked),
    action: worked
      ? "Working, training and resting"
      : sessions
        ? "Training and resting"
        : "Resting and recovering AP",
  });
}
export function chooseSeasonEvent(save: GameSave, npcs: Npc[]) {
  const s = seasonOf(save)!;
  if (
    save.registrations.some((r) => reservedUntil(r) >= gameDay(save)) ||
    save.tournament?.status === "playing"
  )
    return null;
  const spacing =
    s.focus === "competition" ? 14 : s.focus === "learning" ? 42 : 28;
  const candidates = careerSchedule(save, 8).filter(
    (e) =>
      !e.details?.showcase &&
      bookedStart(e) >= gameDay(save) &&
      reservedUntil(e) < s.targetDay &&
      bookedStart(e) >= s.lastEventDay + spacing &&
      e.entryFee + (e.details?.travelCost ?? 0) <=
        Math.max(0, save.player.money - 50) &&
      registrationIssue(save, e, npcs) === null &&
      (e.details?.format !== "team" || buildEventTeams(save, npcs, teamInfoOf(e.details))
        .find((team) => team.country === save.player.country)?.players.some((p) => p.id === "player")),
  );
  return (
    candidates.sort(
      (a, b) =>
        Math.abs(save.player.rating - (a.minElo + 200)) -
        Math.abs(save.player.rating - (b.minElo + 200)) +
        (bookedStart(a) - bookedStart(b)) * 4 +
        (a.entryFee +
          (a.details?.travelCost ?? 0) -
          b.entryFee -
          (b.details?.travelCost ?? 0)) *
          0.5,
    )[0] ?? null
  );
}
export interface SeasonPort {
  read: () => GameSave | null;
  npcs: () => Npc[];
  commit: (save: GameSave) => void;
  play: (
    input: import("./seasonGame").SeasonGameInput,
  ) => Promise<import("./seasonGame").SeasonGameFinish>;
  finish: (finish: MatchFinish) => boolean;
  advanceDay: () => Promise<void>;
  cancelled: () => boolean;
  yield: () => Promise<void>;
}
/** One persisted action at a time: resumes from pairings/day phase, never rerolls a completed game. */
export async function runSeason(port: SeasonPort): Promise<void> {
  const initial = port.read()!,
    id = initial.career.id,
    target = seasonOf(initial)!.targetDay;
  let steps = 0;
  while (!port.cancelled()) {
    const save = port.read();
    if (!save || save.career.id !== id) return;
    const s = seasonOf(save);
    if (!s) return;
    const checkpoint = captureHighlights(save, save, port.npcs());
    if (checkpoint !== save) port.commit(checkpoint);
    if (highlightsOf(checkpoint).unread.length) return;
    if (gameDay(save) >= target) {
      port.commit(
        updateSeason(save, { status: "completed", action: "Season complete" }),
      );
      return;
    }
    // A manually started booking after pausing takes priority over ending the day.
    if (
      s.phase === "end-day" &&
      ((save.tournament?.status === "playing" &&
        tournamentSlot(save.tournament).absoluteDay <= gameDay(save)) ||
        (save.esports?.active?.status === "playing" &&
          esportsRoundDay(save.esports.active) <= gameDay(save)) ||
        registrationStates(save).some((r) => r.status === "ready") ||
        save.esports?.entries.some((r) => r.event.day === gameDay(save)))
    ) {
      port.commit(updateSeason(save, { phase: "choose" }));
      await port.yield();
      continue;
    }
    if (++steps > 15000)
      throw new Error(
        "Season simulation stopped because no progress could be made.",
      );
    if (s.phase === "end-day") {
      await port.advanceDay();
      const next = port.read();
      if (!next || next.career.id !== id) return;
      if (gameDay(next) <= gameDay(save))
        throw new Error("The calendar could not advance.");
      if (
        seasonOf(next)?.phase !== "choose" ||
        seasonOf(next)?.days !== gameDay(next) - s.startDay
      )
        port.commit(
          updateSeason(next, {
            phase: "choose",
            days: gameDay(next) - s.startDay,
          }),
        );
    } else if (save.tournament?.status === "finished") {
      port.commit(
        updateSeason(
          { ...archiveCompetition(save), tournament: null },
          { action: "Archiving tournament results" },
        ),
      );
    } else if (save.esports?.active?.status === "finished") {
      const r = esportsCommand(save, port.npcs(), { type: "close" });
      if (!r.ok) throw new Error(r.error);
      port.commit(r.save);
    } else if (save.tournament?.status === "playing") {
      const t = save.tournament,
        day = tournamentSlot(t).absoluteDay;
      if (day > gameDay(save)) {
        port.commit(
          updateSeason(plannedTrainingDay(save, []).save, {
            phase: "end-day",
            restDays: s.restDays + 1,
            action: "Resting between tournament days",
          }),
        );
      } else if (day < gameDay(save)) {
        throw new Error(
          "An unfinished round needs attention before season simulation can continue.",
        );
      } else {
        const pairing = playerOpponentId(t);
        if (pairing) {
          const npc = port.npcs().find((n) => n.id === pairing.id);
          if (!npc) throw new Error("The tournament opponent is unavailable.");
          const finish = await port.play({
            save,
            npc,
            color: pairing.color,
            tournament: {
              id: t.eventId,
              name: t.name,
              level: t.level,
              round: t.round,
              rounds: t.rounds,
            },
          });
          if (port.read()?.career.id !== id) return;
          if (!port.finish(finish))
            throw new Error("The simulated game could not be recorded.");
          const next = port.read()!;
          const outcome =
            finish.result === "draw"
              ? "draws"
              : finish.result === pairing.color
                ? "wins"
                : "losses";
          port.commit(
            updateSeason(next, {
              games: s.games + 1,
              [outcome]: s[outcome] + 1,
              tournaments:
                s.tournaments + Number(next.tournament?.status === "finished"),
              action: `Playing ${t.name}`,
            }),
          );
        } else {
          const nextT = completeRound(t, null, predictionEnvironment(save));
          let next = recordTournamentPredictions(
            { ...save, tournament: nextT },
            nextT,
          );
          if (nextT.status === "finished")
            next = recordTournament(next, {
              tournamentId: t.eventId,
              name: t.name,
              level: t.level,
              rank: nextT.finalRank ?? t.players.length,
              fieldSize: t.players.length,
              points: nextT.players.find((p) => p.isPlayer)?.points ?? 0,
              prize: nextT.prize,
            });
          port.commit(
            updateSeason(next, {
              tournaments: s.tournaments + Number(nextT.status === "finished"),
              action: "Advancing a pairing bye",
            }),
          );
        }
      }
    } else if (save.esports?.active?.status === "playing") {
      const active = save.esports.active;
      if (esportsRoundDay(active) > gameDay(save))
        port.commit(
          updateSeason(plannedTrainingDay(save, []).save, {
            phase: "end-day",
            restDays: s.restDays + 1,
            action: "Resting between tournament days",
          }),
        );
      else {
        const game = nextEsportsGame(save),
          npc = game && port.npcs().find((n) => n.id === game.opponent.id);
        if (!game || !npc)
          throw new Error(
            "The esports event needs attention before simulation can continue.",
          );
        const finish = await port.play({
          save,
          npc,
          color: game.color,
          tournament: game.tournament,
          esports: game.context,
        });
        if (port.read()?.career.id !== id) return;
        if (!port.finish(finish))
          throw new Error("The simulated game could not be recorded.");
        const next = port.read()!,
          outcome =
            finish.result === "draw"
              ? "draws"
              : finish.result === game.color
                ? "wins"
                : "losses";
        port.commit(
          updateSeason(next, {
            games: s.games + 1,
            [outcome]: s[outcome] + 1,
            tournaments:
              s.tournaments +
              Number(next.esports?.active?.status === "finished"),
            action: `Playing ${active.event.name}`,
          }),
        );
      }
    } else {
      const due = registrationStates(save).find((r) => r.status === "ready");
      const esport = save.esports?.entries.find(
        (r) => r.event.day === gameDay(save),
      );
      if (due) {
        const r = startRegisteredTournament(
          save,
          due.eventId,
          port.npcs(),
          (save.world.seed ^
            (save.world.date.year * 100 + save.world.date.week) ^
            (due.eventId.length * 7919)) >>>
            0,
        );
        if (!r.ok) throw new Error(r.error);
        const next =
          r.save.tournament?.status === "playing"
            ? recordSharedEvent(r.save, r.save.tournament)
            : r.save;
        port.commit(
          updateSeason(next, {
            lastEventDay: gameDay(save),
            tournaments: s.tournaments + Number(due.details?.format === "team"),
            action: `Starting ${due.name}`,
          }),
        );
      } else if (esport) {
        const r = esportsCommand(save, port.npcs(), {
          type: "start",
          eventId: esport.event.id,
        });
        if (!r.ok) throw new Error(r.error);
        const c = r.save.esports?.active;
        const next = c
          ? recordSharedContacts(
              r.save,
              `esports:${c.event.id}`,
              c.teams.flatMap((t) => t.members.map((m) => m.id)),
            )
          : r.save;
        port.commit(
          updateSeason(next, { action: `Starting ${esport.event.name}` }),
        );
      } else {
        const event = chooseSeasonEvent(save, port.npcs());
        if (event) {
          const r = registerForEvent(save, event, port.npcs());
          if (!r.ok) throw new Error(r.error);
          port.commit(
            updateSeason(r.save, {
              registrations: s.registrations + 1,
              lastEventDay: bookedStart(event),
              action: `Registering for ${event.name}`,
            }),
          );
        } else port.commit(seasonTraining(save));
      }
    }
    const current = port.read();
    if (!current || current.career.id !== id) return;
    const checked = captureHighlights(save, current, port.npcs());
    if (checked !== current) port.commit(checked);
    if (highlightsOf(checked).unread.length) return;
    await port.yield();
  }
}
