import type { OpeningDatabase } from "@/game/openings/database";
import type { GameOutcome, GameSave, Npc, PieceColor } from "@/types";
import { MatchSession, type EngineHandle, type MatchFinish } from "./session";
import { buildMatchSetup } from "./setup";
import type { MatchTimeControl } from "@/types";

export interface SimulatedPlay {
  /** SAN moves of the whole game */
  moves: string[];
  ucis: string[];
  /** From the player's point of view */
  outcome: GameOutcome;
  termination: MatchFinish["termination"];
}

export interface SimulateInput {
  signal?: AbortSignal;
  save: GameSave;
  npc: Npc;
  /** Plays the opponent at another rating than its own */
  eloOverride?: number | null;
  color: PieceColor;
  timeControl: MatchTimeControl;
  seed: number;
  db: OpeningDatabase;
  engine: EngineHandle;
  /** Give up after this long and resolve with null (default 4 minutes) */
  timeoutMs?: number;
}

/**
 * Plays a complete game between the simulated player and the opponent, as fast as the engine allows, and returns
 * its moves and result. The same session, strength model and rules as the match viewer, without a screen.
 * Resolves with null if the game could not be finished in time.
 */
export function playSimulatedGame(
  input: SimulateInput,
): Promise<SimulatedPlay | null> {
  if (input.signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const setup = buildMatchSetup({
      save: input.save,
      npc: input.npc,
      eloOverride: input.eloOverride ?? null,
      playerColor: input.color,
      timeControl: input.timeControl,
      rated: false,
      mode: "simulate",
      speed: "max",
      tournament: null,
      seed: input.seed,
      db: input.db,
    });
    let done = false;
    const finishWith = (value: SimulatedPlay | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      session.dispose();
      resolve(value);
    };
    const session = new MatchSession({
      setup,
      engine: input.engine,
      db: input.db,
      autoAnalyze: false,
      liveEval: false,
      onFinish: (f) => {
        const outcome: GameOutcome =
          f.result === "draw"
            ? "draw"
            : f.result === input.color
              ? "win"
              : "loss";
        finishWith({
          moves: f.moves,
          ucis: f.ucis,
          outcome,
          termination: f.termination,
        });
      },
      onVoid: () => finishWith(null),
    });
    const abort = () => finishWith(null);
    const timer = setTimeout(() => {
      session.leave();
      finishWith(null);
    }, input.timeoutMs ?? 240000);
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) abort();
    else session.start();
  });
}
