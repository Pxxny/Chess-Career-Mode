import { stampIndex } from "./catalog";
import { withdraw } from "@/game/match/tournament";
import { recordTournament } from "@/game/history/recordGame";
import { news } from "@/game/career/expansion";
import type { GameSave } from "@/types";
/** A started event cannot be kept alive indefinitely by advancing the career calendar. */
export function expireCompetition(save: GameSave): GameSave {
  const current = save.tournament;
  if (
    current?.status !== "playing" ||
    !current.details ||
    stampIndex(save.world.date) <= stampIndex(current.details.end)
  )
    return save;
  const t = withdraw(current);
  const next = recordTournament(
    { ...save, tournament: t },
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
