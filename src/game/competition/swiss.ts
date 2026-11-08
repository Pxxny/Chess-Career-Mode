import type { TournamentPairing, TournamentPlayer } from "@/types";

/** Edmonds' blossom matching. Finds a maximum matching even when greedy pairing gets stuck. */
export function maximumMatching(graph: readonly number[][]): number[] {
  const n = graph.length,
    match = Array<number>(n).fill(-1);
  let parent: number[],
    base: number[],
    used: boolean[],
    blossom: boolean[],
    queue: number[];
  const lca = (a: number, b: number): number => {
    const seen = Array<boolean>(n).fill(false);
    while (true) {
      a = base[a];
      seen[a] = true;
      if (match[a] === -1) break;
      a = parent[match[a]];
    }
    while (true) {
      b = base[b];
      if (seen[b]) return b;
      b = parent[match[b]];
    }
  };
  const mark = (v: number, b: number, child: number): void => {
    while (base[v] !== b) {
      blossom[base[v]] = blossom[base[match[v]]] = true;
      parent[v] = child;
      child = match[v];
      v = parent[match[v]];
    }
  };
  const augment = (root: number): boolean => {
    used = Array<boolean>(n).fill(false);
    parent = Array<number>(n).fill(-1);
    base = Array.from({ length: n }, (_, i) => i);
    queue = [root];
    used[root] = true;
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      for (const u of graph[v]) {
        if (base[v] === base[u] || match[v] === u) continue;
        if (u === root || (match[u] !== -1 && parent[match[u]] !== -1)) {
          const b = lca(v, u);
          blossom = Array<boolean>(n).fill(false);
          mark(v, b, u);
          mark(u, b, v);
          for (let i = 0; i < n; i++)
            if (blossom[base[i]]) {
              base[i] = b;
              if (!used[i]) {
                used[i] = true;
                queue.push(i);
              }
            }
        } else if (parent[u] === -1) {
          parent[u] = v;
          if (match[u] === -1) {
            let x = u;
            while (x !== -1) {
              const p = parent[x],
                next = p === -1 ? -1 : match[p];
              match[x] = p;
              if (p !== -1) match[p] = x;
              x = next;
            }
            return true;
          }
          used[match[u]] = true;
          queue.push(match[u]);
        }
      }
    }
    return false;
  };
  for (let v = 0; v < n; v++) if (match[v] === -1) augment(v);
  return match;
}
const balance = (p: TournamentPlayer): number =>
  p.colors.reduce((s, c) => s + c, 0);
const colorPenalty = (p: TournamentPlayer, color: number): number => {
  const played = p.colors.filter((c) => c !== 0),
    last = played.slice(-2);
  return (
    Math.abs(balance(p) + color) * 3 +
    (last.length === 2 && last.every((c) => c === color) ? 20 : 0)
  );
};
function orientation(
  a: TournamentPlayer,
  b: TournamentPlayer,
  round: number,
): [TournamentPlayer, TournamentPlayer] {
  const ab = colorPenalty(a, 1) + colorPenalty(b, -1),
    ba = colorPenalty(a, -1) + colorPenalty(b, 1);
  return ab < ba ||
    (ab === ba && (round % 2 === 1 ? a.elo >= b.elo : a.elo < b.elo))
    ? [a, b]
    : [b, a];
}
const compatible = (
  a: TournamentPlayer,
  b: TournamentPlayer,
  round: number,
): boolean => {
  const [w, bk] = orientation(a, b, round);
  return (
    colorPenalty(w, 1) < 20 &&
    colorPenalty(bk, -1) < 20 &&
    Math.abs(balance(w) + 1) <= 2 &&
    Math.abs(balance(bk) - 1) <= 2
  );
};
/** Score-group matching, colour preferences, one bye per player where possible, rematches only if unavoidable.
 * This is a deterministic game Swiss implementation, not certified FIDE Dutch software. */
export function swissPairings(
  players: readonly TournamentPlayer[],
  round: number,
): TournamentPairing[] {
  const sorted = [...players].sort(
    (a, b) => b.points - a.points || b.elo - a.elo || a.id.localeCompare(b.id),
  );
  const byeCandidates =
    sorted.length % 2
      ? [...sorted]
          .reverse()
          .sort(
            (a, b) =>
              Number(a.opponents.includes("bye")) -
                Number(b.opponents.includes("bye")) ||
              a.points - b.points ||
              a.elo - b.elo,
          )
      : [null];
  // No rematches first, then avoid a second bye, then enforce colour preferences when feasible.
  for (const allowRepeats of [false, true])
    for (const repeatedBye of [false, true])
      for (const strictColors of [true, false])
        for (const bye of byeCandidates) {
          if (Boolean(bye?.opponents.includes("bye")) !== repeatedBye) continue;
          const pool = sorted.filter((p) => p !== bye),
            half = pool.length / 2;
          const graph = pool.map((a, i) =>
            pool
              .map((b, j) => j)
              .filter(
                (j) =>
                  j !== i &&
                  (allowRepeats ||
                    (!a.opponents.includes(pool[j].id) &&
                      !pool[j].opponents.includes(a.id))) &&
                  (!strictColors || compatible(a, pool[j], round)),
              )
              .sort((j, k) => {
                const cost = (x: number): number =>
                  Math.abs(a.points - pool[x].points) * 10000 +
                  (a.opponents.includes(pool[x].id) ? 1000000 : 0) +
                  (round === 1
                    ? Math.abs((i < half ? i + half : i - half) - x) * 100
                    : Math.abs(i - x) * 10) +
                  colorPenalty(orientation(a, pool[x], round)[0], 1) +
                  colorPenalty(orientation(a, pool[x], round)[1], -1);
                return cost(j) - cost(k) || j - k;
              }),
          );
          const matching = maximumMatching(graph);
          if (matching.some((m) => m < 0)) continue;
          const result: TournamentPairing[] = bye
            ? [{ white: bye.id, black: "bye", result: 1 }]
            : [];
          matching.forEach((j, i) => {
            if (j > i) {
              const [w, b] = orientation(pool[i], pool[j], round);
              result.push({ white: w.id, black: b.id, result: null });
            }
          });
          return result;
        }
  return [];
}
