import jsonLogic from "json-logic-js";
import { GAME_CONFIG } from "@/data/config";
import { SPONSORSHIPS } from "@/data/reputation";
import type { GameSave } from "@/types";
import { lifetimeOf } from "@/game/history/lifetime";
import { stampIndex } from "@/game/competition/catalog";
import { gameDay } from "@/game/competition/agenda";
export interface SponsorContract {
  id: string;
  sponsorId: string;
  start: number;
  end: number;
  nextPayment: number;
  period: number;
  gamesAtStart: number;
  sessionsAtStart: number;
  paid: number;
  missed: number;
}
export interface SponsorshipState {
  active: SponsorContract | null;
  cooldownUntil: number;
  history: Array<SponsorContract & { ended: number }>;
  notifiedOffers?: string[];
}
export type LegacyRole = "active" | "mentor" | "commentator" | "ambassador";
export interface LegacyState {
  role: LegacyRole;
  changedWeek: number;
  lastServiceWeek: number;
  services: number;
}
export const LEGACY_LABELS: Record<LegacyRole, string> = {
  active: "Active competitor",
  mentor: "Mentor",
  commentator: "Commentator",
  ambassador: "Chess ambassador",
};
export const sponsorsOf = (s: GameSave): SponsorshipState =>
  s.sponsorship ?? { active: null, cooldownUntil: 0, history: [] };
export const legacyOf = (s: GameSave): LegacyState =>
  s.legacy ?? {
    role: "active",
    changedWeek: -1,
    lastServiceWeek: -1,
    services: 0,
  };
export const legacyUnlocked = (s: GameSave) =>
  s.player.age >= 35 ||
  s.world.date.year - s.career.startYear >= 10 ||
  s.player.peakRating >= 2400;
const games = (s: GameSave) => lifetimeOf(s.history).total.games;
const sessions = (s: GameSave) => s.training.sessionCounter;
export function sponsorEligible(s:GameSave, sponsor: typeof SPONSORSHIPS[number]) {
  return Boolean(jsonLogic.apply({and:[{">=":[{var:"elo"},sponsor.minElo]},{">=":[{var:"reputation"},sponsor.minReputation]}]},{elo:s.player.rating,reputation:s.player.reputation}));
}
export const sponsorOffers = (s:GameSave) => SPONSORSHIPS.filter(x=>sponsorEligible(s,x)).sort((a,b)=>b.marketWeight-a.marketWeight);
export function refreshSponsorOffers(s:GameSave):GameSave {
 const state=sponsorsOf(s),known=new Set(state.notifiedOffers??[]),fresh=sponsorOffers(s).filter(x=>!known.has(x.id));
 if(!fresh.length)return s;
 return {...s,sponsorship:{...state,notifiedOffers:[...known,...fresh.map(x=>x.id)]},history:{...s.history,news:[...s.history.news,{...s.world.date,id:`sponsor-offers-${stampIndex(s.world.date)}-${fresh[0].id}`,kind:'sponsorship' as const,headline:'New sponsorship offers',detail:fresh.map(x=>`${x.name} · $${x.monthly} / 4 weeks`).join(' | ')}].slice(-GAME_CONFIG.history.maxNews)}};
}
export function signSponsor(s: GameSave, id: string) {
  const sponsor = SPONSORSHIPS.find((x) => x.id === id),
    state = sponsorsOf(s),
    now = stampIndex(s.world.date);
  if (
    !sponsor ||
    !sponsorEligible(s,sponsor)
  )
    return {
      ok: false as const,
      error: "You do not meet this sponsor’s Elo and reputation requirements.",
    };
  if (state.active || now < state.cooldownUntil)
    return {
      ok: false as const,
      error: "Finish the current contract and cooldown before signing another.",
    };
  const contract = {
    id: `sponsor-${id}-${now}`,
    sponsorId: id,
    start: now,
    end: now + 12,
    nextPayment: now + 4,
    period: 0,
    gamesAtStart: games(s),
    sessionsAtStart: sessions(s),
    paid: 0,
    missed: 0,
  };
  return {
    ok: true as const,
    save: { ...s, sponsorship: { ...state, active: contract } },
  };
}
export function cancelSponsor(s: GameSave) {
  const state = sponsorsOf(s),
    active = state.active;
  if (!active) return s;
  return {
    ...s,
    sponsorship: {
      ...state,
      active: null,
      cooldownUntil: stampIndex(s.world.date) + 4,
      history: [
        ...state.history,
        { ...active, ended: stampIndex(s.world.date) },
      ].slice(-30),
    },
  };
}
/** Called on calendar advancement, including planned simulation. Every payment has a durable unique ledger id. */
export function settleSponsors(s: GameSave): GameSave {
  s = refreshSponsorOffers(s);
  const state = sponsorsOf(s);
  if (!state.active) return s;
  const a = { ...state.active },
    sponsor = SPONSORSHIPS.find((x) => x.id === a.sponsorId);
  if (!sponsor) return cancelSponsor(s);
  const now = stampIndex(s.world.date);
  let next = s;
  while (a.nextPayment <= now && a.nextPayment <= a.end) {
    const needGames = a.sponsorId === "brand" ? 12 : 6;
    const qualified =
      Boolean(jsonLogic.apply({and:[{">=":[{var:"games"},needGames]},{">=":[{var:"sessions"},8]}]},{games:games(s)-a.gamesAtStart,sessions:sessions(s)-a.sessionsAtStart}));
    const id = `${a.id}-period-${a.period}`;
    if (!next.history.ledger.some((l) => l.id === id)) {
      const amount = qualified ? sponsor.monthly : 0;
      next = {
        ...next,
        player: { ...next.player, money: next.player.money + amount },
        history: {
          ...next.history,
          ledger: [
            ...next.history.ledger,
            {
              ...s.world.date,
              id,
              kind: "sponsorship" as const,
              label: qualified
                ? "Sponsorship payment"
                : "Sponsorship target missed",
              amount,
            },
          ].slice(-GAME_CONFIG.history.maxLedger),
          news: [
            ...next.history.news,
            {
              ...s.world.date,
              id,
              kind: "sponsorship" as const,
              headline: qualified
                ? "Sponsorship payment received"
                : "Sponsorship target missed",
              detail: `${sponsor.name} · $${amount}`,
            },
          ].slice(-GAME_CONFIG.history.maxNews),
        },
      };
      a.paid += amount;
      a.missed += Number(!qualified);
    }
    a.gamesAtStart = games(s);
    a.sessionsAtStart = sessions(s);
    a.nextPayment += 4;
    a.period++;
  }
  if (now >= a.end)
    return {
      ...next,
      sponsorship: {
        ...state,
        active: null,
        cooldownUntil: a.end + 4,
        history: [...state.history, { ...a, ended: a.end }].slice(-30),
      },
    };
  return { ...next, sponsorship: { ...state, active: a } };
}
export function changeLegacyRole(s: GameSave, role: LegacyRole) {
  const state = legacyOf(s),
    now = stampIndex(s.world.date);
  if (!(role in LEGACY_LABELS))
    return { ok: false as const, error: "Choose a valid career role." };
  if (role !== "active" && !legacyUnlocked(s))
    return {
      ok: false as const,
      error:
        "Legacy roles unlock at age 35, after ten seasons, or at a peak Elo of 2400.",
    };
  if (now < state.changedWeek + 4)
    return {
      ok: false as const,
      error: "Wait four weeks before changing career role again.",
    };
  return {
    ok: true as const,
    save: { ...s, legacy: { ...state, role, changedWeek: now } },
  };
}
export function legacyService(s: GameSave) {
  const state = legacyOf(s),
    now = stampIndex(s.world.date);
  if (state.role === "active" || !legacyUnlocked(s))
    return {
      ok: false as const,
      error: "Choose an unlocked legacy role first.",
    };
  if (state.lastServiceWeek >= now)
    return {
      ok: false as const,
      error: "You have completed this week’s legacy activity.",
    };
  if (
    s.player.ap.current < 2 ||
    s.training.hoursUsedToday + 2 > 8 ||
    s.training.fatigue >= 90
  )
    return {
      ok: false as const,
      error: "This activity needs 2 AP, 2 free hours and enough energy.",
    };
  const amount =
      state.role === "mentor" ? 40 : state.role === "commentator" ? 60 : 80,
    id = `legacy-${now}`;
  const services = state.services + 1;
  const trophy =
    services === 12
      ? [
          {
            ...s.world.date,
            id: "legacy-contribution",
            category: "special" as const,
            name: "A lasting contribution",
            description: "Completed twelve weekly legacy activities.",
          },
        ]
      : [];
  return {
    ok: true as const,
    save: {
      ...s,
      legacy: { ...state, lastServiceWeek: now, services },
      player: {
        ...s.player,
        money: s.player.money + amount,
        reputation: s.player.reputation + 1,
        ap: { ...s.player.ap, current: s.player.ap.current - 2 },
      },
      training: {
        ...s.training,
        hoursUsedToday: s.training.hoursUsedToday + 2,
        fatigue: Math.min(100, s.training.fatigue + 6),
      },
      history: {
        ...s.history,
        trophies: [...s.history.trophies, ...trophy],
        ledger: [
          ...s.history.ledger,
          {
            ...s.world.date,
            id,
            kind: "other" as const,
            label: LEGACY_LABELS[state.role],
            amount,
          },
        ].slice(-GAME_CONFIG.history.maxLedger),
      },
    },
  };
}
export function sponsorProgress(s: GameSave) {
  const a = sponsorsOf(s).active;
  return a
    ? {
        games: Math.max(0, games(s) - a.gamesAtStart),
        sessions: Math.max(0, sessions(s) - a.sessionsAtStart),
        needGames: a.sponsorId === "brand" ? 12 : 6,
      }
    : null;
}
