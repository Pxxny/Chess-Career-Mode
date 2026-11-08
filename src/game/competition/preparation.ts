import { GAME_CONFIG } from "@/data/config";
import { dayIndex } from "@/game/career/expansion";
import { stampIndex } from "./catalog";
import type {
  CompetitionState,
  DecisionMode,
  EventRepertoire,
  GamePlan,
  Qualification,
} from "./types";
import type { GameSave, Npc, PlayStyle } from "@/types";
import type { OpeningDatabase } from "@/game/openings/database";
import type { MoveProfile } from "@/game/match/npcProfile";
export const APPROACHES: GamePlan["approach"][] = [
  "Rock Solid",
  "Careful",
  "Balanced",
  "Ambitious",
  "All Out Attacks",
];
export const DECISIONS: DecisionMode[] = [
  "Play Fast",
  "Normal",
  "Think Deeply",
];
export const emptyRepertoire = (): EventRepertoire => ({
  white: [],
  black: [],
  "vs-e4": [],
  "vs-d4": [],
  "vs-c4": [],
  "vs-nf3": [],
  backups: [],
});
export const emptyCompetition = (): CompetitionState => ({
  target: "",
  plan: { approach: "Balanced", decision: "Normal", earlyDraw: false },
  repertoire: emptyRepertoire(),
  prepared: null,
  scouts: [],
  qualifications: [],
  archive: [],
});
export const competitionOf = (save: GameSave): CompetitionState => ({
  ...emptyCompetition(),
  ...save.competition,
});
export const PREP_COST: Record<
  DecisionMode,
  { hours: number; ap: number; money: number; depth: number }
> = {
  "Play Fast": { hours: 1, ap: 1, money: 10, depth: 4 },
  Normal: { hours: 2, ap: 2, money: 20, depth: 8 },
  "Think Deeply": { hours: 3, ap: 3, money: 40, depth: 12 },
};
export function setCompetitionConfig(
  save: GameSave,
  patch: Partial<Pick<CompetitionState, "target" | "plan" | "repertoire">>,
): GameSave {
  const state = competitionOf(save);
  const plan = patch.plan ?? state.plan;
  if (
    !APPROACHES.includes(plan.approach) ||
    !DECISIONS.includes(plan.decision) ||
    typeof plan.earlyDraw !== "boolean"
  )
    return save;
  const rep = patch.repertoire ?? state.repertoire;
  if (
    Object.keys(emptyRepertoire()).some(
      (key) =>
        !Array.isArray(rep[key as keyof EventRepertoire]) ||
        rep[key as keyof EventRepertoire].length > 8 ||
        rep[key as keyof EventRepertoire].some((id) => typeof id !== "string"),
    )
  )
    return save;
  return {
    ...save,
    competition: {
      ...state,
      ...patch,
      plan: { ...plan },
      repertoire: Object.fromEntries(
        Object.entries(rep).map(([k, v]) => [k, [...new Set(v)]]),
      ) as unknown as EventRepertoire,
    },
  };
}
function availableEvent(save: GameSave, eventId: string): boolean {
  return !!(
    (save.tournament?.eventId === eventId &&
      save.tournament.status === "playing") ||
    save.registrations.some(
      (r) =>
        r.eventId === eventId && stampIndex(r) >= stampIndex(save.world.date),
    )
  );
}
type Result = { ok: true; save: GameSave } | { ok: false; error: string };
function charge(
  save: GameSave,
  hours: number,
  ap: number,
  money: number,
): Result {
  if (save.pendingMatch)
    return { ok: false, error: "Finish your running game first." };
  if (save.training.hoursUsedToday + hours > GAME_CONFIG.sessions.hoursPerDay)
    return { ok: false, error: "Not enough time today. End the day in Train." };
  if (save.player.ap.current < ap || save.player.money < money)
    return { ok: false, error: `Requires ${ap} AP and $${money}.` };
  return {
    ok: true,
    save: {
      ...save,
      player: {
        ...save.player,
        ap: { ...save.player.ap, current: save.player.ap.current - ap },
        money: save.player.money - money,
      },
      training: {
        ...save.training,
        hoursUsedToday: save.training.hoursUsedToday + hours,
        fatigue: Math.min(100, save.training.fatigue + hours * 2),
      },
    },
  };
}
export function prepareEvent(save: GameSave, db: OpeningDatabase): Result {
  const state = competitionOf(save);
  if (
    save.registrations.find((r) => r.eventId === state.target)?.details
      ?.format === "team"
  )
    return {
      ok: false,
      error:
        "Team events use a separate rating-based simulation; individual move preparation does not apply.",
    };
  if (!availableEvent(save, state.target))
    return {
      ok: false,
      error: "Choose a current or upcoming paid registration first.",
    };
  if (
    Object.values(state.repertoire)
      .flat()
      .some((id) => !db.byId.has(id))
  )
    return {
      ok: false,
      error: "An opening was removed. Choose a valid repertoire.",
    };
  if (
    state.prepared?.eventId === state.target &&
    state.prepared.stamp === dayIndex(save) &&
    JSON.stringify(state.prepared.plan) === JSON.stringify(state.plan) &&
    JSON.stringify(state.prepared.repertoire) ===
      JSON.stringify(state.repertoire)
  )
    return { ok: false, error: "This plan is already prepared today." };
  const cost = PREP_COST[state.plan.decision],
    paid = charge(save, cost.hours, cost.ap, cost.money);
  if (!paid.ok) return paid;
  return {
    ok: true,
    save: {
      ...paid.save,
      competition: {
        ...state,
        prepared: {
          eventId: state.target,
          stamp: dayIndex(save),
          plan: { ...state.plan },
          repertoire: structuredClone(state.repertoire),
          depth: cost.depth,
        },
      },
    },
  };
}
export function scoutOpponent(
  save: GameSave,
  npc: Npc,
  eventId: string,
): Result {
  if (!availableEvent(save, eventId))
    return { ok: false, error: "Register for this event before scouting." };
  const field =
    save.tournament?.eventId === eventId
      ? save.tournament.players.map((p) => p.id)
      : save.registrations.find((r) => r.eventId === eventId)?.entrantIds;
  if (!field?.includes(npc.id))
    return { ok: false, error: "This opponent is not in the announced field." };
  const state = competitionOf(save);
  if (state.scouts.some((s) => s.npcId === npc.id && s.eventId === eventId))
    return {
      ok: false,
      error: "You already have a scouting report for this event.",
    };
  const paid = charge(save, 1, 1, 10);
  if (!paid.ok) return paid;
  return {
    ok: true,
    save: {
      ...paid.save,
      competition: {
        ...state,
        scouts: [
          ...state.scouts,
          { npcId: npc.id, eventId, stamp: dayIndex(save) },
        ].slice(-100),
      },
    },
  };
}
const styles: Record<GamePlan["approach"], PlayStyle> = {
  "Rock Solid": "defensive",
  Careful: "solid",
  Balanced: "universal",
  Ambitious: "dynamic",
  "All Out Attacks": "attacking",
};
/** Only the paid, event-bound snapshot affects play. Editing controls does not grant free preparation. */
export function applyPreparedProfile(
  profile: MoveProfile,
  save: GameSave,
  eventId: string | undefined,
  db: OpeningDatabase,
): MoveProfile {
  const prep = competitionOf(save).prepared;
  if (!eventId || prep?.eventId !== eventId || !availableEvent(save, eventId))
    return profile;
  const rep = prep.repertoire;
  const get = (ids: string[]): string[][] =>
    ids
      .map((id) => db.byId.get(id)?.moves)
      .filter((m): m is string[] => !!m)
      .map((m) => [...m]);
  const scale =
    prep.plan.decision === "Play Fast"
      ? 0.65
      : prep.plan.decision === "Think Deeply"
        ? 1.5
        : 1;
  const white = get([
    ...rep.white,
    ...rep.backups.filter((id) => db.byId.get(id)?.side === "white"),
  ]);
  const black = get([
    ...rep["vs-e4"],
    ...rep["vs-d4"],
    ...rep["vs-c4"],
    ...rep["vs-nf3"],
    ...rep.black,
    ...rep.backups.filter((id) => db.byId.get(id)?.side === "black"),
  ]);
  return {
    ...profile,
    style: styles[prep.plan.approach],
    pace: profile.pace * scale,
    searchScale: scale,
    earlyDraw: prep.plan.earlyDraw,
    priorityBook: true,
    bookDepth: prep.depth,
    lines: {
      white: white.length ? white : profile.lines.white,
      black: black.length ? black : profile.lines.black,
    },
  };
}
export function archiveCompetition(save: GameSave): GameSave {
  const t = save.tournament;
  if (t?.status !== "finished") return save;
  const state = competitionOf(save);
  if (state.archive.some((a) => a.eventId === t.eventId)) return save;
  const grants: Qualification[] = [];
  const rank = t.withdrawn
    ? Number.POSITIVE_INFINITY
    : (t.finalRank ?? t.players.length);
  const category = t.details?.category;
  if (rank === 1 && category === "Open Tournaments") grants.push("grand-swiss");
  if (rank <= 3 && category === "National Championships")
    grants.push("continental");
  if (rank <= 3 && category === "Continental Championships")
    grants.push("world-cup", "grand-swiss");
  if (rank <= 2 && (category === "World Cup" || category === "Grand Swiss"))
    grants.push("candidates");
  if (rank === 1 && category === "Candidates Tournament")
    grants.push("world-championship");
  if (rank <= 3 && t.level === "international") grants.push("super-invitation");
  return {
    ...save,
    competition: {
      ...state,
      archive: [...state.archive, t].slice(-30),
      qualifications: [
        ...state.qualifications,
        ...grants.map((kind) => ({
          kind,
          year: save.world.date.year,
          source: t.name,
        })),
      ].slice(-100),
    },
  };
}
/** Both sides must reasonably want a draw; the setting never overrides a winning/losing position. */
export function reasonableEarlyDraw(input: {
  enabled: boolean;
  ply: number;
  evalCp: number;
  opponentStubborn: boolean;
  tournamentContext: boolean;
  drawUseful: boolean;
}): boolean {
  return (
    input.enabled &&
    input.tournamentContext &&
    input.drawUseful &&
    !input.opponentStubborn &&
    input.ply >= 20 &&
    Math.abs(input.evalCp) <= 25
  );
}
