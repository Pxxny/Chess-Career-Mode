import { GAME_CONFIG } from "@/data/config";
import { TITLE_LADDER, TITLE_LABELS, type EarnableTitle } from "@/data/titles";
import type { CareerHistory, GameSave, Player } from "@/types";
export interface TitleNorm {
  title: "IM" | "GM";
  eventId: string;
  event: string;
  year: number;
  week: number;
  games: number;
  performance: number;
  countries: number;
  titledOpponents: number;
}
export const normCount = (history: CareerHistory, title: "IM" | "GM") =>
  (history.titleNorms ?? []).filter((n) => n.title === title).length;
export function canEarnTitle(
  p: Player,
  h: CareerHistory,
  title: EarnableTitle,
) {
  const step = TITLE_LADDER.find((s) => s.id === title)!;
  return (
    p.peakRating >= step.minElo &&
    (title === "CM"
      ? p.ratedGames >= 30
      : title === "FM"
        ? p.ratedGames >= 50
        : p.ratedGames >= 50 && normCount(h, title) >= 3)
  );
}
export function titleRequirement(title: EarnableTitle) {
  const min = TITLE_LADDER.find((s) => s.id === title)!.minElo;
  return title === "CM"
    ? `Peak Elo ${min} + 30 rated games`
    : title === "FM"
      ? `Peak Elo ${min} + 50 rated games`
      : `Peak Elo ${min} + 50 rated games + 3 ${title} norms`;
}
/** Simplified career norms, deliberately stricter than an Elo-only award; not FIDE certification. */
export function addTournamentNorms(save: GameSave): GameSave {
  const t = save.tournament;
  if (
    !t ||
    t.status !== "finished" ||
    t.withdrawn ||
    t.timeControl.category !== "classical"
  )
    return save;
  const me = t.players.find((p) => p.isPlayer);
  if (!me) return save;
  const games = t.pairings
    .flatMap((round) =>
      round
        .filter(
          (p) => p.result !== null && (p.white === me.id || p.black === me.id),
        )
        .map((p) => ({
          opponent: t.players.find(
            (n) => n.id === (p.white === me.id ? p.black : p.white),
          ),
          score: p.white === me.id ? p.result! : 1 - p.result!,
        })),
    )
    .filter((g) => g.opponent && !g.opponent.isPlayer);
  const opponents = games.map((g) => g.opponent!),
    countries = new Set(opponents.map((n) => n.countryCode).filter(Boolean));
  if (
    games.length < 9 ||
    new Set(opponents.map((n) => n.id)).size < 5 ||
    countries.size < 3
  )
    return save;
  const average = opponents.reduce((s, n) => s + n.elo, 0) / games.length;
  const score = Math.max(
    0.01,
    Math.min(0.99, games.reduce((s, g) => s + g.score, 0) / games.length),
  );
  const performance = Math.round(
    average + 400 * Math.log10(score / (1 - score)),
  );
  const norms = [...(save.history.titleNorms ?? [])];
  for (const title of ["IM", "GM"] as const) {
    const titled = [
      ...new Map(opponents.map((n) => [n.id, n])).values(),
    ].filter((n) =>
      title === "GM" ? n.title === "GM" : ["FM", "IM", "GM"].includes(n.title),
    ).length;
    if (
      average < (title === "GM" ? 2400 : 2200) ||
      performance < (title === "GM" ? 2600 : 2450) ||
      titled < 3 ||
      norms.some((n) => n.eventId === t.eventId && n.title === title)
    )
      continue;
    norms.push({
      title,
      eventId: t.eventId,
      event: t.name,
      year: save.world.date.year,
      week: save.world.date.week,
      games: games.length,
      performance,
      countries: countries.size,
      titledOpponents: titled,
    });
  }
  return { ...save, history: { ...save.history, titleNorms: norms } };
}
export function awardPlayerTitles(save: GameSave): GameSave {
  const history = {
    ...save.history,
    titles: [...save.history.titles],
    trophies: [...save.history.trophies],
    news: [...save.history.news],
  };
  for (const step of TITLE_LADDER) {
    if (
      history.titles.some((t) => t.title === step.id) ||
      !canEarnTitle(save.player, history, step.id)
    )
      continue;
    history.titles.push({ ...save.world.date, title: step.id });
    history.trophies.push({
      ...save.world.date,
      id: `title-${step.id}`,
      category: "title",
      name: TITLE_LABELS[step.id],
      description: titleRequirement(step.id),
    });
    history.news.push({
      ...save.world.date,
      id: `news-title-${step.id}`,
      kind: "title",
      headline: `You are now a ${TITLE_LABELS[step.id]}`,
      detail: titleRequirement(step.id),
    });
  }
  return {
    ...save,
    history: {
      ...history,
      news: history.news.slice(-GAME_CONFIG.history.maxNews),
    },
  };
}
