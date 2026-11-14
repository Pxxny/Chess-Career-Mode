import { awardAchievements } from "@/game/career/achievements";
import {
  canEarnTitle,
  awardPlayerTitles,
  addTournamentNorms,
} from "@/game/career/titleRules";
import { addLifetimeGame, lifetimeOf } from "./lifetime";
import { recordRatedContact } from "@/game/social/relationships";
import { trackYearActivity } from "@/game/career/yearReview";
import { archiveCompetition } from "@/game/competition/preparation";
import { standings } from "@/game/match/tournament";
import { tierForElo, getTier } from "@/data/chess/tiers";
import { GAME_CONFIG } from "@/data/config";
import { TITLE_LADDER } from "@/data/titles";
import type {
  CareerHistory,
  GameOutcome,
  GameResult,
  GameSave,
  GameStamp,
  LedgerEntry,
  NewsItem,
  PieceColor,
  TournamentRecord,
  Trophy,
} from "@/types";
import { ratingChange } from "./elo";

export interface GameInput {
  opponentId: string | null;
  opponentName: string;
  opponentElo: number;
  outcome: GameOutcome;
  color: PieceColor;
  tournamentId?: string | null;
  tournamentName?: string | null;
  /** Accuracy 0-100, or null when the engine analysis has not finished yet (set later with `withGameAccuracy`) */
  accuracy: number | null;
  opening?: string | null;
  /** World ranks before/after, supplied by the caller that owns the NPC database */
  worldRankBefore?: number;
  worldRankAfter?: number;
}

const ELO_MILESTONE_STEP = 100;
const RIVALRY_GAMES = [3, 5, 10];
const cap = <T>(items: T[], max: number): T[] =>
  items.length > max ? items.slice(items.length - max) : items;

function addTrophy(history: CareerHistory, trophy: Trophy): void {
  if (!history.trophies.some((t) => t.id === trophy.id))
    history.trophies.push(trophy);
}
function addNews(history: CareerHistory, item: NewsItem): void {
  if (!history.news.some((n) => n.id === item.id)) history.news.push(item);
  history.news = cap(history.news, GAME_CONFIG.history.maxNews);
}

/** Accuracy points a scouting report (+3) or a tournament plan (+2) adds to a game. */
export function accuracyBonusFor(
  save: GameSave,
  opponentId: string | null,
  tournamentId: string | null | undefined,
): number {
  const scouted =
    save.training.scouting !== null &&
    save.training.scouting.opponentId === opponentId;
  const prepared =
    save.training.tournamentPrep !== null &&
    tournamentId != null &&
    save.training.tournamentPrep.eventId === tournamentId;
  return (scouted ? 3 : 0) + (prepared ? 2 : 0);
}

/** Sets the accuracy of a game recorded without one, once the analysis is ready. Counts the game as analysed. */
export function withGameAccuracy(
  save: GameSave,
  gameId: string,
  accuracy: number,
  bonus = 0,
): GameSave {
  const target = save.history.games.find((g) => g.id === gameId);
  if (!target) return save;
  const value = Math.min(100, Math.max(0, Math.round(accuracy + bonus)));
  const lifetime = structuredClone(lifetimeOf(save.history));
  lifetime.accuracySum +=
    value - (target.analyzed === false ? 0 : target.accuracy);
  if (target.analyzed === false) lifetime.analysedGames++;
  return {
    ...save,
    history: {
      ...save.history,
      lifetime,
      games: save.history.games.map((g) =>
        g.id === gameId ? { ...g, accuracy: value, analyzed: true } : g,
      ),
    },
    training:
      target.analyzed === false
        ? {
            ...save.training,
            unanalyzedGames: Math.max(0, save.training.unanalyzedGames - 1),
          }
        : save.training,
  };
}

/**
 * Records one rated game and applies every consequence: rating, peak, league, titles,
 * Elo milestones, achievements, rivalries and news. Pure: returns a new save.
 * The match engine calls this (through the store) when a game ends.
 */
function recordGameBase(save: GameSave, input: GameInput): GameSave {
  const { player, world } = save;
  const stamp: GameStamp = { ...world.date, day: world.day };
  const history: CareerHistory = {
    ...save.history,
    games: [...save.history.games],
    trophies: [...save.history.trophies],
    news: [...save.history.news],
    titles: [...save.history.titles],
    ratingHistory: [...save.history.ratingHistory],
  };

  const before = player.rating;
  const delta = ratingChange(
    before,
    input.opponentElo,
    input.outcome,
    player.ratedGames,
  );
  const after = Math.max(100, before + delta);
  // Preparation pays off: a scouting report on this opponent or a plan for this tournament.
  const scouted =
    save.training.scouting !== null &&
    save.training.scouting.opponentId === input.opponentId;
  const prepared =
    save.training.tournamentPrep !== null &&
    input.tournamentId != null &&
    save.training.tournamentPrep.eventId === input.tournamentId;
  const pending = input.accuracy === null;
  const accuracy = pending
    ? 0
    : Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (input.accuracy as number) + (scouted ? 3 : 0) + (prepared ? 2 : 0),
          ),
        ),
      );
  const game: GameResult = {
    npcRatingTracked: true,
    id: `g${player.ratedGames + 1}-${stamp.year}-${stamp.week}`,
    ...stamp,
    opponentId: input.opponentId,
    opponentName: input.opponentName,
    opponentElo: input.opponentElo,
    outcome: input.outcome,
    color: input.color,
    tournamentId: input.tournamentId ?? null,
    tournamentName: input.tournamentName ?? null,
    ratingBefore: before,
    ratingAfter: after,
    accuracy,
    ...(pending ? { analyzed: false } : {}),
    opening: input.opening ?? null,
  };
  history.lifetime = addLifetimeGame(lifetimeOf(save.history), game);
  history.games.push(game);
  history.games = cap(history.games, GAME_CONFIG.history.maxGames);
  history.ratingHistory.push({ ...stamp, elo: after });

  const peak = Math.max(player.peakRating, after);
  const ratedGames = player.ratedGames + 1;
  const reputationGain =
    input.outcome === "win"
      ? Math.max(1, Math.round(input.opponentElo / 1000))
      : 0;
  const league = tierForElo(after);

  // Titles follow peak Elo and are kept for life.
  for (const step of TITLE_LADDER) {
    if (
      canEarnTitle(
        { ...player, peakRating: peak, ratedGames },
        history,
        step.id,
      ) &&
      !history.titles.some((t) => t.title === step.id)
    ) {
      history.titles.push({ ...stamp, title: step.id });
      addTrophy(history, {
        id: `title-${step.id}`,
        category: "title",
        name: step.label,
        description: `Reached ${step.minElo} Elo and earned the ${step.label} title.`,
        ...stamp,
      });
      addNews(history, {
        id: `news-title-${step.id}`,
        kind: "title",
        headline: `You are now a ${step.label}`,
        detail: `Peak Elo ${peak}.`,
        ...stamp,
      });
    }
  }

  // Elo milestones.
  for (
    let m =
      Math.ceil((player.peakRating + 1) / ELO_MILESTONE_STEP) *
      ELO_MILESTONE_STEP;
    m <= peak;
    m += ELO_MILESTONE_STEP
  ) {
    addTrophy(history, {
      id: `elo-${m}`,
      category: "elo",
      name: `${m} Elo`,
      description: `Reached a rating of ${m}.`,
      ...stamp,
    });
    addNews(history, {
      id: `news-elo-${m}`,
      kind: "milestone",
      headline: `Rating milestone: ${m}`,
      ...stamp,
    });
  }

  // League promotion.
  if (league !== player.league && after > before) {
    const name = getTier(league).leagueName;
    addTrophy(history, {
      id: `league-${league}`,
      category: "league",
      name: `Promoted to the ${name}`,
      description: `Your rating of ${after} lifted you into the ${name}.`,
      ...stamp,
    });
    addNews(history, {
      id: `news-league-${league}`,
      kind: "promotion",
      headline: `Promoted to the ${name}`,
      ...stamp,
    });
  }

  // Ranking improvement.
  if (
    input.worldRankBefore !== undefined &&
    input.worldRankAfter !== undefined &&
    input.worldRankAfter < input.worldRankBefore
  ) {
    addNews(history, {
      id: `news-rank-${history.games.length}`,
      kind: "ranking",
      headline: `World ranking improved to #${input.worldRankAfter}`,
      detail: `Up ${input.worldRankBefore - input.worldRankAfter} places.`,
      ...stamp,
    });
  }

  // Special achievements.
  if (history.games.length === 1)
    addTrophy(history, {
      id: "first-game",
      category: "special",
      name: "Debut",
      description: "Played your first rated game.",
      ...stamp,
    });
  if (
    input.outcome === "win" &&
    !history.games.slice(0, -1).some((g) => g.outcome === "win")
  )
    addTrophy(history, {
      id: "first-win",
      category: "special",
      name: "First victory",
      description: `Beat ${input.opponentName}.`,
      ...stamp,
    });
  if (input.outcome === "win" && input.opponentElo - before >= 200)
    addTrophy(history, {
      id: `giant-${history.games.length}`,
      category: "special",
      name: "Giant killer",
      description: `Beat ${input.opponentName} (${input.opponentElo}), 200 or more points above you.`,
      ...stamp,
    });
  const streak = (() => {
    let n = 0;
    for (
      let i = history.games.length - 1;
      i >= 0 && history.games[i].outcome === "win";
      i--
    )
      n++;
    return n;
  })();
  if (input.outcome === "win" && streak === 10)
    addTrophy(history, {
      id: "streak-10",
      category: "special",
      name: "Ten in a row",
      description: "Won ten rated games in a row.",
      ...stamp,
    });
  if (ratedGames === 100)
    addTrophy(history, {
      id: "games-100",
      category: "special",
      name: "Centurion",
      description: "Played 100 rated games.",
      ...stamp,
    });

  if (input.outcome === "win" && input.opponentElo - before >= 200)
    addNews(history, {
      id: `underdog-${game.id}`,
      kind: "milestone",
      headline: `Underdog victory: you beat ${input.opponentName}`,
      detail: `${before} against ${input.opponentElo} Elo.`,
      ...stamp,
    });
  if (input.outcome === "loss" && before - input.opponentElo >= 200)
    addNews(history, {
      id: `upset-loss-${game.id}`,
      kind: "history",
      headline: `${input.opponentName} causes an upset`,
      detail: `You lost to a player ${before - input.opponentElo} rating points below you.`,
      ...stamp,
    });
  // Rivalries: repeated meetings with the same opponent.
  const meetings = history.games.filter((g) =>
    input.opponentId
      ? g.opponentId === input.opponentId
      : g.opponentName === input.opponentName,
  ).length;
  if (RIVALRY_GAMES.includes(meetings))
    addNews(history, {
      id: `news-rival-${input.opponentId ?? input.opponentName}-${meetings}`,
      kind: "rivalry",
      headline: `A rivalry with ${input.opponentName} is taking shape`,
      detail: `${meetings} games played against each other.`,
      ...stamp,
    });

  return recordRatedContact(
    trackYearActivity(
      save,
      {
        ...save,
        player: {
          ...player,
          rating: after,
          peakRating: peak,
          ratedGames,
          league,
          reputation: player.reputation + reputationGain,
        },
        history,
        training: {
          ...save.training,
          unanalyzedGames: save.training.unanalyzedGames + 1,
          scouting: scouted ? null : save.training.scouting,
        },
      },
      "rated",
      input.outcome,
    ),
    input.opponentId,
    input.outcome,
  );
}

export interface TournamentInput {
  tournamentId: string;
  name: string;
  level: TournamentRecord["level"];
  rank: number;
  fieldSize: number;
  points: number;
  prize?: number;
}

/** Records a finished tournament: result, win trophy, prize money and news. */
function recordTournamentBase(
  save: GameSave,
  input: TournamentInput,
): GameSave {
  if (
    save.history.tournaments.some((t) => t.tournamentId === input.tournamentId)
  )
    return save;
  save = archiveCompetition(save);
  const stamp: GameStamp = { ...save.world.date };
  const history: CareerHistory = {
    ...save.history,
    tournaments: [...save.history.tournaments],
    trophies: [...save.history.trophies],
    news: [...save.history.news],
    ledger: [...save.history.ledger],
  };
  history.tournaments.push({
    ...stamp,
    tournamentId: input.tournamentId,
    name: input.name,
    level: input.level,
    rank: input.rank,
    fieldSize: input.fieldSize,
    points: input.points,
  });
  let reputation = save.player.reputation;
  if (
    save.tournament?.eventId === input.tournamentId &&
    save.tournament.status === "finished"
  ) {
    const winner = standings(save.tournament)[0]?.player;
    if (winner)
      addNews(history, {
        id: `event-winner-${input.tournamentId}`,
        kind: "history",
        headline: `${winner.name} wins ${input.name}`,
        detail: `${winner.points} points from ${save.tournament.rounds} rounds. Field: ${input.fieldSize}.`,
        ...stamp,
      });
  }
  if (input.rank === 1 && !save.tournament?.withdrawn) {
    addTrophy(history, {
      id: `win-${input.tournamentId}-${stamp.year}`,
      category: "tournament",
      name: input.name,
      description: `Won the ${input.name} (${input.fieldSize} players).`,
      ...stamp,
    });
    addNews(history, {
      id: `news-win-${input.tournamentId}-${stamp.year}`,
      kind: "milestone",
      headline: `You won the ${input.name}`,
      ...stamp,
    });
    reputation += { local: 2, national: 5, international: 10, elite: 20 }[
      input.level
    ];
  }
  const prize = Math.max(0, Math.round(input.prize ?? 0));
  if (prize > 0) {
    const entry: LedgerEntry = {
      id: `prize-${input.tournamentId}-${stamp.year}`,
      kind: "prize",
      label: `Prize: ${input.name}`,
      amount: prize,
      ...stamp,
    };
    history.ledger.push(entry);
    history.ledger = cap(history.ledger, GAME_CONFIG.history.maxLedger);
  }
  return awardPlayerTitles(
    addTournamentNorms(
      trackYearActivity(
        save,
        {
          ...save,
          player: {
            ...save.player,
            money: save.player.money + prize,
            reputation,
          },
          history,
        },
        "tournament",
        undefined,
        save.tournament?.eventId === input.tournamentId &&
          save.tournament.withdrawn
          ? Infinity
          : input.rank,
      ),
    ),
  );
}

export function recordGame(save:GameSave,input:GameInput):GameSave { return awardAchievements(recordGameBase(save,input)); }
export function recordTournament(save:GameSave,input:TournamentInput):GameSave { return awardAchievements(recordTournamentBase(save,input)); }
