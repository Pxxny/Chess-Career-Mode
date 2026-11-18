import { SPONSORSHIPS } from '@/data/reputation';
import { COUNTRIES, getCountry } from '@/data/world/countries';
import { hashString } from '@/utils/format';
import type { Npc } from '@/types';
import type { ScheduledEvent } from '@/game/world/schedule';
import type { CompetitionState, EventDetails, HallOfFameEntry, SelectChoice } from './types';

/**
 * Sponsor "Select Tours": nationwide selection tours run only by high-budget sponsors.
 * Stages are National and World Finals only (no Local or Continental). Each country sends
 * one player to the World Finals, unless last year's winner raised that country's seats.
 */
type SeriesSponsor = 'cobalt-lantern' | 'zenith-arc';
export interface SelectTourType {
  id: string;
  label: string;
  gender?: 'male' | 'female';
  maxAge?: number;
  worldPrize: number;
  titles: Record<SeriesSponsor, string>;
}

export const SELECT_TOUR_TYPES: readonly SelectTourType[] = [
  { id: "open", label: "Open", gender: "male", worldPrize: 30_000_000,
    titles: { "cobalt-lantern": "Sovereign Crown", "zenith-arc": "Apex Dominion" } },
  { id: "women", label: "Women", gender: "female", worldPrize: 2_500_000,
    titles: { "cobalt-lantern": "Women's Aurora Queens", "zenith-arc": "Women's Celestial Empress" } },
  { id: "u10", label: "U10", maxAge: 10, worldPrize: 250_000,
    titles: { "cobalt-lantern": "U10 Little Sparks", "zenith-arc": "U10 Starborn Cup" } },
  { id: "u12", label: "U12", maxAge: 12, worldPrize: 400_000,
    titles: { "cobalt-lantern": "U12 Rising Flames", "zenith-arc": "U12 Nova Challenge" } },
  { id: "u14", label: "U14", maxAge: 14, worldPrize: 650_000,
    titles: { "cobalt-lantern": "U14 Blue Horizon", "zenith-arc": "U14 Orbit Masters" } },
  { id: "u16", label: "U16", maxAge: 16, worldPrize: 1_000_000,
    titles: { "cobalt-lantern": "U16 Luminous Knights", "zenith-arc": "U16 Astral Vanguard" } },
  { id: "u18", label: "U18", maxAge: 18, worldPrize: 1_500_000,
    titles: { "cobalt-lantern": "U18 Radiant Masters", "zenith-arc": "U18 Summit Conquest" } },
  { id: "u20", label: "U20", maxAge: 20, worldPrize: 2_000_000,
    titles: { "cobalt-lantern": "U20 Eternal Legacy", "zenith-arc": "U20 Infinity Crown" } },
];

export const seriesName = (sponsor: { id: SeriesSponsor; name: string }, type: SelectTourType) =>
  `${sponsor.name} ${type.titles[sponsor.id]}`;

/** A sponsor needs a large market share to fund a full family of select tours. */
export const SELECT_MIN_MARKET_WEIGHT = 8;
const CANDIDATE_IDS = ['cobalt-lantern', 'zenith-arc'] as const;
export const SELECT_SPONSORS = CANDIDATE_IDS
  .flatMap((id) => {
    const sponsor = SPONSORSHIPS.find((s) => s.id === id);
    return sponsor && sponsor.marketWeight >= SELECT_MIN_MARKET_WEIGHT ? [{ id, name: sponsor.name }] : [];
  });

export const SELECT_BASE_SEATS = 1;
export const SELECT_BOOST_SEATS = 2;
export const SELECT_WORLD_FIELD = 256;

export const selectSeriesId = (sponsorId: string, typeId: string) => `${sponsorId}-select-${typeId}`;
export const selectTourType = (id?: string) => SELECT_TOUR_TYPES.find((t) => t.id === id);
export function parseSelectSeries(seriesId?: string) {
  if (!seriesId) return undefined;
  for (const sponsor of SELECT_SPONSORS)
    for (const type of SELECT_TOUR_TYPES)
      if (selectSeriesId(sponsor.id, type.id) === seriesId) return { sponsor, type };
  return undefined;
}
export const allSelectSeries = () =>
  SELECT_SPONSORS.flatMap((sponsor) =>
    SELECT_TOUR_TYPES.map((type) => ({ id: selectSeriesId(sponsor.id, type.id), sponsor, type, name: seriesName(sponsor, type) })));

/** Refresh booked editions from older saves without moving their host or changing their ID. */
export function refreshSeriesEdition<T extends { name: string; details?: EventDetails; status?: string }>(event: T): T {
  const details = event.details;
  const circuit = details?.qualificationCircuit;
  const parsed = parseSelectSeries(circuit?.seriesId);
  if (!details || !circuit?.selectTour || !parsed || event.status === "finished") return event;
  const final = circuit.stage === "world";
  const name = seriesName(parsed.sponsor, parsed.type);
  const worldFinalName = `${name} — World Finals`;
  const prize = final ? parsed.type.worldPrize : details.prize;
  return {
    ...event,
    name: final ? worldFinalName : `${name} — National Qualifier`,
    ...("prizeFund" in event && final ? { prizeFund: prize } : {}),
    details: {
      ...details, prize, gender: parsed.type.gender, maxAge: parsed.type.maxAge,
      qualificationCircuit: { ...circuit, worldFinalName, selectTour: { ...circuit.selectTour, label: parsed.type.label } },
    },
  };
}

export const selectNpcEligible = (n: Pick<Npc, 'gender' | 'age'>, type?: SelectTourType) =>
  !type || ((!type.gender || n.gender === type.gender) && (type.maxAge === undefined || n.age <= type.maxAge));

/** What last year's winners earned for this year's editions. Only decided choices count. */
export function selectLegacy(choices: Record<string, SelectChoice> | undefined, seriesId: string, year: number) {
  const parsed = parseSelectSeries(seriesId);
  const previous = Object.values(choices ?? {}).filter((c) => c.year === year - 1 && c.choice);
  const quotaBoost = [...new Set(previous.filter((c) => c.seriesId === seriesId && c.choice === 'quota').map((c) => c.country))].sort();
  const host = previous
    .filter((c) => c.choice === 'host' && parsed && c.sponsorId === parsed.sponsor.id && c.seriesId !== seriesId)
    .sort((a, b) => a.seriesId.localeCompare(b.seriesId))[0];
  return { quotaBoost, host };
}

/** Any other tour of the same sponsor: select World Finals and the sponsor's classic World Finals. */
const hostedSeries = (seriesId: string | undefined, sponsorId: string) =>
  seriesId === sponsorId || (!!seriesId && parseSelectSeries(seriesId)?.sponsor.id === sponsorId);

/** Applies last year's winners' choices to a schedule. Returns the same objects when nothing changes. */
export function applySelectLegacy(events: ScheduledEvent[], choices: Record<string, SelectChoice> | undefined): ScheduledEvent[] {
  const decided = Object.values(choices ?? {}).filter((c) => c.choice);
  if (!decided.length) return events;
  return events.map((e) => {
    const c = e.details?.qualificationCircuit;
    if (!c) return e;
    const select = c.selectTour;
    if (select && c.seriesId) {
      const legacy = selectLegacy(choices, c.seriesId, c.season);
      if (c.stage === 'national' && c.country && legacy.quotaBoost.includes(c.country))
        return { ...e, details: { ...e.details!, qualificationCircuit: { ...c, advanceTop: SELECT_BOOST_SEATS } } };
      if (c.stage === 'world') {
        const next = { ...c, selectTour: { ...select, ...(legacy.quotaBoost.length ? { quotaBoost: legacy.quotaBoost } : {}) } };
        if (legacy.host) {
          const host = legacy.host;
          return { ...e, details: { ...e.details!, qualificationCircuit: { ...next, selectTour: { ...next.selectTour, hostedBy: host.winnerName } }, location: host.city, country: host.country } };
        }
        return legacy.quotaBoost.length ? { ...e, details: { ...e.details!, qualificationCircuit: next } } : e;
      }
      return e;
    }
    // Classic World Finals of a sponsor whose select winner picked "host".
    if (c.stage === 'world' && c.seriesId) {
      const host = decided.find((d) => d.choice === 'host' && d.year === c.season - 1 && hostedSeries(c.seriesId, d.sponsorId));
      if (host) return { ...e, details: { ...e.details!, qualificationCircuit: { ...c, selectTour: undefined }, location: host.city, country: host.country } };
    }
    return e;
  });
}

/** Older saves retain recent winners in their reward history. */
export function openChampions(state: CompetitionState | undefined): Record<string, HallOfFameEntry> {
  const champions = { ...state?.hallOfFame };
  for (const winner of Object.values(state?.selectChoices ?? {})) {
    if (parseSelectSeries(winner.seriesId)?.type.id === "open")
      champions[winner.finalId] ??= hallOfFameEntry(winner);
  }
  return champions;
}

function hallOfFameEntry({ finalId, seriesId, year, winnerId, winnerName, country, by }: HallOfFameEntry): HallOfFameEntry {
  return { finalId, seriesId, year, winnerId, winnerName, country, by };
}

/** NPC winners pick deterministically. */
export const npcSelectChoice = (finalId: string): 'host' | 'quota' => (hashString(`${finalId}:select-reward`) % 2 === 0 ? 'host' : 'quota');

export interface SelectWinnerInput {
  finalId: string;
  seriesId: string;
  year: number;
  winnerId: string;
  winnerName: string;
  country: string;
  city?: string;
  isPlayer: boolean;
}
/** Stores the World Final winner. A player winner decides later; an NPC winner decides now. */
export function recordSelectWinner(state: CompetitionState, input: SelectWinnerInput): CompetitionState {
  const parsed = parseSelectSeries(input.seriesId);
  if (!parsed || state.selectChoices?.[input.finalId]) return state;
  const city = input.city || getCountry(input.country)?.capital || COUNTRIES.find((c) => c.code === input.country)?.name || input.country;
  const entry: SelectChoice = {
    finalId: input.finalId, seriesId: input.seriesId, sponsorId: parsed.sponsor.id, sponsorName: parsed.sponsor.name, year: input.year,
    winnerId: input.winnerId, winnerName: input.winnerName, country: input.country, city,
    ...(input.isPlayer ? {} : { choice: npcSelectChoice(input.finalId) }), by: input.isPlayer ? 'player' : 'npc',
  };
  const hallOfFame = openChampions(state);
  if (parsed.type.id === "open") hallOfFame[entry.finalId] ??= hallOfFameEntry(entry);
  return { ...state, hallOfFame, selectChoices: Object.fromEntries(Object.entries({ ...(state.selectChoices ?? {}), [input.finalId]: entry }).slice(-60)) };
}

export const pendingSelectChoices = (state: CompetitionState | undefined) =>
  Object.values(state?.selectChoices ?? {}).filter((c) => c.by === 'player' && !c.choice);

export function chooseSelectReward(state: CompetitionState, finalId: string, choice: 'host' | 'quota'): CompetitionState | null {
  const entry = state.selectChoices?.[finalId];
  if (!entry || entry.by !== 'player' || entry.choice) return null;
  return { ...state, selectChoices: { ...state.selectChoices, [finalId]: { ...entry, choice } } };
}
