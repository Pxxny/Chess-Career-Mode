import { careerPrediction } from "@/game/prediction/adapters";
import type { PredictionSnapshot } from "@/game/prediction/types";
import { isSacrifice } from "@/game/chess/material";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { GAME_CONFIG } from "@/data/config";
import {
  legalMoves,
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
import { chooseEngineMove } from "@/game/engine/play";
import {
  analyzeGame,
  winPercent,
  type GameAnalysis,
} from "@/game/engine/analysis";
import { engineManager } from "@/game/engine/manager";
import { strengthFor, type Strength } from "@/game/engine/strength";
import {
  acceptsDraw,
  npcThinkMs,
  opponentBookMove,
  type Opponent,
} from "@/game/play/opponent";
import type { RecordResult } from "@/game/play/practice";
import type { TimeControl } from "@/game/play/timeControls";
import { createRng, mixSeed } from "@/game/rng";
import { useOpeningStore } from "@/store/openingStore";
import { useGameStore } from "@/store/gameStore";
import type {
  GameMode,
  GameOutcome,
  ObjectiveId,
  PieceColor,
  Termination,
} from "@/types";
import type { OpeningDatabase } from "@/game/openings/database";

export interface SessionConfig {
  prediction?: PredictionSnapshot;
  mode: GameMode;
  opponent: Opponent;
  color: PieceColor;
  timeControl: TimeControl;
  startFen: string | null;
  objective: ObjectiveId | null;
  /** Repertoire situation that suggested the player's opening, if any */
  situation: string | null;
  rated: boolean;
  /** The opponent plays this line (SAN) for as long as the game follows it: the Opening objective */
  forcedLine: string[] | null;
  /** How strongly the opponent plays. Defaults to its Elo. */
  strength?: Strength;
  /** The opponent never resigns (Conversion and Endgame objectives, and the engine) */
  noResign: boolean;
  allowTakeback: boolean;
  allowHint: boolean;
  /** Tell the player after each move how good it was (Training Game only) */
  liveFeedback: boolean;
  seed: number;
}

export interface LiveFeedback {
  ply: number;
  san: string;
  label: "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";
  betterSan: string | null;
  loss: number;
}

export interface MoveTime {
  ply: number;
  /** Milliseconds spent on the move */
  ms: number;
  /** Milliseconds left on the player's clock after the move, or null without a clock */
  left: number | null;
}

export type AnalysisState =
  | { status: "idle" }
  | { status: "running"; done: number; total: number }
  | { status: "done"; data: GameAnalysis }
  | { status: "error"; message: string };

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
const colorLetter = (c: PieceColor): "w" | "b" => (c === "white" ? "w" : "b");

function uciToSan(pos: Position, uci: string | null): string | null {
  if (!uci) return null;
  const m = parseUci(pos, uci);
  return m ? toSan(pos, m) : null;
}

/**
 * Runs one practice game: the clocks, the opponent's moves, resigning and draws, hints and takebacks.
 * When the game ends it is recorded once in the career save and then analysed in the background.
 * Every move, the player's and the opponent's, goes through the rules engine, so illegal moves are impossible.
 */
export function useGameSession(config: SessionConfig) {
  const [prediction] = useState(() => {
    if (config.prediction) return config.prediction;
    const save = useGameStore.getState().save;
    if (!save || config.startFen) return undefined;
    return careerPrediction(save, config.opponent, {
      id: `practice:${save.career.id}:${config.mode}:${config.seed}:${save.practice.gameCounter}`,
      color: config.color,
      timeControl: config.timeControl.category,
      playerElo:
        config.mode === "blitz"
          ? save.practice.blitzRating
          : save.player.rating,
      tournamentType: `practice-${config.mode}`,
    });
  });
  const cfg = useRef({ ...config, prediction });
  const careerId = useRef(useGameStore.getState().save?.career.id);
  const [game, setGame] = useState<GameState>(() =>
    createGame(config.startFen ?? undefined),
  );
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<GameEnd | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<LiveFeedback | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<RecordResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" });
  const [takebacks, setTakebacks] = useState(0);
  const [hints, setHints] = useState(0);
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const rng = useRef(createRng(mixSeed(config.seed, 0x6a3e)));
  const over = useRef(false);
  /** Bumped whenever a pending opponent move must be thrown away (takeback, game end) */
  const epoch = useRef(0);
  const clock = useRef({
    w: config.timeControl.base * 1000,
    b: config.timeControl.base * 1000,
    since: performance.now(),
  });
  const hasClock = config.timeControl.category !== "none";
  /** How long the player thought about each of their moves, and what was left on their clock afterwards */
  const moveTimes = useRef<MoveTime[]>([]);
  const feedbackMoves = useRef<
    Array<{ ply: number; label: LiveFeedback["label"] }>
  >([]);

  const playerColor = config.color;
  const turnColor = (g: GameState): PieceColor =>
    currentPosition(g).turn === "w" ? "white" : "black";

  /** Milliseconds left for a colour, counting the time used so far on the current move */
  const remaining = (color: PieceColor): number => {
    const key = colorLetter(color);
    const base = clock.current[key];
    // Each side's first move is free, as on the common chess servers.
    if (
      over.current ||
      !hasClock ||
      gameRef.current.ucis.length < 2 ||
      turnColor(gameRef.current) !== color
    )
      return base;
    return base - (performance.now() - clock.current.since);
  };

  const checkpoint = useCallback((current: GameState) => {
    const store = useGameStore.getState();
    if (store.save?.career.id !== careerId.current) return;
    const c = cfg.current;
    store.checkpointPracticeGame({
      prediction: c.prediction,
      predictionEligible: false,
      mode: c.mode,
      opponent: c.opponent,
      color: c.color,
      outcome: "loss",
      termination: "resignation",
      timeControl: c.timeControl,
      startFen: c.startFen,
      moves: current.sans,
      objective: c.objective,
      situation: c.situation,
      rated: c.rated,
    });
  }, []);

  const finish = useCallback(
    (end: GameEnd, final: GameState, interrupted = false) => {
      if (over.current) return;
      // Freeze the running clock at the result, including resignations and draws.
      if (hasClock && final.ucis.length >= 2) {
        const active = colorLetter(turnColor(final));
        clock.current[active] = Math.max(
          0,
          clock.current[active] - (performance.now() - clock.current.since),
        );
      }
      over.current = true;
      epoch.current++;
      setThinking(false);
      setHint(null);
      setResult(end);
      const c = cfg.current;
      // A late unmount/analysis from a previous career must never alter a new save.
      if (useGameStore.getState().save?.career.id !== careerId.current) return;
      const outcome: GameOutcome =
        end.result === "draw"
          ? "draw"
          : (end.result === "white") === (c.color === "white")
            ? "win"
            : "loss";
      const db: OpeningDatabase = useOpeningStore.getState().db;
      const rec = useGameStore.getState().recordPracticeGame(
        {
          prediction: c.prediction,
          predictionEligible: !interrupted,
          mode: c.mode,
          opponent: c.opponent,
          color: c.color,
          outcome,
          termination: end.reason as Termination,
          timeControl: c.timeControl,
          startFen: c.startFen,
          moves: final.sans,
          objective: c.objective,
          situation: c.situation,
          rated: c.rated,
        },
        db,
      );
      setRecorded(rec);
      if (!rec || final.ucis.length < 2) return;

      // Analyse in the background. The result is stored on the game when it is ready.
      const bookPlies = c.startFen
        ? 0
        : (db.classify(final.sans)?.bookPlies ?? 0);
      setAnalysis({ status: "running", done: 0, total: final.ucis.length + 1 });
      analyzeGame(engineManager, {
        game: final,
        depth: GAME_CONFIG.practice.analysisDepth,
        bookPlies,
        onProgress: (done, total) =>
          setAnalysis({ status: "running", done, total }),
      })
        .then((data) => {
          setAnalysis({ status: "done", data });
          if (useGameStore.getState().save?.career.id === careerId.current) {
            useGameStore.getState().attachAnalysis(rec.game.id, {
              engine: data.engine,
              depth: data.depth,
              evals: data.evals,
              labels: data.labels,
              whiteAccuracy: data.whiteAccuracy,
              blackAccuracy: data.blackAccuracy,
            });
          }
        })
        .catch((e: unknown) =>
          setAnalysis({
            status: "error",
            message: e instanceof Error ? e.message : "The analysis failed.",
          }),
        );
    },
    [],
  );

  /** Applies a move for whoever's turn it is: updates the clock, the game, and ends it when it is over. */
  const apply = useCallback(
    (move: Move) => {
      const g = gameRef.current;
      if (over.current) return null;
      const mover = turnColor(g);
      const c = cfg.current;
      // Recheck against the current board: clicks or asynchronous work may be stale.
      const legal = parseUci(currentPosition(g), moveToUci(move));
      if (!legal) return null;
      if (hasClock) {
        const key = colorLetter(mover);
        const timed = g.ucis.length >= 2;
        const used = timed ? performance.now() - clock.current.since : 0;
        // The 100ms display timer is not the authority on flag fall: a move arriving
        // after the deadline must lose on time before an increment can rescue it.
        if (timed && clock.current[key] - used <= 0) {
          clock.current[key] = 0;
          clock.current.since = performance.now();
          finish(timeoutResult(g, key), g);
          return null;
        }
        // The increment is added after a move, except the very first move of each side.
        clock.current[key] =
          Math.max(0, clock.current[key] - used) +
          (timed ? c.timeControl.increment * 1000 : 0);
        clock.current.since = performance.now();
      }
      const next = makeMove(g, legal);
      gameRef.current = next;
      setGame(next);
      setHint(null);
      const end = detectEnd(next);
      if (end) finish(end, next);
      else checkpoint(next);
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish, hasClock, checkpoint],
  );

  // Clock display and flag fall.
  useEffect(() => {
    if (!hasClock) return;
    const id = setInterval(() => {
      if (over.current) return;
      tick();
      const g = gameRef.current;
      const mover = turnColor(g);
      if (g.ucis.length >= 2 && remaining(mover) <= 0) {
        const key = colorLetter(mover);
        clock.current[key] = 0;
        finish(timeoutResult(g, key), g);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasClock, finish]);

  // Persist the immutable pre-match forecast before the first scheduled engine move.
  useEffect(() => {
    checkpoint(gameRef.current);
  }, [checkpoint]);

  // The opponent's turn.
  useEffect(() => {
    if (over.current) return;
    const c = cfg.current;
    if (turnColor(game) === playerColor) return;
    const myEpoch = ++epoch.current;
    setThinking(true);
    const startedAt = performance.now();
    void (async () => {
      try {
        const fromBook = opponentBookMove(
          c.opponent,
          c.color === "white" ? "black" : "white",
          game.sans,
          rng.current,
          c.forcedLine,
        );
        const pos = currentPosition(game);
        let move: Move | null = null;
        let evalCp = 0;
        if (fromBook) {
          const bookMove = legalMoves(pos).find(
            (m) =>
              toSan(pos, m).replace(/[+#]/g, "") ===
              fromBook.replace(/[+#]/g, ""),
          );
          if (bookMove) move = bookMove;
        }
        const book = move !== null;
        if (!move) {
          const strength = c.strength ?? strengthFor(c.opponent.elo);
          const choice = await chooseEngineMove(
            engineManager,
            game,
            strength,
            rng.current,
          );
          move = parseUci(pos, choice.uci);
          evalCp = choice.evalCp;
        }
        if (epoch.current !== myEpoch || over.current) return;
        if (!move) throw new Error("The opponent chose an illegal move.");

        // Resignation: a hopeless position for the opponent, late in the game.
        if (
          !book &&
          !c.noResign &&
          game.ucis.length > 30 &&
          evalCp <= -900 &&
          rng.current.chance(0.35)
        ) {
          const winner = c.color;
          finish({ result: winner, reason: "resignation" }, game);
          return;
        }

        // Human-like delay: book moves are quick, others take a moment. The clock keeps running meanwhile.
        const left = Math.max(1000, remaining(turnColor(game)));
        const wanted =
          c.mode === "engine"
            ? 0
            : hasClock
              ? Math.min(
                  2500,
                  npcThinkMs(
                    rng.current,
                    left,
                    c.timeControl.increment * 1000,
                    game.ucis.length,
                    book,
                  ),
                )
              : book
                ? 350
                : 700;
        await sleep(Math.max(0, wanted - (performance.now() - startedAt)));
        if (epoch.current !== myEpoch || over.current) return;
        setThinking(false);
        apply(move);
      } catch (error) {
        if (epoch.current !== myEpoch || over.current) return;
        // The engine failed completely. Play any legal move so the game can go on.
        setThinking(false);
        const pos = currentPosition(game);
        const any = legalMoves(pos)[0];
        if (any) {
          setNotice(
            `The engine had a problem (${error instanceof Error ? error.message : "unknown"}). A fallback move was played.`,
          );
          apply(any);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.ucis.length, playerColor]);

  /** The player's move. Ignored when it is not their turn or the game is over. */
  const move = useCallback(
    (m: Move) => {
      const g = gameRef.current;
      if (over.current || turnColor(g) !== playerColor) return;
      const before = currentPosition(g);
      const ply = g.ucis.length + 1;
      const san = toSan(before, m);
      const startGame = g;
      const spent = performance.now() - clock.current.since;
      if (!apply(m)) return;
      moveTimes.current.push({
        ply,
        ms: Math.round(spent),
        left: hasClock
          ? Math.round(clock.current[colorLetter(playerColor)])
          : null,
      });
      if (cfg.current.liveFeedback && !over.current) {
        // Compare the position before and after the move with a short search.
        void (async () => {
          try {
            const [pre, post] = [
              await engineManager.search({
                fen: startGame.startFen,
                moves: startGame.ucis,
                movetime: 250,
                depth: 12,
                multiPv: 2,
              }),
              await engineManager.search({
                fen: startGame.startFen,
                moves: [...startGame.ucis, moveToUci(m)],
                movetime: 250,
                depth: 12,
              }),
            ];
            const score = (l: (typeof pre.lines)[number]): number =>
              l.mate !== null ? (l.mate > 0 ? 1500 : -1500) : (l.cp ?? 0);
            const bestCp = score(pre.lines[0]);
            const afterCp = -score(post.lines[0]);
            const loss = Math.max(0, winPercent(bestCp) - winPercent(afterCp));
            const playedBest = pre.best === moveToUci(m);
            let label: LiveFeedback["label"] = playedBest
              ? "best"
              : loss < 2
                ? "good"
                : loss < 5
                  ? "good"
                  : loss < 10
                    ? "inaccuracy"
                    : loss < 20
                      ? "mistake"
                      : "blunder";
            if (
              playedBest &&
              pre.lines[1] &&
              winPercent(bestCp) < 92 &&
              winPercent(afterCp) >= 45 &&
              winPercent(bestCp) - winPercent(score(pre.lines[1])) >= 5 &&
              legalMoves(before).length > 1 &&
              isSacrifice(before, pre.lines[0].pv, before.turn === "w")
            )
              label = "brilliant";
            if (
              !over.current &&
              gameRef.current.ucis.slice(0, ply).join(" ") ===
                [...startGame.ucis, moveToUci(m)].join(" ")
            ) {
              feedbackMoves.current.push({ ply, label });
              setFeedback({
                ply,
                san,
                label,
                betterSan: playedBest ? null : uciToSan(before, pre.best),
                loss: Math.round(loss * 10) / 10,
              });
            }
          } catch {
            // Feedback is optional.
          }
        })();
      }
    },
    [apply, playerColor, hasClock],
  );

  const resign = useCallback(() => {
    if (over.current) return;
    finish(
      {
        result: playerColor === "white" ? "black" : "white",
        reason: "resignation",
      },
      gameRef.current,
    );
  }, [finish, playerColor]);

  /** Offers a draw. Resolves with the opponent's answer. Only the opponent's own evaluation decides. */
  const offerDraw = useCallback(async (): Promise<string> => {
    const g = gameRef.current;
    if (over.current) return "The game is over.";
    if (g.ucis.length < 2) return "It is too early to offer a draw.";
    if (turnColor(g) !== playerColor)
      return "Wait for your turn to offer a draw.";
    try {
      const a = await engineManager.search({
        fen: g.startFen,
        moves: g.ucis,
        movetime: 300,
        depth: 12,
      });
      const l = a.lines[0];
      // The line is scored for the player (side to move), so the opponent's evaluation is its negative.
      const forPlayer =
        l.mate !== null ? (l.mate > 0 ? 10000 : -10000) : (l.cp ?? 0);
      if (over.current || gameRef.current !== g) return "The position changed.";
      if (acceptsDraw(rng.current, -forPlayer, g.ucis.length)) {
        finish({ result: "draw", reason: "agreement" }, g);
        return "Your opponent accepted the draw.";
      }
      return "Your opponent declined the draw.";
    } catch {
      return "Your opponent declined the draw.";
    }
  }, [finish, playerColor]);

  /** Takes back the last move pair so it is the player's turn again. Only when the mode allows it. */
  const takeback = useCallback(() => {
    const g = gameRef.current;
    if (over.current || !cfg.current.allowTakeback || g.ucis.length === 0)
      return;
    const toRemove = turnColor(g) === playerColor ? 2 : 1;
    const keep = Math.max(0, g.ucis.length - toRemove);
    epoch.current++;
    setThinking(false);
    const next: GameState = {
      ...g,
      positions: g.positions.slice(0, keep + 1),
      moves: g.moves.slice(0, keep),
      sans: g.sans.slice(0, keep),
      ucis: g.ucis.slice(0, keep),
      keys: g.keys.slice(0, keep + 1),
    };
    gameRef.current = next;
    clock.current.since = performance.now();
    setGame(next);
    checkpoint(next);
    moveTimes.current = moveTimes.current.filter((m) => m.ply <= keep);
    feedbackMoves.current = feedbackMoves.current.filter((m) => m.ply <= keep);
    setHint(null);
    setFeedback(null);
    setTakebacks((n) => n + 1);
  }, [playerColor, checkpoint]);

  const requestHint = useCallback(async () => {
    const g = gameRef.current;
    if (over.current || !cfg.current.allowHint || turnColor(g) !== playerColor)
      return;
    setHints((n) => n + 1);
    try {
      const a = await engineManager.search({
        fen: g.startFen,
        moves: g.ucis,
        movetime: 600,
        depth: 14,
      });
      if (gameRef.current === g && !over.current) setHint(a.best);
    } catch {
      setNotice("No hint is available right now.");
    }
  }, [playerColor]);

  /** Leaving a game in progress counts as resignation once real moves have been played; otherwise it is discarded. */
  const leave = useCallback(() => {
    if (over.current) return;
    if (gameRef.current.ucis.length >= 2)
      finish(
        {
          result: playerColor === "white" ? "black" : "white",
          reason: "resignation",
        },
        gameRef.current,
        true,
      );
    else {
      over.current = true;
      epoch.current++;
      if (useGameStore.getState().save?.career.id === careerId.current)
        useGameStore.getState().checkpointPracticeGame(null);
    }
  }, [finish, playerColor]);

  // Closing the page or leaving the screen mid-game counts as leaving.
  useEffect(
    () => () => {
      if (!over.current) {
        if (gameRef.current.ucis.length >= 2)
          finish(
            {
              result: cfg.current.color === "white" ? "black" : "white",
              reason: "resignation",
            },
            gameRef.current,
            true,
          );
        // Fewer than two moves: nothing is recorded. Pending engine work is dropped. (Not marked over, because
        // React's development mode runs this cleanup once right after mounting.)
        else epoch.current++;
      }
      engineManager.stop();
    },
    [finish],
  );

  // Warm up the engine as soon as a game starts.
  useEffect(() => {
    void engineManager.ensureLoaded();
  }, []);

  return {
    prediction,
    game,
    position: currentPosition(game),
    playerColor,
    canMove: !over.current && !thinking && turnColor(game) === playerColor,
    over: result !== null,
    result,
    thinking,
    clocks: {
      white: Math.max(0, remaining("white")),
      black: Math.max(0, remaining("black")),
    },
    hasClock,
    hint,
    feedback,
    notice,
    recorded,
    analysis,
    takebacks,
    hints,
    liveFeedbackMoves: feedbackMoves.current,
    moveTimes: moveTimes.current,
    move,
    resign,
    offerDraw,
    takeback,
    requestHint,
    leave,
    dismissNotice: () => setNotice(null),
  };
}
