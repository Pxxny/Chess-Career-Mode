import {
  finishSocialGame,
  cancelSocialInvitation,
  socialMatchValid,
} from "@/game/social/relationships";
import {
  predictionEnvironment,
  recordTournamentPredictions,
} from "@/game/prediction/adapters";
import { recordPredictions } from "@/game/prediction/statistics";
import { tournamentReady } from "@/game/competition/agenda";
import { tournamentBulletin } from "@/game/career/expansion";
import { reportEsportsGame, esportsContextValid } from "@/game/esports/core";
import { GAME_CONFIG } from "@/data/config";
import {
  accuracyBonusFor,
  recordGame,
  recordTournament,
  withGameAccuracy,
} from "@/game/history/recordGame";
import type { OpeningDatabase } from "@/game/openings/database";
import {
  createGame,
  makeMove,
  parseUci,
  currentPosition,
} from "@/game/chess/rules";
import type {
  GameOutcome,
  GameSave,
  MatchAnalysisReport,
  MatchRecord,
  PieceColor,
} from "@/types";
import { reportPlayerResult } from "./tournament";
import type { MatchFinish } from "./session";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const outcomeFor = (
  finish: Pick<MatchFinish, "result" | "termination">,
  playerColor: PieceColor,
): GameOutcome =>
  finish.result === "draw"
    ? "draw"
    : finish.result === playerColor
      ? "win"
      : "loss";

/** SAN moves of a game given as UCI moves. Stops at the first illegal move. */
export function sansFromUcis(ucis: readonly string[]): string[] {
  let game = createGame();
  for (const u of ucis) {
    const m = parseUci(currentPosition(game), u);
    if (!m) break;
    game = makeMove(game, m);
  }
  return game.sans;
}

export { applyNpcResult } from "@/game/npc/results";

export interface Applied {
  save: GameSave;
  record: MatchRecord | null;
  /** The tournament ended with this game */
  tournamentFinished: boolean;
}

/**
 * Applies a finished match to the career: the rated game (rating, peak, rated games, form, win rate, opening
 * statistics), tiredness and morale, the tournament, and the stored match. The accuracy of a rated game is set
 * later, when the analysis is ready (`attachMatchAnalysis`).
 */
export function applyFinishedMatch(
  save: GameSave,
  finish: MatchFinish,
  db: OpeningDatabase,
  ranks?: { before: number; after: (rating: number) => number },
): Applied {
  const { setup } = finish;
  const existing = setup.prediction
    ? save.matches.find((m) => m.setup.prediction?.id === setup.prediction?.id)
    : undefined;
  if (existing)
    return {
      save: { ...save, pendingMatch: null },
      record: existing,
      tournamentFinished: false,
    };
  const playerColor = setup.playerColor;
  if (
    setup.social &&
    (!socialMatchValid(save, setup.social) ||
      setup.rated ||
      setup.tournament ||
      setup.esports ||
      (setup.playerColor === "white" ? setup.black.id : setup.white.id) !==
        setup.social.npcId)
  )
    return { save, record: null, tournamentFinished: false };
  const outcome = outcomeFor(finish, playerColor);
  const opponent = playerColor === "white" ? setup.black : setup.white;
  const hit = db.classify(finish.moves);
  const stamp = save.world.date;
  const matchId = `m${save.matches.length + 1}-${stamp.year}-${stamp.week}-${save.history.games.length}`;

  let next = save;
  let gameResultId: string | null = null;
  let ratingBefore: number | null = null;
  let ratingAfter: number | null = null;
  if (setup.rated) {
    const input = {
      opponentId: opponent.id,
      opponentName: opponent.name,
      opponentElo: opponent.elo,
      outcome,
      color: playerColor,
      tournamentId: setup.tournament?.id ?? null,
      tournamentName: setup.tournament?.name ?? null,
      accuracy: null,
      opening: hit?.entry.name ?? null,
    };
    const provisional = recordGame(save, input);
    next = recordGame(
      save,
      ranks
        ? {
            ...input,
            worldRankBefore: ranks.before,
            worldRankAfter: ranks.after(provisional.player.rating),
          }
        : input,
    );
    const game = next.history.games[next.history.games.length - 1];
    gameResultId = game.id;
    ratingBefore = game.ratingBefore;
    ratingAfter = game.ratingAfter;
  }

  // Tiredness and mood. A friendly costs half as much and does not move morale.
  const tc = setup.timeControl.category;
  const factor = setup.rated ? 1 : 0.5;
  const fatigue = clamp(
    next.training.fatigue +
      GAME_CONFIG.match.fatigue[tc] *
        factor *
        (1 - next.player.attributes.stamina / 200),
    0,
    GAME_CONFIG.sessions.maxFatigue,
  );
  const moraleShift = !setup.rated
    ? 0
    : outcome === "win"
      ? GAME_CONFIG.match.moraleWin
      : outcome === "loss"
        ? GAME_CONFIG.match.moraleLoss
        : 0;
  next = {
    ...next,
    training: { ...next.training, fatigue: Math.round(fatigue * 10) / 10 },
    player: {
      ...next.player,
      morale: clamp(next.player.morale + moraleShift, 0, 100),
    },
  };

  if (setup.prediction)
    next = recordPredictions(next, [
      {
        prediction: setup.prediction,
        result: outcome,
        scope: "career",
        source: finish.playerMoved ? "played" : "engine-simulated",
        eligible: finish.termination !== "abandoned",
      },
    ]);

  // The tournament moves on.
  let tournamentFinished = false;
  if (
    setup.tournament &&
    next.tournament &&
    next.tournament.eventId === setup.tournament.id &&
    next.tournament.status === "playing"
  ) {
    const t = reportPlayerResult(
      next.tournament,
      outcome,
      predictionEnvironment(next),
    );
    tournamentFinished = t.status === "finished";
    next = recordTournamentPredictions(
      tournamentBulletin({ ...next, tournament: t }, t),
      t,
    );
    if (tournamentFinished) {
      next = recordTournament(next, {
        tournamentId: t.eventId,
        name: t.name,
        level: t.level,
        rank: t.finalRank ?? t.players.length,
        fieldSize: t.players.length,
        points: t.players.find((p) => p.isPlayer)?.points ?? 0,
        prize: t.prize,
      });
    }
  }

  const record: MatchRecord = {
    id: matchId,
    ...stamp,
    setup,
    result: finish.result,
    termination: finish.termination,
    outcome,
    moves: finish.moves,
    gameResultId,
    openingName: hit?.entry.name ?? null,
    openingEco: hit?.entry.eco ?? null,
    simulated: !finish.playerMoved,
    controlLog: finish.controlLog,
    ratingBefore,
    ratingAfter,
    analysis: null,
  };
  next = {
    ...next,
    matches: [...next.matches, record].slice(-GAME_CONFIG.match.maxRecords),
  };
  if (setup.esports) next = reportEsportsGame(next, setup.esports, outcome);
  if (setup.social)
    next = finishSocialGame(
      next,
      setup.social,
      finish.termination !== "abandoned" &&
        finish.playerMoved &&
        (finish.moves.length >= 12 || finish.termination === "checkmate"),
    );
  return { save: next, record, tournamentFinished };
}

/** Stores the analysis on its match and sets the accuracy of the rated game. */
export function attachMatchAnalysis(
  save: GameSave,
  matchId: string,
  report: MatchAnalysisReport,
): GameSave {
  const match = save.matches.find((m) => m.id === matchId);
  if (!match) return save;
  let next: GameSave = {
    ...save,
    matches: save.matches.map((m) =>
      m.id === matchId ? { ...m, analysis: report } : m,
    ),
  };
  if (match.gameResultId) {
    const accuracy =
      match.setup.playerColor === "white"
        ? report.whiteAccuracy
        : report.blackAccuracy;
    next = withGameAccuracy(
      next,
      match.gameResultId,
      accuracy,
      match.setup.accuracyBonus,
    );
  }
  return next;
}

/** A checkpoint left by a previous page: the game was abandoned. Records it once and clears the checkpoint. */
export function recoverPendingMatch(
  save: GameSave,
  db: OpeningDatabase,
): Applied | { save: GameSave; record: null; tournamentFinished: false } {
  const pending = save.pendingMatch;
  if (!pending) return { save, record: null, tournamentFinished: false };
  if (pending.setup.social && !socialMatchValid(save, pending.setup.social))
    return {
      save: { ...save, pendingMatch: null },
      record: null,
      tournamentFinished: false,
    };
  const cleared: GameSave = { ...save, pendingMatch: null };
  if (
    pending.setup.tournament &&
    !pending.setup.esports &&
    (cleared.tournament?.status !== "playing" ||
      cleared.tournament.eventId !== pending.setup.tournament.id ||
      cleared.tournament.round !== pending.setup.tournament.round ||
      !tournamentReady(cleared))
  )
    return { save: cleared, record: null, tournamentFinished: false };
  if (
    pending.setup.esports &&
    !esportsContextValid(cleared, pending.setup.esports)
  )
    return { save: cleared, record: null, tournamentFinished: false };
  if (pending.ucis.length < 2 || !pending.playerMoved)
    return {
      save: pending.setup.social ? cancelSocialInvitation(cleared) : cleared,
      record: null,
      tournamentFinished: false,
    };
  const loser = pending.setup.playerColor;
  const finish: MatchFinish = {
    setup: pending.setup,
    result: loser === "white" ? "black" : "white",
    termination: "abandoned",
    moves: sansFromUcis(pending.ucis),
    ucis: pending.ucis,
    controlLog: [],
    playerMoved: true,
  };
  return applyFinishedMatch(cleared, finish, db);
}

export { accuracyBonusFor };
