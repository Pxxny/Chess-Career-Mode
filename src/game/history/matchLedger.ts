import type { ArchivedEvent } from "@/game/competition/archive";
import type { MatchRecord } from "@/types";

/** Full replay stores real moves. Result-only games were scored without a board. */
export type MatchKind = "full-replay" | "result-only";

/**
 * One side of a match, small enough to index.
 * The row is a reference plus the fields a list can filter on.
 * It never stores SAN, UCI, PGN, ECO or an opening name.
 */
export interface MatchIndexRow {
  key: string;
  careerId: string;
  matchId: string;
  eventId: string;
  eventName: string;
  year: number;
  /** Event start day. Round-level dates are not recorded. */
  day: number;
  round: number;
  npcId: string;
  opponentId: string;
  opponentName: string;
  color: "white" | "black";
  /** Score for `npcId`: 1, 0.5 or 0. */
  score: number;
  timeControl: string;
  kind: MatchKind;
  replay: boolean;
  /** MatchRecord id when this row can open the stored game. */
  replayMatchId?: string;
  eloBefore?: number;
  eloAfter?: number;
}

export interface OpeningLine {
  eco: string;
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  whiteGames: number;
  whiteScore: number;
  blackGames: number;
  blackScore: number;
}

const finite = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Stable id from the event, round and the two seats. No RNG and no list position. */
export function boardMatchId(
  eventId: string,
  round: number,
  whiteId: string,
  blackId: string,
  occurrence = 0,
): string {
  const base = `board:${eventId}:${round}:${whiteId}:${blackId}`;
  return occurrence > 0 ? `${base}#${occurrence}` : base;
}

export function matchIndexKey(
  careerId: string,
  matchId: string,
  npcId: string,
): string {
  return `${careerId}|${matchId}|${npcId}`;
}

function namesOf(event: ArchivedEvent): Map<string, string> {
  const names = new Map<string, string>();
  for (const player of event.players) {
    names.set(player.id, player.name);
    for (const member of player.members ?? []) names.set(member.id, member.name);
  }
  return names;
}

function sideRow(
  input: Omit<MatchIndexRow, "key" | "replay"> & { replay: boolean },
): MatchIndexRow {
  const row: MatchIndexRow = {
    ...input,
    key: matchIndexKey(input.careerId, input.matchId, input.npcId),
  };
  if (!row.replay) delete row.replayMatchId;
  if (!finite(row.eloBefore)) delete row.eloBefore;
  if (!finite(row.eloAfter)) delete row.eloAfter;
  return row;
}

/** Index rows for every played board on an archived event. Byes and unplayed boards are skipped. */
export function indexRowsFromEvent(
  careerId: string,
  event: ArchivedEvent,
): MatchIndexRow[] {
  const names = namesOf(event);
  const rows: MatchIndexRow[] = [];
  const seen = new Map<string, number>();
  const push = (
    round: number,
    whiteId: string,
    blackId: string,
    whiteScore: number | null,
    elo?: {
      whiteEloBefore?: number;
      whiteEloAfter?: number;
      blackEloBefore?: number;
      blackEloAfter?: number;
    },
  ) => {
    if (!whiteId || !blackId || blackId === "bye" || whiteScore === null) return;
    const seat = `${round}|${whiteId}|${blackId}`;
    const occurrence = seen.get(seat) ?? 0;
    seen.set(seat, occurrence + 1);
    const matchId = boardMatchId(event.id, round, whiteId, blackId, occurrence);
    const whiteName = names.get(whiteId) ?? whiteId;
    const blackName = names.get(blackId) ?? blackId;
    const shared = {
      careerId,
      matchId,
      eventId: event.id,
      eventName: event.name,
      year: event.year,
      day: event.startDay,
      round,
      timeControl: event.timeControl,
      kind: "result-only" as const,
      replay: false,
    };
    rows.push(
      sideRow({
        ...shared,
        npcId: whiteId,
        opponentId: blackId,
        opponentName: blackName,
        color: "white",
        score: whiteScore,
        eloBefore: elo?.whiteEloBefore,
        eloAfter: elo?.whiteEloAfter,
      }),
      sideRow({
        ...shared,
        npcId: blackId,
        opponentId: whiteId,
        opponentName: whiteName,
        color: "black",
        score: 1 - whiteScore,
        eloBefore: elo?.blackEloBefore,
        eloAfter: elo?.blackEloAfter,
      }),
    );
  };
  const played = event.pairings.some((round) =>
    round.some((board) => board.black !== "bye" && board.result !== null),
  );
  if (played) {
    event.pairings.forEach((round, index) => {
      for (const board of round)
        push(index + 1, board.white, board.black, board.result, board);
    });
  } else {
    for (const board of event.teamBoards ?? []) {
      if (board.forfeit || !board.whiteId || !board.blackId) continue;
      push(board.round, board.whiteId, board.blackId, board.score, board);
    }
  }
  return rows;
}

const sideId = (side: { id: string | null; isPlayer: boolean }): string =>
  side.id ?? (side.isPlayer ? "player" : "");

/** Player games keep their existing match id. Moves stay on the MatchRecord, not on the index. */
export function indexRowsFromMatch(
  careerId: string,
  match: MatchRecord,
): MatchIndexRow[] {
  const whiteId = sideId(match.setup.white);
  const blackId = sideId(match.setup.black);
  if (!whiteId || !blackId) return [];
  const replay =
    match.moves.length > 0 || (match.recording?.ucis.length ?? 0) > 0;
  const whiteScore =
    match.result === "draw" ? 0.5 : match.result === "white" ? 1 : 0;
  const eventId =
    match.setup.tournament?.id ?? match.setup.esports?.eventId ?? "practice";
  const shared = {
    careerId,
    matchId: match.id,
    eventId,
    eventName:
      match.setup.tournament?.name ??
      (match.setup.social ? "Friendly" : "Match"),
    year: match.year,
    day: match.day ?? (match.year * 52 + match.week - 1) * 7,
    round: match.setup.tournament?.round ?? match.setup.esports?.round ?? 0,
    timeControl: match.setup.timeControl.label,
    kind: replay ? ("full-replay" as const) : ("result-only" as const),
    replay,
    replayMatchId: replay ? match.id : undefined,
  };
  const playerIsWhite = match.setup.playerColor === "white";
  return [
    sideRow({
      ...shared,
      npcId: whiteId,
      opponentId: blackId,
      opponentName: match.setup.black.name,
      color: "white",
      score: whiteScore,
      eloBefore: playerIsWhite
        ? (match.ratingBefore ?? undefined)
        : match.setup.white.elo,
      eloAfter: playerIsWhite ? (match.ratingAfter ?? undefined) : undefined,
    }),
    sideRow({
      ...shared,
      npcId: blackId,
      opponentId: whiteId,
      opponentName: match.setup.white.name,
      color: "black",
      score: 1 - whiteScore,
      eloBefore: playerIsWhite
        ? match.setup.black.elo
        : (match.ratingBefore ?? undefined),
      eloAfter: playerIsWhite ? undefined : (match.ratingAfter ?? undefined),
    }),
  ];
}

export function dedupeRows(rows: readonly MatchIndexRow[]): MatchIndexRow[] {
  const map = new Map<string, MatchIndexRow>();
  for (const row of rows) map.set(row.key, row);
  return [...map.values()];
}

export type HistoryOutcome = "win" | "draw" | "loss";

export const outcomeOfScore = (score: number): HistoryOutcome =>
  score === 1 ? "win" : score === 0.5 ? "draw" : "loss";

export interface HistoryFilter {
  query?: string;
  outcome?: HistoryOutcome | "all";
  timeControl?: string;
  eventId?: string;
  opponentId?: string;
  color?: "white" | "black" | "all";
  year?: number;
}

export function rowMatches(row: MatchIndexRow, filter: HistoryFilter): boolean {
  if (filter.outcome && filter.outcome !== "all" && outcomeOfScore(row.score) !== filter.outcome)
    return false;
  if (filter.timeControl && filter.timeControl !== "all" && row.timeControl !== filter.timeControl)
    return false;
  if (filter.eventId && row.eventId !== filter.eventId) return false;
  if (filter.opponentId && row.opponentId !== filter.opponentId) return false;
  if (filter.color && filter.color !== "all" && row.color !== filter.color) return false;
  if (filter.year !== undefined && row.year !== filter.year) return false;
  if (filter.query) {
    const hay = `${row.opponentName} ${row.eventName} ${row.timeControl} ${row.year}`.toLowerCase();
    if (!hay.includes(filter.query.trim().toLowerCase())) return false;
  }
  return true;
}

export function sortRows(rows: readonly MatchIndexRow[]): MatchIndexRow[] {
  return [...rows].sort(
    (a, b) =>
      a.day - b.day ||
      a.round - b.round ||
      a.matchId.localeCompare(b.matchId) ||
      a.npcId.localeCompare(b.npcId),
  );
}

export interface HistorySummary {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Wins only. Draws are not wins. */
  winRate: number | null;
  /** Wins plus half of draws. */
  scoreRate: number | null;
  byColor: Record<"white" | "black", { games: number; wins: number; draws: number; losses: number }>;
  byTime: Array<{ timeControl: string; games: number; wins: number; draws: number; losses: number }>;
  byYear: Array<{ year: number; games: number; wins: number; draws: number; losses: number }>;
  opponents: Array<{
    id: string;
    name: string;
    games: number;
    wins: number;
    draws: number;
    losses: number;
  }>;
  eloGames: number;
  eloMissing: number;
}

const emptyColor = () => ({ games: 0, wins: 0, draws: 0, losses: 0 });

export function summarizeRows(rows: readonly MatchIndexRow[]): HistorySummary {
  const summary: HistorySummary = {
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: null,
    scoreRate: null,
    byColor: { white: emptyColor(), black: emptyColor() },
    byTime: [],
    byYear: [],
    opponents: [],
    eloGames: 0,
    eloMissing: 0,
  };
  const times = new Map<string, HistorySummary["byTime"][number]>();
  const years = new Map<number, HistorySummary["byYear"][number]>();
  const opponents = new Map<string, HistorySummary["opponents"][number]>();
  for (const row of rows) {
    const outcome = outcomeOfScore(row.score);
    summary.games++;
    summary.wins += Number(outcome === "win");
    summary.draws += Number(outcome === "draw");
    summary.losses += Number(outcome === "loss");
    const color = summary.byColor[row.color];
    color.games++;
    color.wins += Number(outcome === "win");
    color.draws += Number(outcome === "draw");
    color.losses += Number(outcome === "loss");
    if (finite(row.eloBefore) && finite(row.eloAfter)) summary.eloGames++;
    else summary.eloMissing++;
    const time = times.get(row.timeControl) ?? {
      timeControl: row.timeControl,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    };
    time.games++;
    time.wins += Number(outcome === "win");
    time.draws += Number(outcome === "draw");
    time.losses += Number(outcome === "loss");
    times.set(row.timeControl, time);
    const year = years.get(row.year) ?? {
      year: row.year,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    };
    year.games++;
    year.wins += Number(outcome === "win");
    year.draws += Number(outcome === "draw");
    year.losses += Number(outcome === "loss");
    years.set(row.year, year);
    const opponent = opponents.get(row.opponentId) ?? {
      id: row.opponentId,
      name: row.opponentName,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    };
    opponent.games++;
    opponent.wins += Number(outcome === "win");
    opponent.draws += Number(outcome === "draw");
    opponent.losses += Number(outcome === "loss");
    opponents.set(row.opponentId, opponent);
  }
  if (summary.games) {
    summary.winRate = summary.wins / summary.games;
    summary.scoreRate = (summary.wins + summary.draws / 2) / summary.games;
  }
  summary.byTime = [...times.values()].sort((a, b) => b.games - a.games || a.timeControl.localeCompare(b.timeControl));
  summary.byYear = [...years.values()].sort((a, b) => a.year - b.year);
  summary.opponents = [...opponents.values()].sort(
    (a, b) => b.games - a.games || a.name.localeCompare(b.name),
  );
  return summary;
}

/** Opening totals from games that actually contain moves. Result-only rows cannot be passed here. */
export function openingAnalytics(
  matches: readonly MatchRecord[],
  perspective: "player" | string = "player",
): { lines: OpeningLine[]; replayGames: number } {
  const lines = new Map<string, OpeningLine>();
  let replayGames = 0;
  for (const match of matches) {
    const replayable =
      match.moves.length > 0 || (match.recording?.ucis.length ?? 0) > 0;
    if (!replayable) continue;
    replayGames++;
    if (!match.openingEco && !match.openingName) continue;
    const eco = match.openingEco ?? "—";
    const name = match.openingName ?? "Unnamed opening";
    const key = `${eco}|${name}`;
    const line = lines.get(key) ?? {
      eco,
      name,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      whiteGames: 0,
      whiteScore: 0,
      blackGames: 0,
      blackScore: 0,
    };
    const whiteScore = match.result === "draw" ? 0.5 : match.result === "white" ? 1 : 0;
    const asWhite =
      perspective === "player"
        ? match.setup.playerColor === "white"
        : sideId(match.setup.white) === perspective;
    const score = asWhite ? whiteScore : 1 - whiteScore;
    const outcome = outcomeOfScore(score);
    line.games++;
    line.wins += Number(outcome === "win");
    line.draws += Number(outcome === "draw");
    line.losses += Number(outcome === "loss");
    if (asWhite) {
      line.whiteGames++;
      line.whiteScore += score;
    } else {
      line.blackGames++;
      line.blackScore += score;
    }
    lines.set(key, line);
  }
  return {
    replayGames,
    lines: [...lines.values()].sort(
      (a, b) => b.games - a.games || a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name),
    ),
  };
}

export function pageOf<T>(items: readonly T[], page: number, size: number): T[] {
  const start = Math.max(0, page) * size;
  return items.slice(start, start + size);
}
