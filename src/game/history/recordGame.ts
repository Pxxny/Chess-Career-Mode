import { tierForElo, getTier } from '@/data/chess/tiers';
import { GAME_CONFIG } from '@/data/config';
import { TITLE_LADDER } from '@/data/titles';
import type { CareerHistory, GameOutcome, GameResult, GameSave, GameStamp, LedgerEntry, NewsItem, PieceColor, TournamentRecord, Trophy } from '@/types';
import { ratingChange } from './elo';


export interface GameInput {
  opponentId: string | null;
  opponentName: string;
  opponentElo: number;
  outcome: GameOutcome;
  color: PieceColor;
  tournamentId?: string | null;
  tournamentName?: string | null;
  accuracy: number;
  opening?: string | null;
  /** World ranks before/after, supplied by the caller that owns the NPC database */
  worldRankBefore?: number;
  worldRankAfter?: number;
}

const ELO_MILESTONE_STEP = 100;
const RIVALRY_GAMES = [3, 5, 10];
const cap = <T>(items: T[], max: number): T[] => (items.length > max ? items.slice(items.length - max) : items);

function addTrophy(history: CareerHistory, trophy: Trophy): void {
  if (!history.trophies.some((t) => t.id === trophy.id)) history.trophies.push(trophy);
}
function addNews(history: CareerHistory, item: NewsItem): void {
  if (!history.news.some((n) => n.id === item.id)) history.news.push(item);
  history.news = cap(history.news, GAME_CONFIG.history.maxNews);
}

/**
 * Records one rated game and applies every consequence: rating, peak, league, titles,
 * Elo milestones, achievements, rivalries and news. Pure: returns a new save.
 * The match engine calls this (through the store) when a game ends.
 */
export function recordGame(save: GameSave, input: GameInput): GameSave {
  const { player, world } = save;
  const stamp: GameStamp = { ...world.date };
  const history: CareerHistory = { ...save.history, games: [...save.history.games], trophies: [...save.history.trophies], news: [...save.history.news], titles: [...save.history.titles], ratingHistory: [...save.history.ratingHistory] };

  const before = player.rating;
  const delta = ratingChange(before, input.opponentElo, input.outcome, player.ratedGames);
  const after = Math.max(100, before + delta);
  const accuracy = Math.min(100, Math.max(0, Math.round(input.accuracy)));
  const game: GameResult = {
    id: `g${history.games.length + 1}-${stamp.year}-${stamp.week}`,
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
    opening: input.opening ?? null,
  };
  history.games.push(game);
  history.games = cap(history.games, GAME_CONFIG.history.maxGames);
  history.ratingHistory.push({ ...stamp, elo: after });

  const peak = Math.max(player.peakRating, after);
  const ratedGames = player.ratedGames + 1;
  const reputationGain = input.outcome === 'win' ? Math.max(1, Math.round(input.opponentElo / 1000)) : 0;
  const league = tierForElo(after);

  // Titles follow peak Elo and are kept for life.
  for (const step of TITLE_LADDER) {
    if (peak >= step.minElo && !history.titles.some((t) => t.title === step.id)) {
      history.titles.push({ ...stamp, title: step.id });
      addTrophy(history, { id: `title-${step.id}`, category: 'title', name: step.label, description: `Reached ${step.minElo} Elo and earned the ${step.label} title.`, ...stamp });
      addNews(history, { id: `news-title-${step.id}`, kind: 'title', headline: `You are now a ${step.label}`, detail: `Peak Elo ${peak}.`, ...stamp });
    }
  }

  // Elo milestones.
  for (let m = Math.ceil((player.peakRating + 1) / ELO_MILESTONE_STEP) * ELO_MILESTONE_STEP; m <= peak; m += ELO_MILESTONE_STEP) {
    addTrophy(history, { id: `elo-${m}`, category: 'elo', name: `${m} Elo`, description: `Reached a rating of ${m}.`, ...stamp });
    addNews(history, { id: `news-elo-${m}`, kind: 'milestone', headline: `Rating milestone: ${m}`, ...stamp });
  }

  // League promotion.
  if (league !== player.league && after > before) {
    const name = getTier(league).leagueName;
    addTrophy(history, { id: `league-${league}`, category: 'league', name: `Promoted to the ${name}`, description: `Your rating of ${after} lifted you into the ${name}.`, ...stamp });
    addNews(history, { id: `news-league-${league}`, kind: 'promotion', headline: `Promoted to the ${name}`, ...stamp });
  }

  // Ranking improvement.
  if (input.worldRankBefore !== undefined && input.worldRankAfter !== undefined && input.worldRankAfter < input.worldRankBefore) {
    addNews(history, { id: `news-rank-${history.games.length}`, kind: 'ranking', headline: `World ranking improved to #${input.worldRankAfter}`, detail: `Up ${input.worldRankBefore - input.worldRankAfter} places.`, ...stamp });
  }

  // Special achievements.
  if (history.games.length === 1) addTrophy(history, { id: 'first-game', category: 'special', name: 'Debut', description: 'Played your first rated game.', ...stamp });
  if (input.outcome === 'win' && !history.games.slice(0, -1).some((g) => g.outcome === 'win')) addTrophy(history, { id: 'first-win', category: 'special', name: 'First victory', description: `Beat ${input.opponentName}.`, ...stamp });
  if (input.outcome === 'win' && input.opponentElo - before >= 200) addTrophy(history, { id: `giant-${history.games.length}`, category: 'special', name: 'Giant killer', description: `Beat ${input.opponentName} (${input.opponentElo}), 200 or more points above you.`, ...stamp });
  const streak = (() => { let n = 0; for (let i = history.games.length - 1; i >= 0 && history.games[i].outcome === 'win'; i--) n++; return n; })();
  if (input.outcome === 'win' && streak === 10) addTrophy(history, { id: 'streak-10', category: 'special', name: 'Ten in a row', description: 'Won ten rated games in a row.', ...stamp });
  if (ratedGames === 100) addTrophy(history, { id: 'games-100', category: 'special', name: 'Centurion', description: 'Played 100 rated games.', ...stamp });

  // Rivalries: repeated meetings with the same opponent.
  const meetings = history.games.filter((g) => (input.opponentId ? g.opponentId === input.opponentId : g.opponentName === input.opponentName)).length;
  if (RIVALRY_GAMES.includes(meetings)) addNews(history, { id: `news-rival-${input.opponentId ?? input.opponentName}-${meetings}`, kind: 'rivalry', headline: `A rivalry with ${input.opponentName} is taking shape`, detail: `${meetings} games played against each other.`, ...stamp });

  return {
    ...save,
    player: { ...player, rating: after, peakRating: peak, ratedGames, league, reputation: player.reputation + reputationGain },
    history,
  };
}

export interface TournamentInput {
  tournamentId: string;
  name: string;
  level: TournamentRecord['level'];
  rank: number;
  fieldSize: number;
  points: number;
  prize?: number;
}

/** Records a finished tournament: result, win trophy, prize money and news. */
export function recordTournament(save: GameSave, input: TournamentInput): GameSave {
  const stamp: GameStamp = { ...save.world.date };
  const history: CareerHistory = { ...save.history, tournaments: [...save.history.tournaments], trophies: [...save.history.trophies], news: [...save.history.news], ledger: [...save.history.ledger] };
  history.tournaments.push({ ...stamp, tournamentId: input.tournamentId, name: input.name, level: input.level, rank: input.rank, fieldSize: input.fieldSize, points: input.points });
  let reputation = save.player.reputation;
  if (input.rank === 1) {
    addTrophy(history, { id: `win-${input.tournamentId}-${stamp.year}`, category: 'tournament', name: input.name, description: `Won the ${input.name} (${input.fieldSize} players).`, ...stamp });
    addNews(history, { id: `news-win-${input.tournamentId}-${stamp.year}`, kind: 'milestone', headline: `You won the ${input.name}`, ...stamp });
    reputation += { local: 2, national: 5, international: 10, elite: 20 }[input.level];
  }
  const prize = Math.max(0, Math.round(input.prize ?? 0));
  if (prize > 0) {
    const entry: LedgerEntry = { id: `prize-${input.tournamentId}-${stamp.year}`, kind: 'prize', label: `Prize: ${input.name}`, amount: prize, ...stamp };
    history.ledger.push(entry);
    history.ledger = cap(history.ledger, GAME_CONFIG.history.maxLedger);
  }
  return { ...save, player: { ...save.player, money: save.player.money + prize, reputation }, history };
}

