import { remember, type SharedMemory } from "./memories";
import { gameDay } from "@/game/competition/agenda";
import { createRng, mixSeed } from "@/game/rng";
import { performSession } from "@/game/training/engine";
import { hashString } from "@/utils/format";
import type { ActiveTournament, GameOutcome, GameSave, Npc } from "@/types";

export type SocialAction = "talk" | "study" | "play";
export interface Relationship {
  firstRatedMemory?: SharedMemory;
  npcId: string;
  familiarity: number;
  closeness: number;
  ratedGames: number;
  wins: number;
  draws: number;
  losses: number;
  sharedEvents: number;
  friendlyGames: number;
  chats: number;
  studies: number;
  lastMetDay: number;
  lastSocialDay: number | null;
  decayThroughDay: number | null;
  lastAttemptDay: number | null;
  lastFriendlyRewardDay: number | null;
  rewardWeek: number;
  rewardPoints: number;
}
export interface SocialInvitation {
  id: string;
  npcId: string;
  careerId: string;
  day: number;
  started: boolean;
}
export interface SocialState {
  memories?: SharedMemory[];
  relationships: Record<string, Relationship>;
  sequence: number;
  pending: SocialInvitation | null;
  seenEvents: string[];
  log: {
    id: number;
    day: number;
    npcId: string;
    action: string;
    message: string;
  }[];
}
export const emptySocial = (): SocialState => ({
  relationships: {},
  sequence: 0,
  pending: null,
  seenEvents: [],
  log: [],
});
const cap = (n: number) => Math.max(0, Math.min(100, n));
export const emptyRelationship = (npcId: string): Relationship => ({
  npcId,
  familiarity: 0,
  closeness: 0,
  ratedGames: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  sharedEvents: 0,
  friendlyGames: 0,
  chats: 0,
  studies: 0,
  lastMetDay: 0,
  lastSocialDay: null,
  decayThroughDay: null,
  lastAttemptDay: null,
  lastFriendlyRewardDay: null,
  rewardWeek: -1,
  rewardPoints: 0,
});
export function relationshipAt(save: GameSave, npcId: string): Relationship {
  const r = save.social?.relationships[npcId] ?? emptyRelationship(npcId);
  const anchor =
    r.lastSocialDay === null
      ? gameDay(save)
      : Math.max(r.lastSocialDay + 28, r.decayThroughDay ?? 0);
  const inactive = Math.max(0, Math.floor((gameDay(save) - anchor) / 14));
  return inactive
    ? {
        ...r,
        closeness: Math.max(0, r.closeness - inactive),
        decayThroughDay: anchor + inactive * 14,
      }
    : r;
}
export function relationshipLabel(r: Relationship): string {
  if (r.closeness >= 80) return "Close friends";
  if (r.closeness >= 55) return "Friends";
  if (r.closeness >= 30) return "Friendly";
  if (r.closeness >= 10) return "Acquaintances";
  if (r.familiarity >= 20) return "Regular opponents";
  return r.familiarity > 0 ? "Recognized" : "Not met";
}
function storeRelationship(save: GameSave, r: Relationship): GameSave {
  const state = save.social ?? emptySocial();
  let relationships = { ...state.relationships, [r.npcId]: r };
  if (Object.keys(relationships).length > 2048) {
    const kept = Object.values(relationships)
      .sort((a, b) => b.closeness - a.closeness || b.lastMetDay - a.lastMetDay)
      .slice(0, 2047);
    relationships = Object.fromEntries([...kept, r].map((r) => [r.npcId, r]));
  }
  return { ...save, social: { ...state, relationships } };
}
/** Competitive exposure builds recognition, never friendship. */
export function recordRatedContact(
  save: GameSave,
  npcId: string | null,
  outcome: GameOutcome,
): GameSave {
  if (!npcId || npcId === "player" || npcId === save.player.id) return save;
  const r = relationshipAt(save, npcId);
  const game = save.history.games.at(-1);
  const next = storeRelationship(save, {
    ...r,
    ...(game && r.ratedGames === 0 && !r.firstRatedMemory
      ? {
          firstRatedMemory: {
            id: `rated-${game.id}`,
            npcId,
            day: gameDay(save),
            kind: "rated" as const,
            outcome,
            ...(game.tournamentName ? { event: game.tournamentName } : {}),
          },
        }
      : {}),
    familiarity: cap(r.familiarity + 2),
    ratedGames: r.ratedGames + 1,
    wins: r.wins + Number(outcome === "win"),
    draws: r.draws + Number(outcome === "draw"),
    losses: r.losses + Number(outcome === "loss"),
    lastMetDay: gameDay(save),
  });
  return game
    ? remember(next, {
        id: `rated-${game.id}`,
        npcId,
        kind: "rated",
        outcome,
        event: game.tournamentName ?? undefined,
      })
    : next;
}
export function recordSharedEvent(
  save: GameSave,
  t: ActiveTournament,
): GameSave {
  return recordSharedContacts(
    save,
    t.eventId,
    t.players.filter((p) => !p.isPlayer).map((p) => p.id),
  );
}
export function recordSharedContacts(
  save: GameSave,
  eventId: string,
  npcIds: string[],
): GameSave {
  const state = save.social ?? emptySocial();
  if (state.seenEvents.includes(eventId)) return save;
  let next = save;
  for (const id of new Set(npcIds))
    if (id !== "player" && id !== save.player.id) {
      const r = relationshipAt(next, id);
      next = storeRelationship(next, {
        ...r,
        familiarity: cap(r.familiarity + 1),
        sharedEvents: r.sharedEvents + 1,
        lastMetDay: gameDay(save),
      });
    }
  return {
    ...next,
    social: {
      ...(next.social ?? state),
      seenEvents: [...state.seenEvents, eventId].slice(-256),
    },
  };
}
/** Upgrade retained encounters without inventing past conversations or friendships. */
export function socialOf(save: GameSave): SocialState {
  if (save.social) return save.social;
  let next: GameSave = { ...save, social: emptySocial() };
  for (const g of save.history.games)
    next = recordRatedContact(next, g.opponentId, g.outcome);
  for (const t of [
    ...(save.competition?.archive ?? []),
    ...(save.tournament ? [save.tournament] : []),
  ])
    next = recordSharedEvent(next, t);
  for (const c of [
    ...(save.esports?.history ?? []),
    ...(save.esports?.active ? [save.esports.active] : []),
  ])
    next = recordSharedContacts(
      next,
      `esports:${c.event.id}`,
      c.teams.flatMap((t) => t.members.map((m) => m.id)),
    );
  return next.social!;
}
function reward(save: GameSave, npcId: string, points: number): Relationship {
  const r = relationshipAt(save, npcId),
    week = Math.floor(gameDay(save) / 7);
  const used = r.rewardWeek === week ? r.rewardPoints : 0,
    gain = Math.max(0, Math.min(points, 12 - used));
  return {
    ...r,
    closeness: cap(r.closeness + gain),
    rewardWeek: week,
    rewardPoints: used + gain,
    lastSocialDay: gameDay(save),
    decayThroughDay: gameDay(save) + 28,
    lastMetDay: gameDay(save),
  };
}
function log(
  save: GameSave,
  npcId: string,
  action: string,
  message: string,
): GameSave {
  const state = save.social ?? emptySocial(),
    sequence = state.sequence + 1;
  return {
    ...save,
    social: {
      ...state,
      sequence,
      log: [
        ...state.log,
        { id: sequence, day: gameDay(save), npcId, action, message },
      ].slice(-60),
    },
  };
}
export function socialActionIssue(
  save: GameSave,
  npc: Npc,
  action: SocialAction,
  starting = false,
): string | null {
  if (!["active", "semi-retired", "retired"].includes(npc.careerStatus))
    return "This player is not available in the current era.";
  const pending = save.social?.pending;
  if (!starting && pending)
    return "Finish or cancel your current friendly invitation first.";
  if (save.pendingMatch) return "Finish the running match first.";
  if (
    !starting &&
    relationshipAt(save, npc.id).lastAttemptDay === gameDay(save)
  )
    return "You already approached this player today. Try another day.";
  const busy =
    save.tournament?.status === "playing" &&
    save.tournament.players.some((p) => p.id === npc.id);
  const teamBusy =
    save.esports?.active?.status === "playing" &&
    save.esports.active.teams.some((t) =>
      t.members.some((m) => m.id === npc.id),
    );
  if ((action === "study" || action === "play") && (busy || teamBusy))
    return "This player is busy in an ongoing competition.";
  const hours = action === "talk" ? 0.5 : 1;
  if (save.player.ap.current < 1) return "You need 1 AP.";
  if (save.training.hoursUsedToday + hours > 8)
    return `You need ${hours} free training hours today.`;
  if (save.training.fatigue >= 90 && action !== "talk")
    return "Rest before playing or studying together.";
  return null;
}
export function invitationChance(
  save: GameSave,
  npc: Npc,
  action: SocialAction,
): number {
  const r = relationshipAt(save, npc.id);
  const personality =
    npc.personality === "sociable"
      ? 0.16
      : npc.personality === "reserved"
        ? -0.12
        : npc.personality === "stubborn"
          ? -0.08
          : npc.personality === "calm"
            ? 0.06
            : 0;
  const distance =
    Math.max(0, npc.currentElo - save.player.rating - 150) / 3000;
  return Math.max(
    0.06,
    Math.min(
      0.95,
      0.64 +
        personality +
        r.familiarity * 0.0015 +
        r.closeness * 0.004 -
        distance +
        (npc.city === save.player.city.name ? 0.08 : 0) -
        (npc.morale < 30 ? 0.1 : 0) -
        (action === "study" ? 0.06 : action === "play" ? 0.03 : 0),
    ),
  );
}
export type SocialResult =
  | { ok: false; error: string }
  | { ok: true; save: GameSave; accepted: boolean; message: string };
/** One approach per NPC per day; a reload cannot reroll the NPC's answer. */
export function approachNpc(
  save: GameSave,
  npc: Npc,
  action: SocialAction,
): SocialResult {
  const error = socialActionIssue(save, npc, action);
  if (error) return { ok: false, error };
  const rng = createRng(
    mixSeed(
      save.world.seed ^ hashString(`${save.career.id}:${npc.id}:${action}`),
      gameDay(save),
    ),
  );
  const accepted = rng.chance(invitationChance(save, npc, action));
  const r = relationshipAt(save, npc.id);
  let next = storeRelationship(save, {
    ...r,
    familiarity: cap(r.familiarity + 1),
    lastMetDay: gameDay(save),
    lastAttemptDay: gameDay(save),
  });
  if (!accepted) {
    const message = `${npc.name} is not available for ${action === "talk" ? "a conversation" : action === "study" ? "shared study" : "a friendly game"} today. No AP or hours were spent.`;
    return {
      ok: true,
      accepted: false,
      save: remember(log(next, npc.id, action, message), {
        id: `social-${npc.id}-${action}-${gameDay(save)}`,
        npcId: npc.id,
        kind: action === "talk" ? "talk" : "study",
      }),
      message,
    };
  }
  if (action === "play") {
    const message = `${npc.name} accepted your friendly invitation. Set up the game to play together.`;
    next = log(next, npc.id, action, message);
    next = {
      ...next,
      social: {
        ...next.social!,
        pending: {
          id: `social:${save.career.id}:${next.social!.sequence}`,
          npcId: npc.id,
          careerId: save.career.id,
          day: gameDay(save),
          started: false,
        },
      },
    };
    return { ok: true, accepted: true, save: next, message };
  }
  if (action === "study") {
    const study = performSession(next, "tactics-puzzle", {
      master: { name: npc.name, stat: npc.strengths[0] ?? "tactics" },
    });
    if (!study.ok) return { ok: false, error: study.error };
    next = study.save;
    const sessions = [...next.history.sessions],
      last = sessions.at(-1)!;
    sessions[sessions.length - 1] = {
      ...last,
      sessionId: "social-study",
      name: `Study with ${npc.name}`,
      detail: `Shared tactics; focus on ${npc.strengths[0] ?? "tactics"}.`,
    };
    next = { ...next, history: { ...next.history, sessions } };
  } else
    next = {
      ...next,
      player: {
        ...next.player,
        ap: { ...next.player.ap, current: next.player.ap.current - 1 },
        morale: cap(next.player.morale + 1),
      },
      training: {
        ...next.training,
        hoursUsedToday: next.training.hoursUsedToday + 0.5,
      },
    };
  const bonded = reward(next, npc.id, action === "talk" ? 3 : 5);
  next = storeRelationship(next, {
    ...bonded,
    chats: bonded.chats + Number(action === "talk"),
    studies: bonded.studies + Number(action === "study"),
  });
  const message =
    action === "talk"
      ? `You talked with ${npc.name}.`
      : `You studied tactics with ${npc.name} and gained training experience.`;
  return {
    ok: true,
    accepted: true,
    save: remember(log(next, npc.id, action, message), {
      id: `social-${npc.id}-${action}-${gameDay(save)}`,
      npcId: npc.id,
      kind: action === "talk" ? "talk" : "study",
    }),
    message,
  };
}
export function socialMatchValid(
  save: GameSave,
  context: { requestId: string; npcId: string; careerId: string },
): boolean {
  const p = save.social?.pending;
  return (
    !!p &&
    p.started &&
    p.id === context.requestId &&
    p.npcId === context.npcId &&
    p.careerId === save.career.id &&
    context.careerId === save.career.id
  );
}
export function cancelSocialInvitation(save: GameSave): GameSave {
  return save.social?.pending
    ? { ...save, social: { ...save.social, pending: null } }
    : save;
}
export function finishSocialGame(
  save: GameSave,
  context: { requestId: string; npcId: string; careerId: string },
  meaningful: boolean,
): GameSave {
  if (!socialMatchValid(save, context)) return save;
  let next = save;
  if (meaningful) {
    const r = relationshipAt(save, context.npcId);
    const bonded =
      r.lastFriendlyRewardDay === gameDay(save)
        ? r
        : reward(save, context.npcId, 5);
    next = storeRelationship(save, {
      ...bonded,
      familiarity: cap(bonded.familiarity + 3),
      friendlyGames: bonded.friendlyGames + 1,
      lastFriendlyRewardDay: gameDay(save),
      lastMetDay: gameDay(save),
    });
  }
  next = log(
    next,
    context.npcId,
    "friendly-result",
    meaningful
      ? "Played a friendly game together."
      : "Friendly session ended without a friendship reward.",
  );
  return cancelSocialInvitation(
    meaningful
      ? remember(next, {
          id: `friendly-${context.requestId}`,
          npcId: context.npcId,
          kind: "friendly",
        })
      : next,
  );
}
