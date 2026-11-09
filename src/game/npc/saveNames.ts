import type { ActiveTournament, GameSave, MatchSetupLite, Npc } from "@/types";
import { NPC_NAME_VERSION } from "./identity";
/** Correct embedded NPC display names by stable ID, without rewriting free-text news or game results. */
export function syncNpcSaveNames(save: GameSave, npcs: Npc[]): GameSave {
  if (save.npcNameVersion === NPC_NAME_VERSION) return save;
  const names = new Map(npcs.map((n) => [n.id, n.name]));
  const setup = (s: MatchSetupLite): MatchSetupLite => ({
    ...s,
    white:
      s.white.id && !s.white.isPlayer && names.has(s.white.id)
        ? { ...s.white, name: names.get(s.white.id)! }
        : s.white,
    black:
      s.black.id && !s.black.isPlayer && names.has(s.black.id)
        ? { ...s.black, name: names.get(s.black.id)! }
        : s.black,
  });
  const tournament = (t: ActiveTournament): ActiveTournament => ({
    ...t,
    players: t.players.map((p) =>
      !p.isPlayer && names.has(p.id) ? { ...p, name: names.get(p.id)! } : p,
    ),
  });
  const opponent = <
    T extends { opponentId: string | null; opponentName: string },
  >(
    g: T,
  ): T =>
    g.opponentId && names.has(g.opponentId)
      ? { ...g, opponentName: names.get(g.opponentId)! }
      : g;
  const pending = save.practice.pendingGame;
  return {
    ...save,
    npcNameVersion: NPC_NAME_VERSION,
    history: { ...save.history, games: save.history.games.map(opponent) },
    practice: {
      ...save.practice,
      games: save.practice.games.map(opponent),
      ...(pending?.opponent.id && names.has(pending.opponent.id)
        ? {
            pendingGame: {
              ...pending,
              opponent: {
                ...pending.opponent,
                name: names.get(pending.opponent.id)!,
              },
            },
          }
        : {}),
    },
    matches: save.matches.map((m) => ({ ...m, setup: setup(m.setup) })),
    pendingMatch: save.pendingMatch
      ? { ...save.pendingMatch, setup: setup(save.pendingMatch.setup) }
      : null,
    tournament: save.tournament ? tournament(save.tournament) : null,
    ...(save.competition
      ? {
          competition: {
            ...save.competition,
            archive: save.competition.archive.map(tournament),
          },
        }
      : {}),
  };
}
