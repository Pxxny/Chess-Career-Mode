import { reasonableEarlyDraw } from "@/game/competition/preparation";
import { GAME_CONFIG } from "@/data/config";
import {
  applyMove,
  inCheck,
  legalMoves,
  squareName,
  toFen,
  toSan,
  type Move,
  type Position,
} from "@/game/chess/board";
import {
  createGame,
  currentPosition,
  detectEnd,
  makeMove,
  moveToUci,
  parseUci,
  timeoutResult,
  type GameEnd,
  type GameState,
} from "@/game/chess/rules";
import type { EngineAnswer } from "@/game/engine/manager";
import type { SearchRequest } from "@/game/engine/types";
import { winPercent } from "@/game/engine/analysis";
import { lineScore } from "@/game/engine/strength";
import type { OpeningDatabase } from "@/game/openings/database";
import { acceptsDraw } from "@/game/play/opponent";
import { createRng, mixSeed, type Rng } from "@/game/rng";
import type {
  ControlChange,
  MatchAnalysisReport,
  MatchResultKind,
  MatchSetupLite,
  MatchTermination,
  PendingMatch,
  PieceColor,
  ReviewLabel,
} from "@/types";
import { logWarn } from "@/utils/log";
import { MatchClock, type Side } from "./clock";
import {
  bookMoveFor,
  phaseOf,
  pickStyled,
  strengthForMove,
  thinkTimeMs,
  timePressure,
  wouldResign,
  type MoveProfile,
} from "./npcProfile";
import {
  BuiltInReferee,
  createReferee,
  fenCore,
  type Referee,
} from "./referee";
import { analyzeMatch, lineCp, baseLabel, isSacrifice } from "./review";

export type ControllerKind = "human" | "auto";
/** How fast simulated players move: real time, a brisk pace, fast-forward, or as fast as the engine can play. */
export type Speed = "real" | "brisk" | "fast" | "max";
export type MatchStatus = "ready" | "running" | "paused" | "over";

export interface MatchSetup extends MatchSetupLite {
  profiles: Record<PieceColor, MoveProfile>;
  /** "play": the player moves for themselves. "simulate": both sides are played by the simulator until the player takes control. */
  mode: "play" | "simulate";
  speed: Speed;
  seed: number;
}

export interface LiveEval {
  bestUci?: string | null;
  sacrifice?: boolean;
  gap?: number | null;
  /** Centipawns, White's point of view, clamped */
  cp: number;
  /** Mate in N, White's point of view (negative: Black mates). 0 = checkmate on the board. Null when there is none. */
  mate: number | null;
  depth: number;
  bestSan: string | null;
  /** The engine's main line in SAN */
  pv: string[];
  engine: string;
  /** Position the reading belongs to: number of half-moves played */
  ply: number;
}

export interface MatchFinish {
  setup: MatchSetupLite;
  result: MatchResultKind;
  termination: MatchTermination;
  /** SAN moves */
  moves: string[];
  ucis: string[];
  controlLog: ControlChange[];
  /** True when the player's side made at least one move by hand */
  playerMoved: boolean;
}

export type AnalysisProgress =
  | { status: "idle" }
  | { status: "running"; done: number; total: number }
  | { status: "done"; report: MatchAnalysisReport }
  | { status: "error"; message: string };

export interface MatchSnapshot {
  moveJudgment: ReviewLabel | null;
  status: MatchStatus;
  game: GameState;
  position: Position;
  fen: string;
  turn: PieceColor;
  lastMove: { from: number; to: number } | null;
  check: boolean;
  /** Square of the king in check, or -1 */
  checkSquare: number;
  end: GameEnd | null;
  controllers: Record<PieceColor, ControllerKind>;
  speed: Speed;
  /** The side whose simulated player is thinking */
  thinking: PieceColor | null;
  /** The half-move being looked at, or null for the live position */
  viewPly: number | null;
  live: LiveEval | null;
  notice: string | null;
  referee: "chess.js" | "built-in";
  rulesWarnings: number;
  finish: MatchFinish | null;
  analysis: AnalysisProgress;
}

export interface EngineHandle {
  search(request: SearchRequest): Promise<EngineAnswer>;
  stop?(): void;
  ensureLoaded?(): Promise<void>;
}

export interface MatchSessionOptions {
  initialState?: {
    ucis: string[];
    clocks: { white: number; black: number };
    rngState: number;
  };
  setup: MatchSetup;
  engine: EngineHandle;
  db: OpeningDatabase;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Called once when the game ends (not for a voided game) */
  onFinish?: (finish: MatchFinish) => void;
  onAnalysis?: (report: MatchAnalysisReport, finish: MatchFinish) => void;
  /** Called before the first move and after human-game moves; null when it is over. */
  onCheckpoint?: (pending: PendingMatch | null) => void;
  /** Called when a game with fewer than two moves is left: nothing is recorded */
  onVoid?: () => void;
  /** Run the engine analysis when the game ends. Default true. */
  autoAnalyze?: boolean;
  /** Live evaluation while playing. Default true. */
  liveEval?: boolean;
}

const SPEED_SCALE: Record<Speed, number> = {
  real: 1,
  brisk: 1,
  fast: 0.6,
  max: 0.35,
};
const letterOf = (c: PieceColor): Side => (c === "white" ? "w" : "b");
const colorOf = (s: Side): PieceColor => (s === "w" ? "white" : "black");
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Real-time wait and clock rate for a simulated move that takes `thinkMs` of game time. */
export function pacing(
  speed: Speed,
  thinkMs: number,
): { wait: number; rate: number } {
  if (speed === "max") return { wait: 0, rate: 1 };
  const wait =
    speed === "real"
      ? thinkMs
      : speed === "brisk"
        ? Math.min(thinkMs, 2500)
        : Math.min(thinkMs / 8, 1200);
  return { wait, rate: wait > 0 ? Math.max(1, thinkMs / wait) : 1 };
}

/** Combines the end reported by chess.js and by the built-in rules. If they differ, the one that sees an end wins. */
export function mergeEnds(
  primary: GameEnd | null,
  secondary: GameEnd | null,
): { end: GameEnd | null; agree: boolean } {
  if (!primary && !secondary) return { end: null, agree: true };
  if (primary && secondary)
    return {
      end: primary,
      agree:
        primary.result === secondary.result &&
        primary.reason === secondary.reason,
    };
  return { end: primary ?? secondary, agree: false };
}

/**
 * One match from the first move to the analysis. It owns the rules (chess.js through the referee, with the
 * built-in rules beside it), the clocks, the simulated players and the live evaluation, and it does not depend on
 * React: the screen subscribes to snapshots. Either side can be played by the person or by the simulator, and
 * the person can take control at any moment.
 */
export class MatchSession {
  private readonly opts: MatchSessionOptions;
  private readonly setup: MatchSetup;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly rng: Rng;
  private readonly clock: MatchClock;
  private snap: MatchSnapshot;

  private game: GameState;
  private referee: Referee;
  private status: MatchStatus = "ready";
  private end: GameEnd | null = null;
  private controllers: Record<PieceColor, ControllerKind>;
  private speed: Speed;
  private thinking: PieceColor | null = null;
  private viewPly: number | null = null;
  private notice: string | null = null;
  private warnings = 0;
  private finish: MatchFinish | null = null;
  private analysis: AnalysisProgress = { status: "idle" };
  private epoch = 0;
  private evalEpoch = 0;
  private searching = 0;
  private playerMoved = false;
  private detached = false;
  private disposed = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly controlLog: ControlChange[] = [];
  private readonly lastEval: Record<PieceColor, number | null> = {
    white: null,
    black: null,
  };
  private readonly evalCache = new Map<number, LiveEval>();

  constructor(options: MatchSessionOptions) {
    this.opts = options;
    this.setup = options.setup;
    this.now = options.now ?? (() => performance.now());
    this.sleep = options.sleep ?? defaultSleep;
    this.rng = createRng(
      options.initialState?.rngState ?? mixSeed(options.setup.seed, 0x51ed),
    );
    const tc = options.setup.timeControl;
    this.clock = new MatchClock(
      tc.category === "none" ? 0 : tc.base * 1000,
      tc.increment * 1000,
      this.now,
    );
    this.game = createGame();
    for (const uci of options.initialState?.ucis ?? []) {
      const move = parseUci(currentPosition(this.game), uci);
      if (!move) throw new Error("Invalid saved broadcast move");
      this.game = makeMove(this.game, move);
    }
    if (options.initialState) this.clock.restore(options.initialState.clocks);
    this.referee = createReferee(toFen(currentPosition(this.game)));
    this.speed = options.setup.speed;
    const human =
      options.setup.mode === "play" ? options.setup.playerColor : null;
    this.controllers = {
      white: human === "white" ? "human" : "auto",
      black: human === "black" ? "human" : "auto",
    };
    this.snap = this.build();
  }

  broadcastState() {
    const snap = this.getSnapshot();
    const remaining = this.clocks();
    return {
      ucis: [...this.game.ucis],
      clocks: {
        white: Number.isFinite(remaining.white) ? remaining.white : 0,
        black: Number.isFinite(remaining.black) ? remaining.black : 0,
      },
      rngState: this.rng.getState?.() ?? 0,
      ...(snap.finish
        ? { result: snap.finish.result, termination: snap.finish.termination }
        : {}),
    };
  }

  // ---- observation

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): MatchSnapshot => this.snap;

  /** Milliseconds left on each clock right now. Infinity without a clock. */
  clocks(): Record<PieceColor, number> {
    return {
      white: this.clock.remaining("w"),
      black: this.clock.remaining("b"),
    };
  }
  get hasClock(): boolean {
    return this.clock.hasTime;
  }
  get playerColor(): PieceColor {
    return this.setup.playerColor;
  }
  get matchSetup(): MatchSetup {
    return this.setup;
  }
  /** Squares the piece on `from` ("e2") can legally move to, according to the referee. */
  legalTargets(from: string): string[] {
    return this.guard(
      () => this.referee.targets(from),
      () =>
        legalMoves(currentPosition(this.game))
          .filter((m) => squareName(m.from) === from)
          .map((m) => squareName(m.to)),
    );
  }
  isLegal(uci: string): boolean {
    return this.guard(
      () => this.referee.isLegal(uci),
      () => parseUci(currentPosition(this.game), uci) !== null,
    );
  }

  private build(): MatchSnapshot {
    const position = currentPosition(this.game);
    const last = this.game.moves.length
      ? this.game.moves[this.game.moves.length - 1]
      : null;
    const check = this.guard(
      () => this.referee.inCheck(),
      () => inCheck(position),
    );
    const shown = this.viewPly ?? this.game.ucis.length;
    const live =
      this.analysis.status === "done"
        ? this.fromReport(shown)
        : (this.evalCache.get(shown) ?? null);
    return {
      status: this.status,
      moveJudgment: this.judgeShownMove(shown),
      game: this.game,
      position,
      fen: toFen(position),
      turn: position.turn === "w" ? "white" : "black",
      lastMove: last ? { from: last.from, to: last.to } : null,
      check,
      checkSquare: check
        ? position.board.findIndex(
            (p) => p === (position.turn === "w" ? "K" : "k"),
          )
        : -1,
      end: this.end,
      controllers: { ...this.controllers },
      speed: this.speed,
      thinking: this.thinking,
      viewPly: this.viewPly,
      live,
      notice: this.notice,
      referee: this.referee.name,
      rulesWarnings: this.warnings,
      finish: this.finish,
      analysis: this.analysis,
    };
  }

  private fromReport(ply: number): LiveEval | null {
    if (this.analysis.status !== "done") return null;
    const report = this.analysis.report;
    const cp = report.evals[Math.min(ply, report.evals.length - 1)];
    if (cp === undefined) return null;
    const review = ply > 0 ? report.moves[ply - 1] : null;
    const cached = this.evalCache.get(ply);
    return {
      cp,
      mate: review?.mateAfter ?? cached?.mate ?? null,
      depth: report.depth,
      bestSan: cached?.bestSan ?? null,
      pv: cached?.pv ?? [],
      engine: report.engine,
      ply,
    };
  }

  private emit(): void {
    this.snap = this.build();
    this.listeners.forEach((l) => l());
  }

  /** Runs a referee call. If chess.js throws, the built-in rules take over from the current position and the call is repeated. */
  private guard<T>(fn: () => T, fallback: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (this.referee.name === "built-in") return fallback();
      logWarn("match", "chess.js failed; the built-in rules take over", error);
      this.warnings++;
      this.referee = new BuiltInReferee(toFen(currentPosition(this.game)));
      return fallback();
    }
  }

  // ---- lifecycle

  /** Starts the clocks and the simulated players. */
  start(): void {
    if (this.status !== "ready" || this.disposed) return;
    this.status = "running";
    void this.opts.engine.ensureLoaded?.();
    const ended = detectEnd(this.game);
    if (ended) {
      this.finishGame(ended);
      return;
    }
    this.clock.start(letterOf(this.turnColor()), 1);
    this.timer = setInterval(() => this.tick(), 100);
    this.checkpoint();
    this.emit();
    this.schedule();
  }

  /** Checks for a fallen flag. Called by a timer; tests call it directly. */
  tick(): void {
    if (this.status !== "running") return;
    const side = letterOf(
      this.game.positions[this.game.positions.length - 1].turn === "w"
        ? "white"
        : "black",
    );
    if (this.clock.hasTime && this.clock.remaining(side) <= 0) {
      this.clock.flag(side);
      this.finishGame(timeoutResult(this.game, side));
    }
  }

  dispose(): void {
    this.disposed = true;
    this.epoch++;
    this.evalEpoch++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private turnColor(): PieceColor {
    return currentPosition(this.game).turn === "w" ? "white" : "black";
  }

  /** Decides what happens next: a simulated player moves, or the person is asked. */
  private schedule(): void {
    if (this.status !== "running" || this.disposed) return;
    const color = this.turnColor();
    const myEpoch = ++this.epoch;
    if (this.controllers[color] === "human") {
      this.thinking = null;
      this.clock.setRate(1);
      this.emit();
      this.refreshEval();
      return;
    }
    void this.runAuto(color, myEpoch);
  }

  private async runAuto(color: PieceColor, myEpoch: number): Promise<void> {
    const profile = this.setup.profiles[color];
    const tc = this.setup.timeControl;
    const game = this.game;
    const pos = currentPosition(game);
    const ply = game.ucis.length;
    const side = letterOf(color);
    const stale = (): boolean =>
      myEpoch !== this.epoch || this.disposed || this.status !== "running";
    this.thinking = color;
    this.emit();
    const startedAt = this.now();
    try {
      const legal = legalMoves(pos);
      if (legal.length === 0) return;
      // 1. The repertoire: a move from memory is quick.
      let uci: string | null = null;
      let fromBook = false;
      const bookSan = bookMoveFor(profile, color, game.sans, this.rng);
      if (bookSan) {
        const clean = (s: string): string => s.replace(/[+#!?]/g, "");
        const found = legal.find(
          (m) => clean(toSan(pos, m, legal)) === clean(bookSan),
        );
        if (found) {
          uci = moveToUci(found);
          fromBook = true;
        }
      }
      // 2. How long it takes, and how fast that is played back.
      const remaining = this.clock.remaining(side);
      const phase = phaseOf(pos, ply);
      const pressure = timePressure(remaining, tc);
      const complexity = legal.length > 36 ? 1.25 : legal.length < 12 ? 0.7 : 1;
      const spent = thinkTimeMs(profile, this.rng, {
        remainingMs: remaining,
        incrementMs: tc.increment * 1000,
        ply,
        fromBook,
        tc,
        complexity,
      });
      const { wait, rate } = pacing(this.speed, spent);
      if (this.clock.hasTime) this.clock.setRate(rate);

      // 3. Otherwise the engine, weakened to this player's strength in this phase and clock situation.
      let evalCp: number | null = null;
      if (!uci) {
        const strength = strengthForMove(
          profile,
          phase,
          pressure,
          SPEED_SCALE[this.speed],
        );
        this.searching++;
        let answer: EngineAnswer;
        try {
          answer = await this.opts.engine.search({
            fen: game.startFen,
            moves: game.ucis,
            movetime: strength.movetime,
            multiPv: strength.multiPv,
            limitElo: strength.limitElo,
          });
        } finally {
          this.searching--;
        }
        if (stale()) return;
        const lines = answer.lines.length
          ? answer.lines
          : [
              {
                uci: answer.best,
                cp: 0,
                mate: null,
                pv: [answer.best],
                depth: answer.depth,
              },
            ];
        const picked = pickStyled(
          lines,
          pos,
          profile,
          strength.temperature,
          this.rng,
        );
        uci = parseUci(pos, picked.uci, legal)
          ? picked.uci
          : (lines.find((l) => parseUci(pos, l.uci, legal))?.uci ??
            moveToUci(legal[0]));
        evalCp = Math.max(-10000, Math.min(10000, lineScore(lines[0])));
      }
      if (stale()) return;

      const playerProfile = this.setup.profiles[this.setup.playerColor];
      const opponentProfile =
        this.setup.profiles[
          this.setup.playerColor === "white" ? "black" : "white"
        ];
      if (
        evalCp !== null &&
        this.controllers[this.setup.playerColor] === "auto" &&
        reasonableEarlyDraw({
          enabled: playerProfile.earlyDraw ?? false,
          ply,
          evalCp,
          opponentStubborn: opponentProfile.stubborn,
          tournamentContext: !!this.setup.tournament,
          drawUseful: playerProfile.drawUseful ?? false,
        })
      ) {
        this.finishGame({ result: "draw", reason: "agreement" });
        return;
      }

      // 4. A hopeless position may be resigned (never for the player's own side).
      if (evalCp !== null) {
        const resign = wouldResign(profile, this.rng, {
          evalCp,
          previousEvalCp: this.lastEval[color],
          ply,
        });
        this.lastEval[color] = evalCp;
        if (resign) {
          this.finishGame({
            result: color === "white" ? "black" : "white",
            reason: "resignation",
          });
          return;
        }
      }

      const left = wait - (this.now() - startedAt);
      if (left > 0) await this.sleep(left);
      else if (wait === 0) await this.sleep(0);
      if (stale()) return;
      this.thinking = null;
      this.commit(uci, spent);
    } catch (error) {
      if (stale()) return;
      logWarn(
        "match",
        "A simulated move failed; a fallback move was played",
        error,
      );
      this.thinking = null;
      const any = legalMoves(pos)[0];
      if (any) {
        this.notice = "The engine had a problem. A fallback move was played.";
        this.commit(moveToUci(any), undefined);
      }
    }
  }

  /** Plays a move for the side to move. Both the referee and the built-in rules must accept it. */
  private commit(uci: string, spentMs: number | undefined): boolean {
    if (this.status !== "running" || this.disposed) return false;
    const pos = currentPosition(this.game);
    const move: Move | null = parseUci(pos, uci);
    const refereeOk = this.guard(
      () => this.referee.isLegal(uci),
      () => move !== null,
    );
    if (!move || !refereeOk) {
      if (move !== null || refereeOk)
        logWarn(
          "match",
          "The referee and the built-in rules disagree about a move",
          { uci, fen: toFen(pos), referee: refereeOk, builtIn: move !== null },
        );
      return false;
    }
    const mover = this.turnColor();
    if (this.clock.hasTime && !this.clock.press(letterOf(mover), spentMs)) {
      this.finishGame(timeoutResult(this.game, letterOf(mover)));
      return false;
    }
    if (!this.clock.hasTime) this.clock.press(letterOf(mover), spentMs);
    const played = this.guard(
      () => this.referee.play(uci),
      () => "ok",
    );
    if (played === null) return false;
    this.game = makeMove(this.game, move);
    this.viewPly = null;
    this.notice = null;
    // The two rule sets must stay in step. If they ever drift apart, chess.js is restarted from the built-in position.
    const here = toFen(currentPosition(this.game));
    const same = this.guard(
      () => fenCore(this.referee.fen()) === fenCore(here),
      () => true,
    );
    if (!same) {
      logWarn(
        "match",
        "The referee and the built-in rules reached different positions",
        { fen: here, referee: this.referee.fen() },
      );
      this.warnings++;
      this.guard(
        () => this.referee.load(here),
        () => undefined,
      );
    }
    const merged = mergeEnds(
      this.guard(
        () => this.referee.end(),
        () => null,
      ),
      detectEnd(this.game),
    );
    if (!merged.agree) {
      logWarn(
        "match",
        "The referee and the built-in rules disagree about the end of the game",
        { fen: here },
      );
      this.warnings++;
    }
    this.checkpoint();
    if (merged.end) {
      this.finishGame(merged.end);
      return true;
    }
    this.emit();
    this.schedule();
    return true;
  }

  private checkpoint(): void {
    if (!this.opts.onCheckpoint || this.detached) return;
    const anyHuman =
      this.controllers.white === "human" || this.controllers.black === "human";
    if (!anyHuman && !this.playerMoved && this.game.ucis.length > 0) return;
    this.opts.onCheckpoint({
      setup: this.liteSetup(),
      ucis: [...this.game.ucis],
      playerMoved: this.playerMoved,
    });
  }

  private liteSetup(): MatchSetupLite {
    const {
      white,
      black,
      playerColor,
      timeControl,
      rated,
      tournament,
      accuracyBonus,
      prediction,
      esports,
      social,
    } = this.setup;
    return {
      white,
      black,
      playerColor,
      timeControl,
      rated,
      tournament,
      accuracyBonus,
      ...(prediction ? { prediction } : {}),
      ...(esports ? { esports } : {}),
      ...(social ? { social } : {}),
    };
  }

  // ---- the person

  /** A move by hand (UCI, "e2e4" or "e7e8q"). Accepted only on a human-controlled side's turn. */
  humanMove(uci: string): boolean {
    if (this.status !== "running") return false;
    const color = this.turnColor();
    if (this.controllers[color] !== "human") return false;
    if (this.viewPly !== null && this.viewPly !== this.game.ucis.length)
      return false;
    if (color === this.setup.playerColor) this.playerMoved = true;
    const ok = this.commit(uci, undefined);
    if (!ok && color === this.setup.playerColor && this.game.ucis.length === 0)
      this.playerMoved = false;
    return ok;
  }

  /** The person takes over a side (or hands it back to the simulator) at any moment. */
  setController(color: PieceColor, kind: ControllerKind): void {
    if (this.status === "over" || this.controllers[color] === kind) return;
    // In a rated game only the player's own side can be taken over. The opponent always plays for itself.
    if (this.setup.rated && color !== this.setup.playerColor) return;
    this.controllers[color] = kind;
    this.controlLog.push({ ply: this.game.ucis.length, color, to: kind });
    if (this.status === "paused" && kind === "human") this.resume();
    else if (this.status === "running" && this.turnColor() === color)
      this.schedule();
    else this.emit();
  }

  setSpeed(speed: Speed): void {
    if (this.speed === speed) return;
    this.speed = speed;
    // A move being thought about is replayed at the new pace.
    if (
      this.status === "running" &&
      this.controllers[this.turnColor()] === "auto" &&
      !this.searching
    )
      this.schedule();
    else this.emit();
  }

  /** Pauses a game in which nobody moves by hand. */
  pause(): void {
    if (this.status !== "running") return;
    if (
      this.controllers.white === "human" ||
      this.controllers.black === "human"
    )
      return;
    this.status = "paused";
    this.epoch++;
    this.thinking = null;
    this.clock.pause();
    this.emit();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "running";
    this.clock.resume();
    this.emit();
    this.schedule();
  }

  resign(color: PieceColor = this.setup.playerColor): void {
    if (this.status === "over") return;
    // In a rated game only the player can resign, and only for their own side.
    if (this.setup.rated && color !== this.setup.playerColor) return;
    this.finishGame({
      result: color === "white" ? "black" : "white",
      reason: "resignation",
    });
  }

  /** Offers a draw to the simulated opponent. Resolves with its answer. */
  async offerDraw(): Promise<string> {
    if (this.status !== "running") return "The game is not running.";
    const color = this.turnColor();
    if (this.controllers[color] !== "human")
      return "Wait for your turn to offer a draw.";
    const opponent: PieceColor = color === "white" ? "black" : "white";
    if (this.controllers[opponent] === "human")
      return "The other side is controlled by you.";
    if (this.game.ucis.length < 2) return "It is too early to offer a draw.";
    const game = this.game;
    try {
      const answer = await this.opts.engine.search({
        fen: game.startFen,
        moves: game.ucis,
        movetime: 300,
        depth: 12,
      });
      if (this.game !== game || this.status !== "running")
        return "The position changed.";
      const forMover = lineCp(answer.lines[0]);
      if (
        !this.setup.profiles[opponent].stubborn &&
        acceptsDraw(this.rng, -forMover, game.ucis.length)
      ) {
        this.finishGame({ result: "draw", reason: "agreement" });
        return `${this.setup.profiles[opponent].name} accepted the draw.`;
      }
      return `${this.setup.profiles[opponent].name} declined the draw.`;
    } catch {
      return "The draw offer was declined.";
    }
  }

  /**
   * Leaving the screen. A game that the person plays by hand and that has two or more moves is lost by
   * abandonment; a shorter one is cancelled. A pure simulation carries on to its end in the background.
   */
  leave(): void {
    if (this.status === "over") return;
    const hands =
      this.controllers.white === "human" || this.controllers.black === "human";
    if (hands) {
      if (this.game.ucis.length >= 2 && this.status !== "ready") {
        const loser = this.setup.playerColor;
        this.finishGame({
          result: loser === "white" ? "black" : "white",
          reason: "abandoned",
        });
      } else {
        this.void();
      }
      return;
    }
    if (this.status === "ready" || this.game.ucis.length === 0) {
      this.void();
      return;
    }
    // Pure simulation: finish it in the background.
    this.detached = true;
    this.speed = "max";
    if (this.status === "paused") this.resume();
    else if (this.status === "running") this.schedule();
  }

  private void(): void {
    this.status = "over";
    this.epoch++;
    this.evalEpoch++;
    this.clock.stop();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.opts.onCheckpoint?.(null);
    this.opts.onVoid?.();
    this.emit();
  }

  /** Looks at an earlier position (a half-move number) or returns to the live one (null). The game itself is untouched. */
  view(ply: number | null): void {
    const live = this.game.ucis.length;
    this.viewPly = ply === null || ply >= live ? null : Math.max(0, ply);
    this.emit();
    this.refreshEval();
  }

  dismissNotice(): void {
    this.notice = null;
    this.emit();
  }

  // ---- the end

  private finishGame(end: GameEnd): void {
    if (this.status === "over") return;
    this.status = "over";
    this.epoch++;
    this.evalEpoch++;
    this.thinking = null;
    this.clock.stop();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.end = end;
    const finish: MatchFinish = {
      setup: this.liteSetup(),
      result: end.result,
      termination: end.reason as MatchTermination,
      moves: [...this.game.sans],
      ucis: [...this.game.ucis],
      controlLog: [...this.controlLog],
      playerMoved: this.playerMoved,
    };
    this.finish = finish;
    this.opts.onCheckpoint?.(null);
    this.emit();
    if (this.game.ucis.length === 0) {
      this.opts.onVoid?.();
      return;
    }
    this.opts.onFinish?.(finish);
    if (this.opts.autoAnalyze !== false && this.game.ucis.length >= 2)
      void this.runAnalysis(finish);
  }

  private async runAnalysis(finish: MatchFinish): Promise<void> {
    const game = this.game;
    const total = game.ucis.length + 1;
    this.analysis = { status: "running", done: 0, total };
    this.emit();
    try {
      const report = await analyzeMatch(
        this.opts.engine,
        {
          game,
          depth: GAME_CONFIG.match.analysisDepth,
          bookPlies: this.opts.db.classify(game.sans)?.bookPlies ?? 0,
          onProgress: (done, t) => {
            this.analysis = { status: "running", done, total: t };
            this.emit();
          },
        },
        this.opts.db,
      );
      this.analysis = { status: "done", report };
      this.opts.onAnalysis?.(report, finish);
    } catch (error) {
      this.analysis = {
        status: "error",
        message:
          error instanceof Error ? error.message : "The analysis failed.",
      };
    }
    this.emit();
  }

  /** Runs the analysis again after an error. */
  retryAnalysis(): void {
    if (
      this.status === "over" &&
      this.finish &&
      this.analysis.status !== "running" &&
      this.game.ucis.length >= 2
    )
      void this.runAnalysis(this.finish);
  }

  // ---- live evaluation

  /**
   * Evaluates the position being looked at (the live one, or an earlier one) with Stockfish and keeps the
   * reading. Waits while a simulated player is searching so that the game is never slowed down by it.
   */
  private refreshEval(): void {
    if (this.opts.liveEval === false || this.disposed) return;
    if (this.speed === "max" && this.status === "running") return;
    const ply = this.viewPly ?? this.game.ucis.length;
    if (this.evalCache.has(ply) && this.evalCache.get(ply)!.pv.length) return;
    const my = ++this.evalEpoch;
    void (async () => {
      let waited = 0;
      while (this.searching > 0 && waited < 4000) {
        await this.sleep(120);
        waited += 120;
        if (my !== this.evalEpoch || this.disposed) return;
      }
      const upTo = this.game.ucis.slice(0, ply);
      const pos = this.game.positions[ply];
      if (!pos) return;
      const sign = pos.turn === "w" ? 1 : -1;
      const terminal = legalMoves(pos).length === 0;
      if (terminal) {
        const mated = inCheck(pos);
        this.evalCache.set(ply, {
          cp: mated ? (pos.turn === "w" ? -1500 : 1500) : 0,
          mate: mated ? 0 : null,
          depth: 0,
          bestSan: null,
          pv: [],
          engine: "Rules",
          ply,
        });
        if (my === this.evalEpoch) this.emit();
        return;
      }
      try {
        const answer = await this.opts.engine.search({
          fen: this.game.startFen,
          moves: upTo,
          depth: GAME_CONFIG.match.liveDepth,
          movetime: GAME_CONFIG.match.liveMs,
          multiPv: 2,
        });
        if (my !== this.evalEpoch || this.disposed) return;
        const top = answer.lines[0];
        const pv: string[] = [];
        let walk = pos;
        for (const u of top.pv.slice(0, 8)) {
          const m = parseUci(walk, u);
          if (!m) break;
          pv.push(toSan(walk, m));
          walk = applyMove(walk, m);
        }
        const mate = top.mate !== null ? top.mate * sign : null;
        this.evalCache.set(ply, {
          bestUci: answer.best,
          sacrifice: isSacrifice(pos, top.pv, pos.turn === "w"),
          gap: answer.lines[1]
            ? Math.max(
                0,
                winPercent(lineCp(top)) - winPercent(lineCp(answer.lines[1])),
              )
            : null,
          cp: lineCp(top) * sign,
          mate,
          depth: answer.depth || top.depth,
          bestSan: pv[0] ?? null,
          pv,
          engine: answer.engineName,
          ply,
        });
        this.emit();
      } catch {
        // The live reading is optional.
      }
    })();
  }

  /** Provisional live labels need evaluations of both positions; review later replaces them. */
  private judgeShownMove(ply: number): ReviewLabel | null {
    if (ply < 1) return null;
    if (this.analysis.status === "done")
      return this.analysis.report.moves[ply - 1]?.label ?? null;
    const before = this.evalCache.get(ply - 1),
      after = this.evalCache.get(ply);
    if (!before || !after) return null;
    const position = this.game.positions[ply - 1],
      sign = position.turn === "w" ? 1 : -1;
    const priorWin = winPercent(before.cp * sign),
      afterWin = winPercent(after.cp * sign);
    const best = before.bestUci === this.game.ucis[ply - 1];
    const label = baseLabel(Math.max(0, priorWin - afterWin), best);
    if (
      (label === "best" || label === "excellent") &&
      best &&
      before.sacrifice &&
      (before.gap ?? 0) >= 5 &&
      legalMoves(position).length > 1 &&
      priorWin < 92 &&
      afterWin >= 45
    )
      return "brilliant";
    return label;
  }

  /** Win percentage for White at a half-move, from the live reading or the analysis. Null when unknown. */
  whiteWin(ply: number): number | null {
    const e =
      this.evalCache.get(ply) ??
      (this.analysis.status === "done" ? this.fromReport(ply) : null);
    return e ? winPercent(e.cp) : null;
  }
}
