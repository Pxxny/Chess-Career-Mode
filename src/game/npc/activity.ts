import {
  conditionsFor,
  npcActor,
  predictionStamp,
} from "@/game/prediction/adapters";
import {
  outcomeOf,
  predictMatch,
  sampleOutcome,
  scoreOf,
} from "@/game/prediction/model";
import { predictionOf } from "@/game/prediction/statistics";
import type { PredictionObservation } from "@/game/prediction/types";
import { createRng, mixSeed } from "@/game/rng";
import { hashString } from "@/utils/format";
import { applyNpcResult } from "./results";
import type { GameSave, Npc } from "@/types";

/** Extend the existing weekly circuit: rotating local fields plus regular elite competition. */
export function simulateWorldCircuit(save: GameSave, npcs: Npc[]) {
  const index = save.world.date.year * 52 + save.world.date.week;
  const busy = new Set(
    save.tournament?.status === "playing"
      ? save.tournament.players.map((p) => p.id)
      : [],
  );
  if (save.esports?.active?.status === "playing")
    save.esports.active.teams.forEach((t) =>
      t.members.forEach((m) => busy.add(m.id)),
    );
  for (const entry of save.registrations)
    if (
      entry.year === save.world.date.year &&
      entry.week === save.world.date.week
    )
      entry.entrantIds?.forEach((id) => busy.add(id));
  const active = npcs.filter(
    (n) =>
      !busy.has(n.id) &&
      (n.careerStatus === "active" || n.careerStatus === "semi-retired"),
  );
  const elite = [...active]
    .sort((a, b) => b.currentElo - a.currentElo || a.id.localeCompare(b.id))
    .slice(0, 16);
  const eliteIds = new Set(elite.map((n) => n.id));
  const selected = active
    .filter(
      (n) =>
        (index % 2 === 0 && eliteIds.has(n.id)) ||
        hashString(n.id) % 8 === index % 8,
    )
    .sort((a, b) => b.currentElo - a.currentElo || a.id.localeCompare(b.id));
  // Small worlds still get a genuine event; no singleton field is advertised as a tournament.
  const pool = active.length <= 16 ? active : selected;
  const fields: Npc[][] = [];
  for (let i = 0; i < pool.length; i += 8) fields.push(pool.slice(i, i + 8));
  if (fields.length > 1 && fields.at(-1)!.length < 4)
    fields[fields.length - 2].push(...fields.pop()!);
  const changed: Npc[] = [],
    observations: PredictionObservation[] = [];
  const headlines: string[] = [];
  for (const [group, field] of fields.entries()) {
    if (field.length < 2) continue;
    const eventId = `world-circuit-${index}-${group}`;
    if (
      field.every((n) => n.tournamentHistory.some((h) => h.eventId === eventId))
    )
      continue;
    const name = `${group === 0 ? "World Masters" : "World Circuit Open"} ${save.world.date.year}/${save.world.date.week} · ${group + 1}`;
    const rng = createRng(
      mixSeed(
        save.world.seed ^ hashString(save.career.id),
        index * 1024 + group,
      ),
    );
    const byId = new Map(field.map((n) => [n.id, n]));
    const scores = new Map(
      field.map((n) => [
        n.id,
        { points: 0, games: 0, wins: 0, draws: 0, losses: 0 },
      ]),
    );
    const seats: (string | null)[] = rng.shuffle(field).map((n) => n.id);
    if (seats.length % 2) seats.push(null);
    const rounds = Math.min(3, seats.length - 1);
    for (let round = 0; round < rounds; round++) {
      for (let j = 0; j < seats.length / 2; j++) {
        const aId = seats[j],
          bId = seats[seats.length - 1 - j];
        if (!aId || !bId) {
          const bye = scores.get((aId ?? bId)!);
          if (bye) bye.points++;
          continue;
        }
        const [wId, bkId] = (round + j) % 2 ? [bId, aId] : [aId, bId];
        const white = byId.get(wId)!,
          black = byId.get(bkId)!;
        const prediction = predictMatch({
          id: `${eventId}:${round}:${j}`,
          stamp: predictionStamp(save),
          player: npcActor(white),
          opponent: npcActor(black),
          conditions: {
            ...conditionsFor("rapid", "white", "world-circuit"),
            tournamentName: name,
            importance: 0.5,
            pressure: 0.3,
          },
          state: predictionOf(save),
        });
        const result = sampleOutcome(prediction.adjusted, rng.next()),
          score = scoreOf(result);
        observations.push({
          prediction,
          result,
          scope: "npc",
          source: "abstract",
          eligible: true,
        });
        for (const [id, s] of [
          [wId, score],
          [bkId, 1 - score],
        ] as const) {
          const totals = scores.get(id)!;
          totals.points += s;
          totals.games++;
          totals.wins += Number(s === 1);
          totals.draws += Number(s === 0.5);
          totals.losses += Number(s === 0);
        }
        byId.set(wId, applyNpcResult(white, result, black.currentElo));
        byId.set(
          bkId,
          applyNpcResult(black, outcomeOf(1 - score), white.currentElo),
        );
      }
      seats.splice(1, 0, seats.pop()!);
    }
    const ranked = [...field].sort(
      (a, b) =>
        scores.get(b.id)!.points - scores.get(a.id)!.points ||
        b.currentElo - a.currentElo ||
        a.id.localeCompare(b.id),
    );
    for (const [rank, npc] of ranked.entries()) {
      const updated = byId.get(npc.id)!;
      changed.push({
        ...updated,
        tournamentHistory: [
          ...updated.tournamentHistory,
          {
            eventId,
            year: save.world.date.year,
            week: save.world.date.week,
            event: name,
            source: "world-circuit" as const,
            rank: rank + 1,
            fieldSize: field.length,
            rounds,
            ...scores.get(npc.id)!,
            ratingBefore: npc.currentElo,
            ratingAfter: updated.currentElo,
          },
        ].slice(-120),
      });
    }
    if (headlines.length < 3)
      headlines.push(
        `${ranked[0].name} wins ${name} (${scores.get(ranked[0].id)!.points}/${rounds}).`,
      );
  }
  return {
    changed,
    observations,
    headlines,
    events: fields.filter((f) => f.length >= 2).length,
  };
}
