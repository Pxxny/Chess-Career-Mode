import { circuitAllocation } from "@/game/competition/rollDown";
import { standings } from "@/game/match/tournament";
import { esportsStandings } from "@/game/esports/core";
import { applyNpcResult } from "./results";
import type { ActiveTournament, GameSave, Npc } from "@/types";

/** Reconcile finished, retained events as well as newly finished events. Safe to repeat after reload. */
export function reconcileTournamentHistory(save: GameSave, npcs: Npc[]): Npc[] {
  const events = new Map<string, ActiveTournament>();
  for (const t of [
    ...(save.competition?.archive ?? []),
    ...(save.tournament ? [save.tournament] : []),
  ])
    if (t.status === "finished") events.set(t.eventId, t);
  const byId = new Map(npcs.map((n) => [n.id, n]));
  const changed = new Map<string, Npc>();
  for (const t of events.values()) {
    const fresh = new Set(
      t.players
        .filter(
          (p) =>
            !p.isPlayer &&
            byId.has(p.id) &&
            !byId.get(p.id)!.recordedPlayerEvents?.includes(t.eventId) &&
            !byId
              .get(p.id)!
              .tournamentHistory.some((h) => h.eventId === t.eventId),
        )
        .map((p) => p.id),
    );
    if (!fresh.size) continue;
    const totals = new Map(
      [...fresh].map((id) => [id, { games: 0, wins: 0, draws: 0, losses: 0 }]),
    );
    const before = new Map(
      [...fresh].map((id) => [id, byId.get(id)!.currentElo]),
    );
    for (const round of t.pairings)
      for (const board of round) {
        if (
          board.result === null ||
          board.white === "bye" ||
          board.black === "bye"
        )
          continue;
        const white = byId.get(board.white),
          black = byId.get(board.black);
        for (const [id, score] of [
          [board.white, board.result],
          [board.black, 1 - board.result],
        ] as const) {
          const s = totals.get(id);
          if (s) {
            s.games++;
            s.wins += Number(score === 1);
            s.draws += Number(score === 0.5);
            s.losses += Number(score === 0);
          }
        }
        // Human-vs-NPC boards already update the opponent when each match finishes.
        // Archived legacy events receive their missing history without invented retroactive ratings.
        if (save.tournament?.eventId !== t.eventId || !white || !black)
          continue;
        if (fresh.has(white.id))
          byId.set(
            white.id,
            applyNpcResult(
              white,
              board.result === 1
                ? "win"
                : board.result === 0.5
                  ? "draw"
                  : "loss",
              black.currentElo,
            ),
          );
        if (fresh.has(black.id))
          byId.set(
            black.id,
            applyNpcResult(
              black,
              board.result === 0
                ? "win"
                : board.result === 0.5
                  ? "draw"
                  : "loss",
              white.currentElo,
            ),
          );
      }
    for (const [i, row] of standings(t).entries()) {
      const p = row.player;
      if (!fresh.has(p.id)) continue;
      const npc = byId.get(p.id)!;
      const allocated = circuitAllocation({ ...save, competition: { ...save.competition!, circuitAwards: {} , archive: (save.competition?.archive??[]).filter(old=>old.eventId!==t.eventId) } },t);
      const result = {
        ...(t.details?.qualificationCircuit ? {qualificationEvaluated:true, qualificationTarget: (save.competition?.circuitAwards?.[t.details.qualificationCircuit.targetEventId??""]??allocated.awards).includes(p.id) ? t.details.qualificationCircuit.targetEventId : undefined} : {}),
        eventId: t.eventId,
        year: t.year,
        week: t.week,
        event: t.name,
        source: "career" as const,
        rank: i + 1,
        fieldSize: t.players.length,
        points: p.points,
        rounds: t.rounds,
        ...totals.get(p.id)!,
        ratingBefore: before.get(p.id),
        ratingAfter: npc.currentElo,
      };
      const next: Npc = {
        ...npc,
        tournamentHistory: [...npc.tournamentHistory, result].slice(-120),
        recordedPlayerEvents: [
          ...(npc.recordedPlayerEvents ?? []),
          t.eventId,
        ].slice(-256),
      };
      byId.set(p.id, next);
      changed.set(p.id, next);
    }
  }
  const esports = new Map(
    (save.esports?.history ?? []).map((c) => [c.event.id, c]),
  );
  if (save.esports?.active?.status === "finished")
    esports.set(save.esports.active.event.id, save.esports.active);
  for (const c of esports.values()) {
    if (c.status !== "finished") continue;
    const eventId = `esports:${c.event.id}`;
    const members = c.teams.flatMap((team) => team.members);
    const fresh = new Set(
      members
        .filter(
          (m) =>
            byId.has(m.id) &&
            !byId.get(m.id)!.recordedPlayerEvents?.includes(eventId) &&
            !byId
              .get(m.id)!
              .tournamentHistory.some((h) => h.eventId === eventId),
        )
        .map((m) => m.id),
    );
    const scores = new Map(
      [...fresh].map((id) => [
        id,
        { games: 0, wins: 0, draws: 0, losses: 0, points: 0 },
      ]),
    );
    const before = new Map(
      [...fresh].map((id) => [id, byId.get(id)!.currentElo]),
    );
    for (const round of c.rounds)
      for (const f of round)
        for (const b of f.boards) {
          if (b.result === null) continue;
          const white = byId.get(b.white.id),
            black = byId.get(b.black.id);
          for (const [id, s] of [
            [b.white.id, b.result],
            [b.black.id, 1 - b.result],
          ] as const) {
            const score = scores.get(id);
            if (score) {
              score.games++;
              score.points += s;
              score.wins += Number(s === 1);
              score.draws += Number(s === 0.5);
              score.losses += Number(s === 0);
            }
          }
          if (save.esports?.active?.event.id !== c.event.id || !white || !black)
            continue;
          if (fresh.has(white.id))
            byId.set(
              white.id,
              applyNpcResult(
                white,
                b.result === 1 ? "win" : b.result === 0.5 ? "draw" : "loss",
                black.currentElo,
              ),
            );
          if (fresh.has(black.id))
            byId.set(
              black.id,
              applyNpcResult(
                black,
                b.result === 0 ? "win" : b.result === 0.5 ? "draw" : "loss",
                white.currentElo,
              ),
            );
        }
    for (const [rank, row] of esportsStandings(c).entries())
      for (const m of row.team.members) {
        if (!fresh.has(m.id)) continue;
        const npc = byId.get(m.id)!;
        const next: Npc = {
          ...npc,
          tournamentHistory: [
            ...npc.tournamentHistory,
            {
              eventId,
              year: Math.floor(c.event.day / 364),
              week: Math.floor((c.event.day % 364) / 7) + 1,
              event: `${c.event.name} · ${row.team.name}`,
              source: "esports" as const,
              rank: rank + 1,
              fieldSize: c.teams.length,
              rounds: c.rounds.length,
              ...scores.get(m.id)!,
              ratingBefore: before.get(m.id),
              ratingAfter: npc.currentElo,
            },
          ].slice(-120),
          recordedPlayerEvents: [
            ...(npc.recordedPlayerEvents ?? []),
            eventId,
          ].slice(-256),
        };
        byId.set(m.id, next);
        changed.set(m.id, next);
      }
  }
  return [...changed.values()];
}
