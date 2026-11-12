import { ratingChange } from "@/game/history/elo";
import { higherTitle, tierForElo, titleForPeak } from "@/data/chess/tiers";
import type { GameOutcome, Npc } from "@/types";

/** Apply a played/simulated rated result, never a free-standing random Elo change. */
export function applyNpcResult(
  npc: Npc,
  outcome: GameOutcome,
  opponentElo: number,
): Npc {
  const before = npc.currentElo;
  const after = Math.max(
    100,
    before + ratingChange(before, opponentElo, outcome, 40),
  );
  const shift = outcome === "win" ? 3 : outcome === "loss" ? -3 : 0;
  const stats = npc.competitionStats ?? {
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };
  const peakElo = Math.max(npc.peakElo, after);
  return {
    ...npc,
    currentElo: after,
    peakElo,
    league: tierForElo(after),
    title:
      npc.kind === "real"
        ? npc.title
        : higherTitle(npc.title, titleForPeak(peakElo)),
    ...(npc.kind === "legend"
      ? {
          careerRatingDelta: (npc.careerRatingDelta ?? 0) + after - before,
          simulationPeakBase: npc.simulationPeakBase ?? npc.peakElo,
        }
      : {}),
    competitionStats: {
      games: stats.games + 1,
      wins: stats.wins + Number(outcome === "win"),
      draws: stats.draws + Number(outcome === "draw"),
      losses: stats.losses + Number(outcome === "loss"),
    },
    form: Math.max(0, Math.min(100, npc.form + shift)),
    morale: Math.max(0, Math.min(100, npc.morale + shift)),
  };
}
