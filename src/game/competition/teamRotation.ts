import type { PlayStyle } from "@/types";

export const RESERVE_ROTATION = .02;

export function rotateTeamRoster<T extends { id: string; elo: number }>(
  starters: readonly T[], reserves: readonly T[], opponents: readonly T[],
  styleOf: (id: string) => PlayStyle | undefined,
): T[] {
  const lineup = [...starters];
  const fit = (candidate: T, opponent?: T) => {
    const style = styleOf(candidate.id), rival = opponent && styleOf(opponent.id);
    const counter = (style === "solid" && rival === "attacking")
      || (style === "attacking" && rival === "positional")
      || (style === "tactical" && rival === "defensive");
    return candidate.elo + (counter ? 45 : 0);
  };
  const choices = starters.flatMap((starter, board) => starter.id === "player" ? [] :
    reserves.map(reserve => ({ board, reserve, gain: fit(reserve, opponents[board]) - fit(starter, opponents[board]) })));
  const best = choices.sort((a, b) => b.gain - a.gain)[0];
  if (best) lineup[best.board] = best.reserve;
  return lineup;
}
