import {
  legalMoves,
  applyMove,
  inCheck,
  type Position,
} from "@/game/chess/board";
import {
  createGame,
  currentPosition,
  makeMove,
  parseUci,
  moveToUci,
} from "@/game/chess/rules";
import { evaluate } from "@/game/engine/builtin";
import type { SearchRequest, SearchLine } from "@/game/engine/types";
import type { EngineAnswer } from "@/game/engine/manager";
import { MatchSession, type MatchFinish } from "@/game/match/session";
import { buildMatchSetup } from "@/game/match/setup";
import { getBaseOpeningDatabase } from "@/game/openings/database";
import type {
  GameSave,
  Npc,
  MatchSetupLite,
  PieceColor,
  RecordedSeasonGame,
} from "@/types";
import { DEFAULT_TIME_CONTROL } from "@/game/match/timeControls";
import { mixSeed } from "@/game/rng";
import { hashString } from "@/utils/format";
export interface SeasonGameInput {
  save: GameSave;
  npc: Npc;
  color: PieceColor;
  tournament: NonNullable<MatchSetupLite["tournament"]>;
  esports?: MatchSetupLite["esports"];
}
export type SeasonGameFinish = MatchFinish & { recording: RecordedSeasonGame };
/** Fixed two-ply search for season self-play. Ordinary Stockfish/search settings are untouched. */
class SeasonEngine {
  private game = createGame();
  private prefix: string[] = [];
  private fen = "";
  searchMs = 0;
  searches = 0;
  async search(r: SearchRequest): Promise<EngineAnswer> {
    const at = performance.now();
    if (
      this.fen !== r.fen ||
      this.prefix.length > r.moves.length ||
      this.prefix.some((u, i) => u !== r.moves[i])
    ) {
      this.game = createGame(r.fen);
      this.prefix = [];
      this.fen = r.fen;
    }
    for (const u of r.moves.slice(this.prefix.length)) {
      const m = parseUci(currentPosition(this.game), u);
      if (!m) throw new Error("Illegal recorded move");
      this.game = makeMove(this.game, m);
    }
    this.prefix = [...r.moves];
    const pos = currentPosition(this.game);
    const lines: SearchLine[] = legalMoves(pos)
      .map((m) => {
        const child = applyMove(pos, m),
          reply = legalMoves(child);
        let cp: number;
        if (!reply.length) cp = inCheck(child) ? 10000 : 0;
        else {
          cp = Infinity;
          for (const next of reply)
            cp = Math.min(cp, evaluate(applyMove(child, next)));
        }
        const uci = moveToUci(m);
        return { uci, cp, mate: cp === 10000 ? 1 : null, pv: [uci], depth: 2 };
      })
      .sort((a, b) => (b.cp ?? 0) - (a.cp ?? 0) || a.uci.localeCompare(b.uci));
    this.searchMs += performance.now() - at;
    this.searches++;
    if (!lines.length) throw new Error("No legal moves");
    return {
      best: lines[0].uci,
      lines: lines.slice(0, Math.max(5, r.multiPv ?? 5)),
      depth: 2,
      engine: "builtin",
      engineName: "Season engine (two-ply)",
    };
  }
}
export async function playSeasonGame(
  input: SeasonGameInput,
  onProgress?: (ply: number) => void,
): Promise<SeasonGameFinish> {
  const at = performance.now(),
    engine = new SeasonEngine(),
    db = getBaseOpeningDatabase();
  const seed = mixSeed(
    input.save.world.seed,
    hashString(
      `season:${input.save.career.id}:${input.tournament.id}:${input.tournament.round}:${input.npc.id}`,
    ),
  );
  const tc = input.esports
    ? input.save.esports!.active!.event.timeControl
    : (input.save.tournament?.details?.timeControl ?? DEFAULT_TIME_CONTROL);
  if (!tc) throw new Error("Tournament time control is missing.");
  const setup = buildMatchSetup({
    ...input,
    playerColor: input.color,
    timeControl: tc,
    rated: true,
    mode: "simulate",
    speed: "max",
    seed,
    db,
  });
  if (input.esports) setup.esports = input.esports;
  return new Promise((resolve, reject) => {
    const clocks: RecordedSeasonGame["clocks"] = [];
    const session = new MatchSession({
      setup,
      engine,
      db,
      autoAnalyze: false,
      liveEval: false,
      now: () => 0,
      sleep: () => Promise.resolve(),
      onFinish: (finish) => {
        const c = session.clocks(),
          normal = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : null);
        if (!clocks[finish.ucis.length])
          clocks[finish.ucis.length] = {
            white: normal(c.white),
            black: normal(c.black),
          };
        const elapsed =
          tc.base > 0
            ? Math.max(
                0,
                tc.base * 2000 +
                  tc.increment * 1000 * finish.ucis.length -
                  (c.white + c.black),
              )
            : null;
        session.dispose();
        resolve({
          ...finish,
          setup: { ...finish.setup, simulation: "season" },
          recording: {
            version: 1,
            finalClocks: { white: normal(c.white), black: normal(c.black) },
            rulesWarnings: session.getSnapshot().rulesWarnings,
            engine: "Season engine (two-ply)",
            clocks,
            ucis: finish.ucis,
            finalFen: session.getSnapshot().fen,
            wallMs: performance.now() - at,
            searchMs: engine.searchMs,
            searches: engine.searches,
            gameTimeMs: elapsed,
          },
        });
      },
      onVoid: () => {
        session.dispose();
        reject(new Error("The season game could not be completed."));
      },
    });
    session.subscribe(() => {
      const snap = session.getSnapshot(),
        c = session.clocks(),
        ply = snap.game.ucis.length;
      if (!clocks[ply])
        clocks[ply] = {
          white: Number.isFinite(c.white) ? Math.max(0, c.white) : null,
          black: Number.isFinite(c.black) ? Math.max(0, c.black) : null,
        };
      if (ply % 32 === 0) onProgress?.(ply);
      if (ply > 5000) {
        session.dispose();
        reject(
          new Error(
            "The season game exceeded the move limit. No result was recorded.",
          ),
        );
      }
    });
    session.start();
  });
}
