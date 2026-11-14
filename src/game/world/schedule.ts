import { sponsorEvents } from "@/game/competition/sponsorEvents";
import { withEventPartner } from "@/game/competition/presentation";
import { distributeAnnualVenues } from "@/game/competition/venues";
import { qualificationCircuitEvents } from "@/game/competition/qualificationCircuit";
import { registrationWindow } from "@/game/competition/registrationWindow";
import { rotatingEvents } from "@/game/competition/agenda";
import { showcaseEvents } from "@/game/competition/showcase";
import { getCountry } from "@/data/world/countries";
import { sourcedEvents, extraCircuit, withTravel } from "@/game/qol/schedule";
import { careerEvents } from "@/game/competition/catalog";
import type { EventDetails } from "@/game/competition/types";
import {
  EVENT_FIELD_SIZE,
  EVENT_STYLES,
  type EventLevel,
} from "@/data/chess/tournaments";
import type { GameStamp, GameSave } from "@/types";
import { hashString } from "@/utils/format";
import { weeksBetween } from "../history/createHistory";

export interface Region {
  city: string;
  countryCode: string;
  demonym: string;
  continent: string;
  birthPlace?: import("@/types").BirthPlace;
}

export interface ScheduledEvent extends GameStamp {
  details?: EventDetails;
  id: string;
  name: string;
  level: EventLevel;
  fieldSize: number;
  entryFee: number;
  minElo: number;
  minReputation: number;
  /** Last week (inclusive) registration is open */
  registrationDeadline: GameStamp;
  weeksUntilStart: number;
  weeksUntilDeadline: number;
  /** Invitation-only levels only appear when the player qualifies */
  invitational: boolean;
}

const LEVEL_RULES: Record<
  EventLevel,
  {
    every: number;
    fee: number;
    minElo: number;
    minReputation: number;
    deadlineWeeks: number;
  }
> = {
  local: { every: 4, fee: 15, minElo: 0, minReputation: 0, deadlineWeeks: 1 },
  national: {
    every: 9,
    fee: 60,
    minElo: 1400,
    minReputation: 5,
    deadlineWeeks: 2,
  },
  international: {
    every: 13,
    fee: 180,
    minElo: 1900,
    minReputation: 30,
    deadlineWeeks: 3,
  },
  elite: {
    every: 26,
    fee: 400,
    minElo: 2400,
    minReputation: 80,
    deadlineWeeks: 4,
  },
};

function normalize(year: number, week: number): GameStamp {
  const total = year * 52 + (week - 1);
  return { year: Math.floor(total / 52), week: (total % 52) + 1 };
}

function fill(pattern: string, region: Region): string {
  return pattern
    .replace("{city}", region.city)
    .replace("{demonym}", region.demonym)
    .replace("{continent}", region.continent);
}

/** Events starting within the next `horizon` weeks, soonest first. Deterministic for a given date, career and region. */
function buildSchedule(
  now: GameStamp,
  region: Region,
  careerId: string,
  horizon = 26,
): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const start = now.year * 52 + (now.week - 1);
  const levels = Object.keys(LEVEL_RULES) as EventLevel[];

  for (const level of levels) {
    const rule = LEVEL_RULES[level];
    const offset = hashString(`${careerId}:${level}`) % rule.every;
    // Every `every` weeks, starting at the level's offset.
    const first =
      start +
      1 +
      ((((offset - (start + 1)) % rule.every) + rule.every) % rule.every);
    for (let abs = first; abs <= start + horizon; abs += rule.every) {
      const when = normalize(Math.floor(abs / 52), (abs % 52) + 1);
      const seed = hashString(`${careerId}:${level}:${abs}`);
      const style = EVENT_STYLES[level][seed % EVENT_STYLES[level].length];
      const name = `${fill(style.pattern, region)} · ${when.year}/${when.week}`;
      const [minField, maxField] = EVENT_FIELD_SIZE[level];
      const deadline = normalize(when.year, when.week - rule.deadlineWeeks);
      events.push({
        id: `${level}-${when.year}-${when.week}`,
        ...when,
        name,
        level,
        fieldSize: minField + (seed % (maxField - minField + 1)),
        entryFee: rule.fee,
        minElo: rule.minElo,
        minReputation: rule.minReputation,
        registrationDeadline: deadline,
        weeksUntilStart: weeksBetween(now, when),
        weeksUntilDeadline: weeksBetween(now, deadline),
        details: {
          venueNamePattern: `${style.pattern} · ${when.year}/${when.week}`,
          category:
            style.kind === "junior" ? "Junior Tournaments" : "Open Tournaments",
          ...(style.maxAge !== undefined ? { maxAge: style.maxAge } : {}),
          location: region.city,
          country: region.countryCode,
          end: when,
          format: "swiss",
          rounds: level === "local" ? 5 : 7,
          timeControl: /blitz/i.test(name)
            ? {
                id: "open-blitz",
                label: "3+2",
                base: 180,
                increment: 2,
                category: "blitz",
              }
            : /rapid/i.test(name)
              ? {
                  id: "open-rapid",
                  label: "15+10",
                  base: 900,
                  increment: 10,
                  category: "rapid",
                }
              : {
                  id: "open-classical",
                  label: "30+10",
                  base: 1800,
                  increment: 10,
                  category: "classical",
                },
          prize: rule.fee * (minField + (seed % (maxField - minField + 1))),
          prestige:
            (level === "local" ? 10 : 30) +
            (style.kind === "championship" ? 10 : 0),
          provenance: "fictional",
        },
        invitational: level === "international" || level === "elite",
      });
    }
  }
  return [
    ...events,
    ...Array.from({length:normalize(now.year,now.week+horizon).year-now.year+1},(_,i)=>sponsorEvents(now.year+i)).flat(),
    ...Array.from({ length: normalize(now.year, now.week + horizon).year - now.year + 1 }, (_, i) => qualificationCircuitEvents(now.year + i, region)).flat(),
    ...careerEvents(now, region, horizon),
    ...sourcedEvents(now, region, horizon),
    ...extraCircuit(now, region, careerId, horizon),
    ...showcaseEvents(now, region, horizon),
    ...rotatingEvents(now, region, horizon),
  ];
}

const annualCache = new Map<string, ScheduledEvent[]>();
export function regionForSave(save: GameSave): Region {
  const country = getCountry(save.player.country);
  return { city: save.player.city.name, countryCode: save.player.country,
    demonym: country?.nationality ?? save.player.country, continent: country?.continent ?? "World",
    birthPlace: save.player.birthPlace ?? { countryCode: save.career.countryCode, city: save.career.city.name } };
}

/** Keep paid bookings and already-running player/NPC events at their saved venues. */
export function preserveBookedVenues(save: GameSave, events: ScheduledEvent[]): ScheduledEvent[] {
  const snapshots = new Map<string, Pick<ScheduledEvent, "details" | "name" | "entryFee">>([
    ...save.registrations.map((r) => [r.eventId, r] as const),
    ...(save.calendarTournaments?.active ?? []).map((t) => [t.eventId, t] as const),
    ...(save.calendarTournaments?.national ?? []).map((n) => [n.event.id, { ...n.event, eventId: n.event.id }] as const),
    ...(save.tournament ? [[save.tournament.eventId, save.tournament] as const] : []),
  ]);
  return events.map((e) => {
    const saved = snapshots.get(e.id);
    return saved?.details ? { ...e, name: saved.name, details: saved.details, entryFee: saved.entryFee } : e;
  });
}

/** Annual hosts are stable across dates/horizons; only relative week counters change. */
export function getSchedule(now: GameStamp, region: Region, careerId: string, horizon = 26): ScheduledEvent[] {
  if (!Number.isFinite(horizon) || horizon < 0) return [];
  const last = normalize(now.year, now.week + Math.floor(horizon));
  const output: ScheduledEvent[] = [];
  for (let year = now.year; year <= last.year; year++) {
    const key = JSON.stringify([year, careerId, region]);
    let annual = annualCache.get(key);
    if (!annual) {
      const raw = buildSchedule({ year: year - 1, week: 52 }, region, careerId, 52).filter((e) => e.year === year);
      annual = distributeAnnualVenues(raw, region, careerId).map((event) => {
        let e = event;
        if (e.details && !e.details.organizer) {
          const official = e.details.federation || /Championship|World Cup|Candidates|Olympiad|Grand Swiss/.test(e.details.category);
          e = { ...e, details: { ...e.details, organizer: {
            name: official ? getCountry(e.details.country)?.federation.name ?? "Host federation" : `${e.name.split(" · ")[0]} Organizing Club`,
            status: official ? "Official" : "Unofficial", simulated: true,
          } } };
        }
        return withTravel(withEventPartner(e), region.countryCode);
      });
      if (annualCache.size >= 32) annualCache.delete(annualCache.keys().next().value!);
      annualCache.set(key, annual);
    }
    for (const e of annual) {
      const gap = weeksBetween(now, e);
      if (gap >= 0 && gap <= horizon) output.push({ ...e, weeksUntilStart: gap, weeksUntilDeadline: weeksBetween(now, e.registrationDeadline) });
    }
  }
  return output.sort((a, b) => a.weeksUntilStart - b.weeksUntilStart || (a.details?.agenda?.startDay ?? 1) - (b.details?.agenda?.startDay ?? 1) || a.name.localeCompare(b.name));
}

export const isEligible = (
  event: ScheduledEvent,
  rating: number,
  reputation: number,
): boolean => rating >= event.minElo && reputation >= event.minReputation;
export const registrationOpen = (
  event: ScheduledEvent,
  save?: GameSave,
): boolean =>
  event.weeksUntilDeadline >= 0 &&
  (!save || registrationWindow(save, event).status === "open");
