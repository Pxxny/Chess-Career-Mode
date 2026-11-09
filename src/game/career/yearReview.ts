import type { GameOutcome, GameSave } from "@/types";

interface RecordTotals {
  wins: number;
  draws: number;
  losses: number;
}
export interface AnnualProgress {
  year: number;
  coverage: "complete" | "retained";
  startRating: number;
  peakRating: number;
  startMoney: number;
  startReputation: number;
  startSkills: Record<string, number>;
  rated: RecordTotals;
  practice: RecordTotals;
  tournaments: number;
  esportsTournaments: number;
  esportsWins: number;
  esportsPodiums: number;
  tournamentWins: number;
  podiums: number;
  sessions: number;
}
export interface YearReview extends AnnualProgress {
  endRating: number;
  endMoney: number;
  endReputation: number;
  trophies: number;
  titles: string[];
  improvements: { stat: string; change: number }[];
}
export interface YearReviewState {
  current: AnnualProgress;
  reviews: YearReview[];
  unread: number[];
}
const emptyRecord = (): RecordTotals => ({ wins: 0, draws: 0, losses: 0 });
const stats = (save: GameSave) => ({
  ...save.player.skills,
  ...save.player.attributes,
});
function fromHistory(save: GameSave, fresh = false): AnnualProgress {
  const year = save.world.date.year;
  const games = save.history.games.filter((g) => g.year === year);
  const tournaments = save.history.tournaments.filter((t) => t.year === year);
  const esports =
    save.esports?.history.filter(
      (t) => Math.floor(t.event.day / 364) === year,
    ) ?? [];
  const rated = emptyRecord(),
    practice = emptyRecord();
  for (const g of games)
    rated[
      g.outcome === "win" ? "wins" : g.outcome === "draw" ? "draws" : "losses"
    ]++;
  for (const g of save.practice.games.filter((g) => g.year === year))
    practice[
      g.outcome === "win" ? "wins" : g.outcome === "draw" ? "draws" : "losses"
    ]++;
  const startRating = games[0]?.ratingBefore ?? save.player.rating;
  return {
    year,
    coverage: fresh ? "complete" : "retained",
    startRating,
    peakRating: Math.max(
      startRating,
      save.player.rating,
      ...games.map((g) => g.ratingAfter),
    ),
    startMoney: save.player.money,
    startReputation: save.player.reputation,
    startSkills: stats(save),
    rated,
    practice,
    tournaments: tournaments.length,
    esportsTournaments: esports.length,
    esportsWins: esports.filter((t) => t.rank === 1 && !t.withdrawn).length,
    esportsPodiums: esports.filter(
      (t) => t.rank !== null && t.rank <= 3 && !t.withdrawn,
    ).length,
    tournamentWins: tournaments.filter((t) => t.rank === 1).length,
    podiums: tournaments.filter((t) => t.rank <= 3).length,
    sessions: save.history.sessions.filter((s) => s.year === year).length,
  };
}
export function yearReviewOf(save: GameSave): YearReviewState {
  if (save.yearReview?.current.year === save.world.date.year)
    return save.yearReview;
  return {
    current: fromHistory(save),
    reviews: save.yearReview?.reviews ?? [],
    unread: save.yearReview?.unread ?? [],
  };
}
export function startYearReview(save: GameSave): GameSave {
  return {
    ...save,
    yearReview: { current: fromHistory(save, true), reviews: [], unread: [] },
  };
}
export function trackYearActivity(
  before: GameSave,
  after: GameSave,
  kind: "rated" | "practice" | "tournament" | "esports" | "session",
  outcome?: GameOutcome,
  rank?: number,
): GameSave {
  const state = yearReviewOf(before);
  const current = {
    ...state.current,
    peakRating: Math.max(state.current.peakRating, after.player.rating),
  };
  if (kind === "rated" || kind === "practice") {
    current[kind] = { ...current[kind] };
    current[kind][
      outcome === "win" ? "wins" : outcome === "draw" ? "draws" : "losses"
    ]++;
  } else if (kind === "session") current.sessions++;
  else if (kind === "esports") {
    current.esportsTournaments++;
    current.esportsWins += Number(rank === 1);
    current.esportsPodiums += Number((rank ?? Infinity) <= 3);
  } else {
    current.tournaments++;
    current.tournamentWins += Number(rank === 1);
    current.podiums += Number((rank ?? Infinity) <= 3);
  }
  return { ...after, yearReview: { ...state, current } };
}
/** Freeze the closing year before any new-year salary, world competition or training is applied. */
export function advanceYearReview(before: GameSave, after: GameSave): GameSave {
  const state = yearReviewOf(before);
  if (after.world.date.year === before.world.date.year)
    return { ...after, yearReview: state };
  const p = state.current;
  const finalStats = stats(before);
  const review: YearReview = {
    ...p,
    endRating: before.player.rating,
    endMoney: before.player.money,
    endReputation: before.player.reputation,
    peakRating: Math.max(p.peakRating, before.player.rating),
    trophies: before.history.trophies.filter((t) => t.year === p.year).length,
    titles: before.history.titles
      .filter((t) => t.year === p.year)
      .map((t) => t.title),
    improvements: Object.entries(finalStats)
      .map(([stat, value]) => ({
        stat,
        change: value - (p.startSkills[stat] ?? value),
      }))
      .filter((s) => s.change !== 0)
      .sort((a, b) => b.change - a.change),
  };
  const reviews = [
    ...state.reviews.filter((r) => r.year !== p.year),
    review,
  ].slice(-60);
  return {
    ...after,
    yearReview: {
      current: fromHistory(after, true),
      reviews,
      unread: [...new Set([...state.unread, p.year])].filter((y) =>
        reviews.some((r) => r.year === y),
      ),
    },
  };
}
