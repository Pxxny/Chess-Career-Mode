import type {
  ActiveTournament,
  GameOutcome,
  GameSave,
  MatchRecord,
  PieceColor,
} from "@/types";
export interface TournamentGameRow {
  round: number;
  opponentId: string;
  opponent: string;
  elo: number | null;
  color: PieceColor | null;
  outcome: GameOutcome | null;
  bye: boolean;
  match: MatchRecord | null;
  prediction?: Pick<
    import("@/game/prediction/types").PredictionSnapshot,
    "adjusted"
  >;
}
export function tournamentGames(
  t: ActiveTournament,
  playerId: string,
  matches: readonly MatchRecord[] = [],
): TournamentGameRow[] {
  const names = new Map(t.players.map((p) => [p.id, p]));
  return t.pairings.flatMap((round, i) => {
    const p = round.find((p) => p.white === playerId || p.black === playerId);
    if (!p) return [];
    const white = p.white === playerId,
      opponentId = white ? p.black : p.white,
      bye = p.black === "bye",
      score = p.result === null ? null : white ? p.result : 1 - p.result;
    const match =
      matches.find(
        (m) =>
          m.setup.tournament?.id === t.eventId &&
          m.setup.tournament.round === i + 1 &&
          [
            m.setup.white.isPlayer ? "player" : m.setup.white.id,
            m.setup.black.isPlayer ? "player" : m.setup.black.id,
          ].includes(p.white) &&
          [
            m.setup.white.isPlayer ? "player" : m.setup.white.id,
            m.setup.black.isPlayer ? "player" : m.setup.black.id,
          ].includes(p.black),
      ) ?? null;
    const forecast = match?.setup.prediction ?? p.prediction ?? p.forecast;
    const ownPerspective = match?.setup.prediction
      ? playerId === "player"
      : white;
    const adjusted = forecast?.adjusted;
    return [
      {
        round: i + 1,
        opponentId,
        opponent: bye
          ? "Pairing bye"
          : (names.get(opponentId)?.name ?? "Unknown opponent"),
        elo: names.get(opponentId)?.elo ?? null,
        color: bye ? null : white ? "white" : "black",
        outcome:
          score === null
            ? null
            : score === 1
              ? "win"
              : score === 0
                ? "loss"
                : "draw",
        bye,
        match,
        prediction: adjusted
          ? {
              adjusted: ownPerspective
                ? adjusted
                : {
                    win: adjusted.loss,
                    draw: adjusted.draw,
                    loss: adjusted.win,
                    expected: 1 - adjusted.expected,
                  },
            }
          : undefined,
      },
    ];
  });
}
export function openingGames(save: GameSave, name: string) {
  return [...save.history.games]
    .filter((g) => g.opening === name)
    .reverse()
    .map((game) => ({
      game,
      match: save.matches.find((m) => m.gameResultId === game.id) ?? null,
    }));
}
