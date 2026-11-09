import {
  predictionEnvironment,
  recordTournamentPredictions,
} from "@/game/prediction/adapters";
import { stampIndex } from "./catalog";
import { withdraw, reportPlayerResult } from "@/game/match/tournament";
import { recordTournament } from "@/game/history/recordGame";
import { news } from "@/game/career/expansion";
import type { GameSave } from "@/types";
import { gameDay, eventAgenda, tournamentSlot } from "./agenda";
/** A started event cannot be kept alive indefinitely by advancing the career calendar. */
export function expireCompetition(save: GameSave): GameSave {
  const active = save.tournament;
  if (
    active?.status === "playing" &&
    active.startedOnDay !== undefined &&
    gameDay(save) <=
      active.startedOnDay +
        eventAgenda({
          details: active.details,
          fieldSize: active.players.length,
        }).days -
        1
  ) {
    let next = active,
      count = 0;
    while (
      next.status === "playing" &&
      tournamentSlot(next).absoluteDay < gameDay(save) &&
      count++ < active.rounds + 1
    )
      next = reportPlayerResult(next, "loss", predictionEnvironment(save));
    if (next !== active) {
      let updated: GameSave = recordTournamentPredictions(
        { ...save, tournament: next },
        next,
      );
      if (next.status === "finished")
        updated = recordTournament(updated, {
          tournamentId: next.eventId,
          name: next.name,
          level: next.level,
          rank: next.finalRank ?? next.players.length,
          fieldSize: next.players.length,
          points: next.players.find((p) => p.isPlayer)?.points ?? 0,
          prize: next.prize,
        });
      return news(
        updated,
        `event-missed-${next.eventId}-${gameDay(save)}`,
        `${next.name}: missed match day`,
        "Unplayed games from earlier days were forfeited.",
      );
    }
    return save;
  }
  const current = save.tournament;
  if (
    current?.status !== "playing" ||
    !current.details ||
    (current.startedOnDay !== undefined
      ? gameDay(save) <=
        current.startedOnDay +
          eventAgenda({
            details: current.details,
            fieldSize: current.players.length,
          }).days -
          1
      : stampIndex(save.world.date) <= stampIndex(current.details.end))
  )
    return save;
  const t = withdraw(current, predictionEnvironment(save));
  const next = recordTournament(
    recordTournamentPredictions({ ...save, tournament: t }, t),
    {
      tournamentId: t.eventId,
      name: t.name,
      level: t.level,
      rank: t.finalRank ?? t.players.length,
      fieldSize: t.players.length,
      points: t.players.find((p) => p.isPlayer)?.points ?? 0,
      prize: 0,
    },
  );
  return news(
    next,
    `event-expired-${t.eventId}`,
    `${t.name}: event window ended`,
    "Unplayed rounds were forfeited. No prize or qualification was awarded.",
  );
}
