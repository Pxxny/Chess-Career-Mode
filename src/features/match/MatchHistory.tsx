import { analyzeMatch } from "@/game/match/review";
import { engineManager } from "@/game/engine/manager";
import { getBaseOpeningDatabase } from "@/game/openings/database";
import { acquireMatch, releaseMatch } from "@/store/matchLocks";
import { useGameStore } from "@/store/gameStore";
import type { MatchAnalysisReport } from "@/types";
import { translateUI } from "@/i18n/translate";
import { useMatchRecords } from "@/hooks/useMatchRecords";
import { downloadPgn } from "@/game/match/pgn";
import {
  PredictionPanel,
  PredictionSummary,
} from "@/features/prediction/PredictionPanel";
import { boardAnnotation } from "@/components/game/MoveAnnotation";
import { useEffect, useRef, useMemo, useState } from "react";
import { Card, CardTitle, EmptyState } from "@/components/ui";
import { ResultBadge } from "@/components/game/ResultBadge";
import { useSave } from "@/hooks/useGame";
import { gameFromSans } from "@/game/chess/rules";
import { describeTimeControl } from "@/game/match/timeControls";
import { inCheck } from "@/game/chess/board";
import type { MatchRecord, ReviewLabel } from "@/types";
import { EvalBar } from "./EvalPanel";
import { MatchBoard } from "./MatchBoard";
import { MoveList } from "./MoveList";
import { ReviewReport } from "./ReviewReport";
import { PlayerPanel } from "./PlayerPanel";

const NO_TARGETS = (): string[] => [];

/** Replay of a stored game with its analysis. */
export function Replay({
  match,
  onClose,
}: {
  match: MatchRecord;
  onClose: () => void;
}) {
  const game = useMemo(() => gameFromSans(match.moves), [match]);
  const [view, setView] = useState<number | null>(null);
  const ply = view ?? game.ucis.length;
  const position = game.positions[ply];
  const last = ply > 0 ? game.moves[ply - 1] : null;
  const king = inCheck(position)
    ? position.board.findIndex((p) => p === (position.turn === "w" ? "K" : "k"))
    : -1;
  const recordedClock = match.recording
    ? view === null
      ? match.recording.finalClocks
      : match.recording.clocks[ply]
    : undefined;
  const careerId = useSave().career.id;
  const [analysis, setAnalysis] = useState<MatchAnalysisReport | null>(null),
    [analyzing, setAnalyzing] = useState(false),
    [analysisProgress, setAnalysisProgress] = useState(""),
    [analysisError, setAnalysisError] = useState("");
  const cancelled = useRef(false),
    alive = useRef(true),
    token = useRef(Symbol("saved-game-analysis"));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelled.current = true;
    };
  }, []);
  const analyze = async () => {
    if (
      useGameStore.getState().calendarProgress ||
      !acquireMatch(careerId, token.current)
    ) {
      setAnalysisError("Finish the running activity first.");
      return;
    }
    cancelled.current = false;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const report = await analyzeMatch(
        engineManager,
        {
          game,
          depth: 12,
          isCancelled: () => cancelled.current,
          onProgress: (done, total) => {
            if (alive.current) setAnalysisProgress(`${done} / ${total}`);
          },
        },
        getBaseOpeningDatabase(),
      );
      if (
        cancelled.current ||
        !alive.current ||
        useGameStore.getState().save?.career.id !== careerId
      )
        return;
      useGameStore.getState().attachMatchAnalysis(match.id, report, match);
      setAnalysis(report);
    } catch (error) {
      if (!cancelled.current && alive.current)
        setAnalysisError(
          "Analysis could not be completed. Your saved game is kept.",
        );
    } finally {
      releaseMatch(careerId, token.current);
      if (alive.current) setAnalyzing(false);
    }
  };
  const report = analysis ?? match.analysis;
  const live = report
    ? {
        cp: report.evals[ply] ?? 0,
        mate: ply > 0 ? (report.moves[ply - 1]?.mateAfter ?? null) : null,
        depth: report.depth,
        bestSan: null,
        pv: [],
        engine: report.engine,
        ply,
      }
    : null;
  if (match.setup.simulation === "season" && !match.moves.length)
    return (
      <div className="space-y-3" data-testid="season-game-result">
        <button
          type="button"
          onClick={onClose}
          className="text-gold-300 underline"
        >
          ← Back to the list
        </button>
        <p className="font-semibold">Season simulation result</p>
        <p translate="no">
          {match.setup.white.name} — {match.setup.black.name}
        </p>
        <ResultBadge outcome={match.outcome} />
        <p className="text-sm text-ink-muted">
          This result was calculated by the season simulation model. No moves or
          engine analysis were generated.
        </p>
      </div>
    );
  const flipped = match.setup.playerColor === "black";
  const top = flipped ? "white" : "black";
  const bottom = flipped ? "black" : "white";
  return (
    <div className="space-y-3" data-testid="replay">
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-gold-300 underline"
      >
        ← Back to the list
      </button>
      <div
        data-testid="recorded-game-details"
        className="rounded-lg bg-navy-900 p-3 text-sm space-y-2"
      >
        <p translate="no">
          {match.setup.white.name} — {match.setup.black.name}
        </p>
        <p>
          {match.year} · W{match.week} · {match.setup.tournament?.name} · Round{" "}
          {match.setup.tournament?.round}
        </p>
        <p>
          <ResultBadge outcome={match.outcome} /> ·{" "}
          {translateUI(match.termination)} ·{" "}
          {describeTimeControl(match.setup.timeControl)}
        </p>
        <p>
          <span translate="no">
            {match.openingName ?? translateUI("Unknown opening")}{" "}
            {match.openingEco ?? ""}
          </span>{" "}
          · {translateUI(`${match.moves.length} plies`)}
        </p>
        <p>
          Elo {match.ratingBefore} → {match.ratingAfter}
        </p>
        {match.recording && (
          <>
            <p>
              {match.recording.engine} · Recorded chess clocks are simulated
              game time.
            </p>
            <p>
              Simulation processing:{" "}
              {(match.recording.wallMs / 1000).toFixed(2)} s · Game time:{" "}
              {((match.recording.gameTimeMs ?? 0) / 60000).toFixed(1)} min
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => downloadPgn(match)}
          className="text-gold-300 underline"
        >
          Download PGN
        </button>
      </div>
      {match.setup.prediction ? (
        <PredictionPanel
          prediction={match.setup.prediction}
          actual={match.outcome}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          No pre-match prediction recorded for this older game.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <PlayerPanel
            side={match.setup[top]}
            color={top}
            remaining={recordedClock?.[top] ?? Infinity}
            active={false}
            controller="auto"
            thinking={false}
          />
          <div className="flex gap-2">
            <EvalBar live={live} flipped={flipped} />
            <div className="min-w-0 flex-1">
              <MatchBoard
                annotation={boardAnnotation(
                  last,
                  report?.moves[ply - 1]?.label,
                )}
                position={position}
                perspective={flipped ? "black" : "white"}
                movable={null}
                legalTargets={NO_TARGETS}
                onMove={() => undefined}
                lastMove={last ? { from: last.from, to: last.to } : null}
                checkSquare={king}
              />
            </div>
          </div>
          <PlayerPanel
            side={match.setup[bottom]}
            color={bottom}
            remaining={recordedClock?.[bottom] ?? Infinity}
            active={false}
            controller="auto"
            thinking={false}
          />
        </div>
        <MoveList
          sans={match.moves}
          viewPly={view}
          onView={setView}
          labels={
            report?.moves.map((m) => m.label) as ReviewLabel[] | undefined
          }
        />
      </div>
      {report ? (
        <ReviewReport
          report={report}
          white={match.setup.white}
          black={match.setup.black}
          selectedPly={view}
          onSelectPly={setView}
        />
      ) : (
        <Card>
          <p className="text-sm text-ink-muted">
            This game is saved. Engine analysis has not been requested.
          </p>
          {analyzing ? (
            <>
              <p role="status">Analyzing saved game: {analysisProgress}</p>
              <button
                type="button"
                onClick={() => {
                  cancelled.current = true;
                }}
                className="mt-2 text-gold-300 underline"
              >
                Cancel analysis
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void analyze()}
              className="mt-2 text-gold-300 underline"
            >
              Analyze saved game
            </button>
          )}
          {analysisError && <p role="alert">{translateUI(analysisError)}</p>}
        </Card>
      )}
    </div>
  );
}

/** Every finished match, newest first. */
export function MatchHistory() {
  const save = useSave();
  const [open, setOpen] = useState<string | null>(null);
  const records = useMatchRecords();
  const [limit, setLimit] = useState(60);
  const [query, setQuery] = useState(""),
    [order, setOrder] = useState("newest");
  const filtered = records.filter((m) =>
    `${m.setup.white.name} ${m.setup.black.name} ${m.setup.tournament?.name ?? ""} ${m.openingName ?? ""} ${m.openingEco ?? ""} ${m.year}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const matches = order === "oldest" ? filtered : [...filtered].reverse();
  const match = matches.find((m) => m.id === open);
  if (match) return <Replay match={match} onClose={() => setOpen(null)} />;
  return (
    <Card>
      <CardTitle>Match history</CardTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          aria-label="Search saved matches"
          placeholder="Player, tournament, opening or year"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(60);
          }}
          className="min-w-0 flex-1 rounded-lg bg-navy-900 p-3"
        />
        <select
          aria-label="Match order"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="rounded-lg bg-navy-900 p-3"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <p
        data-testid="archived-match-count"
        className="mb-3 text-sm text-ink-muted"
      >
        {matches.length} saved matches
      </p>
      {matches.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 60)}
          className="mb-3 text-gold-300 underline"
        >
          Show more saved matches
        </button>
      )}
      {matches.length === 0 ? (
        <EmptyState
          title="No games yet"
          description="Finished games appear here with their full analysis."
        />
      ) : (
        <ul
          className="divide-y divide-white/[0.06]"
          data-testid="match-history"
        >
          {matches.slice(0, limit).map((m) => {
            const opp =
              m.setup.playerColor === "white" ? m.setup.black : m.setup.white;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpen(m.id)}
                  className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-white/5"
                >
                  <ResultBadge outcome={m.outcome} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">
                      vs {opp.name} ({opp.elo})
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {m.setup.tournament
                        ? `${m.setup.tournament.name}, round ${m.setup.tournament.round} · `
                        : ""}
                      {m.setup.rated ? "Rated" : "Friendly"} ·{" "}
                      {describeTimeControl(m.setup.timeControl)} ·{" "}
                      {m.openingName ?? "Unknown opening"}
                      {m.simulated ? " · simulated" : ""}
                    </span>
                  </span>
                  <PredictionSummary
                    prediction={m.setup.prediction}
                    actual={m.outcome}
                  />
                  {m.ratingBefore !== null && m.ratingAfter !== null && (
                    <span className="font-mono text-sm text-ink-muted">
                      {m.ratingAfter - m.ratingBefore >= 0 ? "+" : ""}
                      {m.ratingAfter - m.ratingBefore}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
