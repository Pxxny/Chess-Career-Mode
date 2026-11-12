import { useMatchRecords } from "@/hooks/useMatchRecords";
import { PredictionSummary } from "@/features/prediction/PredictionPanel";
import { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { ResultBadge } from "@/components/game/ResultBadge";
import { useSave } from "@/hooks/useGame";
import { Replay } from "@/features/match/MatchHistory";
import { openingGames, tournamentGames } from "@/game/qol/history";
import type { ActiveTournament, MatchRecord } from "@/types";
export function OpeningHistoryDialog({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const save = useSave(),
    matches = useMatchRecords(),
    rows = openingGames({ ...save, matches }, name);
  const [match, setMatch] = useState<MatchRecord | null>(null);
  return (
    <Modal open title={`${name} · Game history`} onClose={onClose} size="lg">
      <Button variant="secondary" className="mb-3" onClick={onClose}>
        Close
      </Button>
      {match ? (
        <Replay match={match} onClose={() => setMatch(null)} />
      ) : (
        <ul className="divide-y divide-white/10">
          {rows.map(({ game, match }) => (
            <li
              key={game.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <ResultBadge outcome={game.outcome} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  vs {game.opponentName} ({game.opponentElo})
                </p>
                <p className="text-xs text-ink-muted">
                  {game.year} · W{game.week} · {game.color} ·{" "}
                  {game.tournamentName ?? "Individual game"}
                </p>
              </div>
              <PredictionSummary
                prediction={match?.setup.prediction}
                actual={game.outcome}
              />
              {match ? (
                <Button variant="secondary" onClick={() => setMatch(match)}>
                  Replay game
                </Button>
              ) : (
                <span className="text-xs text-ink-muted">
                  Moves not retained
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
export function TournamentHistoryDialog({
  t,
  playerId,
  onClose,
}: {
  t: ActiveTournament;
  playerId: string;
  onClose: () => void;
}) {
  const save = useSave(),
    matches = useMatchRecords(),
    player = t.players.find((p) => p.id === playerId),
    rows = tournamentGames(t, playerId, matches);
  const [match, setMatch] = useState<MatchRecord | null>(null);
  return (
    <Modal
      open
      title={`${player?.name ?? "Player"} · ${t.name}`}
      onClose={onClose}
      size="lg"
    >
      <p className="mb-3 text-sm text-ink-muted">
        Games in this tournament only. Results are from this player's
        perspective.
      </p>
      <Button variant="secondary" className="mb-3" onClick={onClose}>
        Close
      </Button>
      {match ? (
        <Replay match={match} onClose={() => setMatch(null)} />
      ) : (
        <ul
          className="divide-y divide-white/10"
          data-testid="tournament-player-history"
        >
          {rows.map((r) => (
            <li
              key={r.round}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              {r.outcome ? (
                <ResultBadge outcome={r.outcome} />
              ) : (
                <span className="text-xs text-ink-muted">Upcoming</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  Round {r.round} · {r.opponent}
                  {r.elo !== null ? ` (${r.elo})` : ""}
                </p>
                <p className="text-xs text-ink-muted">
                  {r.bye ? "Bye · no board played" : r.color}
                  {!r.bye && r.outcome && !r.match
                    ? " · Simulated result; moves not stored"
                    : ""}
                </p>
              </div>
              {!r.bye && (
                <PredictionSummary
                  prediction={r.prediction}
                  actual={r.outcome ?? undefined}
                />
              )}
              {r.match && (
                <Button variant="secondary" onClick={() => setMatch(r.match)}>
                  Replay game
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
