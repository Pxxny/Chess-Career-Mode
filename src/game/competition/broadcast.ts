import type { BroadcastGame, GameSave } from "@/types";
import {
  createGame,
  currentPosition,
  parseUci,
  makeMove,
  detectEnd,
} from "@/game/chess/rules";
import { tournamentReady } from "./agenda";
export interface BroadcastContext {
  careerId: string;
  eventId: string;
  round: number;
  board: number;
  white: string;
  black: string;
}
/** Only NPC boards of the current playable round can write. Viewing never spends resources or advances the calendar. */
export function updateBroadcast(
  save: GameSave,
  ctx: BroadcastContext,
  state: BroadcastGame,
): GameSave {
  const t = save.tournament;
  if (
    save.career.id !== ctx.careerId ||
    !t ||
    t.eventId !== ctx.eventId ||
    t.status !== "playing" ||
    t.round !== ctx.round ||
    !tournamentReady(save)
  )
    return save;
  const board = t.pairings[ctx.round - 1]?.[ctx.board];
  if (
    !board ||
    board.result !== null ||
    board.white !== ctx.white ||
    board.black !== ctx.black ||
    board.white === "player" ||
    board.black === "player" ||
    board.black === "bye"
  )
    return save;
  if (
    state.ucis.length > 2000 ||
    Object.values(state.clocks).some((n) => !Number.isFinite(n) || n < 0) ||
    !Number.isInteger(state.rngState)
  )
    return save;
  const old = board.broadcast?.ucis ?? [];
  if (old.length > state.ucis.length || old.some((u, i) => u !== state.ucis[i]))
    return save;
  let game = createGame();
  for (const u of state.ucis) {
    const m = parseUci(currentPosition(game), u);
    if (!m) return save;
    game = makeMove(game, m);
  }
  const end = detectEnd(game);
  if (
    state.result &&
    ((end && end.result !== state.result) ||
      !state.termination ||
      !state.ucis.length)
  )
    return save;
  if (state.termination === "checkmate" && end?.reason !== "checkmate")
    return save;
  const pairings = t.pairings.map((r, i) =>
    i === ctx.round - 1
      ? r.map((p, j) =>
          j === ctx.board
            ? {
                ...p,
                broadcast: structuredClone(state),
                result: state.result
                  ? state.result === "white"
                    ? 1
                    : state.result === "black"
                      ? 0
                      : 0.5
                  : null,
              }
            : p,
        )
      : r,
  );
  return { ...save, tournament: { ...t, pairings } };
}
