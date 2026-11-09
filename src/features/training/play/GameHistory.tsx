import {
  PredictionPanel,
  PredictionSummary,
} from "@/features/prediction/PredictionPanel";
import { useMemo, useRef, useState } from "react";
import { Button, Card, CardTitle, EmptyState } from "@/components/ui";
import { ResultBadge } from "@/components/game/ResultBadge";
import { gameFromSans, START_FEN } from "@/game/chess/rules";
import type { GameMode, PlayedGame } from "@/types";
import { analyzeGame } from "@/game/engine/analysis";
import { engineManager } from "@/game/engine/manager";
import { GAME_CONFIG } from "@/data/config";
import { useGameStore } from "@/store/gameStore";
import { useOpeningDb } from "@/store/openingStore";
import { AnalysisPanel } from "./AnalysisPanel";
import type { AnalysisState } from "./useGameSession";

const MODE: Record<GameMode, string> = {
  training: "Training",
  blitz: "Online blitz",
  engine: "Engine",
};

/** A past practice game with its analysis, opened from a history list. */
/** Older simulated games kept only a few opening moves and a result rolled from the ratings. */
const isOpeningOnly = (g: PlayedGame): boolean =>
  g.simulated && g.moves.length < 20 && g.termination !== "timeout";

export function GameReview({
  game,
  onClose,
}: {
  game: PlayedGame;
  onClose: () => void;
}) {
  const db = useOpeningDb();
  const state = useMemo(
    () => gameFromSans(game.moves, game.startFen ?? START_FEN),
    [game],
  );
  const [analysis, setAnalysis] = useState<AnalysisState>(
    game.analysis
      ? { status: "done", data: game.analysis as never }
      : { status: "idle" },
  );
  const run = useRef(0);

  /** Analyses a game that has no analysis yet (a simulated game, or one closed before the engine finished). */
  const analyse = () => {
    const mine = ++run.current;
    setAnalysis({ status: "running", done: 0, total: state.ucis.length + 1 });
    analyzeGame(engineManager, {
      game: state,
      depth: GAME_CONFIG.practice.analysisDepth,
      bookPlies: game.startFen ? 0 : (db.classify(game.moves)?.bookPlies ?? 0),
      onProgress: (done, total) =>
        run.current === mine && setAnalysis({ status: "running", done, total }),
    })
      .then((data) => {
        useGameStore.getState().attachAnalysis(game.id, {
          engine: data.engine,
          depth: data.depth,
          evals: data.evals,
          labels: data.labels,
          whiteAccuracy: data.whiteAccuracy,
          blackAccuracy: data.blackAccuracy,
        });
        if (run.current === mine) setAnalysis({ status: "done", data });
      })
      .catch(
        (e: unknown) =>
          run.current === mine &&
          setAnalysis({
            status: "error",
            message: e instanceof Error ? e.message : "The analysis failed.",
          }),
      );
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          {MODE[game.mode]} game vs {game.opponentName} ({game.opponentElo}) ·{" "}
          {game.color}
          {game.openingName ? ` · ${game.openingName}` : ""}
          {game.simulated ? " · simulated" : ""}
        </p>
        <Button variant="secondary" onClick={onClose}>
          Close review
        </Button>
      </div>
      {game.prediction ? (
        <PredictionPanel prediction={game.prediction} actual={game.outcome} />
      ) : (
        <p className="mb-3 text-xs text-ink-faint">
          No pre-match prediction recorded for this game.
        </p>
      )}
      {isOpeningOnly(game) && (
        <p className="mb-2 text-sm text-ink-muted">
          This is an older simulated game: only its opening moves were kept and
          the result came from the ratings. You can still analyse those moves.
        </p>
      )}
      {game.moves.length < 2 ? (
        <p className="text-sm text-ink-muted">
          This game has no moves to analyse.
        </p>
      ) : (
        <>
          {analysis.status === "idle" && (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Button onClick={analyse}>Analyse this game</Button>
              <span className="text-xs text-ink-muted">
                The engine checks every move. It takes a minute for a long game.
              </span>
            </div>
          )}
          <AnalysisPanel
            game={state}
            analysis={analysis}
            feedback={[]}
            color={game.color}
          />
          {analysis.status === "error" && (
            <Button className="mt-3" variant="secondary" onClick={analyse}>
              Try again
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function GameHistory({
  games,
  title,
  limit = 10,
}: {
  games: PlayedGame[];
  title: string;
  limit?: number;
}) {
  const [open, setOpen] = useState<PlayedGame | null>(null);
  const list = [...games].reverse().slice(0, limit);
  if (open) return <GameReview game={open} onClose={() => setOpen(null)} />;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {list.length === 0 ? (
        <EmptyState
          title="No games yet"
          description="Finished games appear here with their result and analysis."
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {list.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2.5">
              <ResultBadge outcome={g.outcome} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {g.opponentName}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {MODE[g.mode]} · Elo {g.opponentElo} · {g.color} ·{" "}
                  {g.timeControl}
                  {g.openingName ? ` · ${g.openingName}` : ""}
                  {g.accuracy !== null
                    ? ` · ${Math.round(g.accuracy)}% accuracy`
                    : ""}
                  {g.simulated ? " · simulated" : ""}
                </p>
              </div>
              <PredictionSummary prediction={g.prediction} actual={g.outcome} />
              {g.ratingBefore !== null && g.ratingAfter !== null && (
                <span
                  className={`text-sm font-bold tabular-nums ${g.ratingAfter >= g.ratingBefore ? "text-emerald-300" : "text-red-300"}`}
                  aria-label={`Rating change ${g.ratingAfter - g.ratingBefore}`}
                >
                  {g.ratingAfter - g.ratingBefore >= 0 ? "+" : ""}
                  {g.ratingAfter - g.ratingBefore}
                </span>
              )}
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => setOpen(g)}
              >
                {g.analysis ? "Analysis" : "Review"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
