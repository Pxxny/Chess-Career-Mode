import { FIDE_REFERENCES as records } from "@/data/chess/fideReferences";
import type { Region, ScheduledEvent } from "@/game/world/schedule";
import { stampFromIndex, stampIndex } from "@/game/competition/catalog";
import type { GameStamp, MatchTimeControl } from "@/types";
import { getCountry } from "@/data/world/countries";
import { hashString } from "@/utils/format";
export const FIDE_RECORDS = records;
const weekOf = (iso: string): GameStamp => {
  const d = new Date(`${iso}T00:00:00Z`),
    year = d.getUTCFullYear();
  return {
    year,
    week: Math.min(
      52,
      Math.floor((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 / 7) + 1,
    ),
  };
};
function tcOf(text: string): MatchTimeControl {
  const fast = /blitz/i.test(text),
    rapid = /rapid/i.test(text),
    m = text.match(/(\d+)\s*(?:minutes|min)/i),
    inc = text.match(/(\d+)\s*(?:second|sec)/i);
  const minutes = m ? Number(m[1]) : fast ? 3 : rapid ? 15 : 90,
    increment = inc ? Number(inc[1]) : fast ? 2 : rapid ? 10 : 30;
  return {
    id: `circuit-${minutes}-${increment}`,
    label: `${minutes}+${increment}`,
    base: minutes * 60,
    increment,
    category: fast ? "blitz" : rapid ? "rapid" : "classical",
  };
}
export function sourcedEvents(
  now: GameStamp,
  region: Region,
  horizon: number,
): ScheduledEvent[] {
  const list: ScheduledEvent[] = [];
  for (
    let year = now.year;
    year <= stampFromIndex(stampIndex(now) + horizon).year;
    year++
  )
    for (const r of records.events) {
      const start = weekOf(`${year}${r.startDate.slice(4)}`),
        gap = stampIndex(start) - stampIndex(now);
      if (gap < 0 || gap > horizon) continue;
      const tc = tcOf(r.timeControl ?? r.name),
        deadline = stampFromIndex(
          stampIndex(start) - (tc.category === "classical" ? 3 : 1),
        );
      const end = r.endDate ? weekOf(`${year}${r.endDate.slice(4)}`) : start;
      const national =
        /national.*championship/i.test(r.name) &&
        !/international/i.test(r.name);
      list.push({
        id: `fide-reference-${r.id}-${year}`,
        name: `${r.name.replace(/2026/g, String(year))}${year === 2026 ? "" : " · career edition"}`,
        level: national
          ? "national"
          : tc.category === "classical"
            ? "international"
            : "local",
        ...start,
        fieldSize: Math.max(16, Math.min(128, Number(r.players) || 48)),
        entryFee: tc.category === "classical" ? 45 : 15,
        minElo: 0,
        minReputation: 0,
        registrationDeadline: deadline,
        weeksUntilStart: gap,
        weeksUntilDeadline: stampIndex(deadline) - stampIndex(now),
        invitational: false,
        details: {
          category: national
            ? "National Championships"
            : tc.category === "blitz"
              ? "Blitz Championships"
              : tc.category === "rapid"
                ? "Rapid Championships"
                : "Open Tournaments",
          location: r.city,
          country: r.country,
          end,
          format: "swiss",
          rounds: tc.category === "classical" ? 9 : 7,
          timeControl: tc,
          prize: tc.category === "classical" ? 2500 : 750,
          prestige: tc.category === "classical" ? 45 : 20,
          provenance: "inspired",
          localShare: national ? 1 : 0.5,
          ...(national ? { nationality: r.country } : {}),
          reference: {
            name: r.name,
            url: r.source,
            startDate: r.startDate,
            ...(r.endDate ? { endDate: r.endDate } : {}),
            observedAt: records.observedAt,
            sourceYear: 2026,
          },
        },
      });
    }
  return list;
}
const HOSTS = [
  ["SG", "Singapore"],
  ["MY", "Kuala Lumpur"],
  ["VN", "Ho Chi Minh City"],
  ["IN", "Chennai"],
  ["JP", "Tokyo"],
  ["DE", "Hamburg"],
  ["FR", "Paris"],
  ["ES", "Barcelona"],
  ["NL", "Wijk aan Zee"],
  ["GB-ENG", "London"],
  ["US", "New York"],
  ["CA", "Toronto"],
  ["TH", "Bangkok"],
  ["ID", "Jakarta"],
  ["PH", "Manila"],
  ["KR", "Seoul"],
  ["CN", "Shanghai"],
  ["AE", "Dubai"],
  ["QA", "Doha"],
  ["UZ", "Tashkent"],
  ["KZ", "Almaty"],
  ["GE", "Tbilisi"],
  ["NO", "Oslo"],
  ["SE", "Stockholm"],
  ["IS", "Reykjavik"],
  ["PL", "Warsaw"],
  ["CZ", "Prague"],
  ["IT", "Rome"],
  ["GR", "Athens"],
  ["TR", "Istanbul"],
  ["BR", "Sao Paulo"],
  ["AR", "Buenos Aires"],
  ["MX", "Mexico City"],
  ["ZA", "Cape Town"],
  ["EG", "Cairo"],
  ["KE", "Nairobi"],
  ["AU", "Sydney"],
  ["NZ", "Auckland"],
] as const;
const BRANDS = [
  "Rook & File",
  "Knightfall",
  "Open Board",
  "Clockwork",
  "Crossroads",
  "The Long Game",
  "Four Knights",
  "Next Move",
  "Meridian",
  "Endgame Society",
  "First Rank",
  "Kingside",
];
/** Three foreign events every week across six continents, alongside the existing home circuit. */
export function extraCircuit(
  now: GameStamp,
  region: Region,
  careerId: string,
  horizon: number,
): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  const startIndex = stampIndex(now);
  for (let offset = 1; offset <= horizon; offset++) {
    const abs = startIndex + offset,
      stamp = stampFromIndex(abs),
      key = hashString(`${careerId}:${abs}`);
    const home = stamp.week % 2 === 0;
    for (const { foreign, slot } of [
      ...(home ? [{ foreign: false, slot: 0 }] : []),
      { foreign: true, slot: 0 },
      { foreign: true, slot: 1 },
      { foreign: true, slot: 2 },
    ]) {
      const candidates = HOSTS.filter((h) => h[0] !== region.countryCode),
        host = foreign
          ? candidates[((key % candidates.length) + slot) % candidates.length]
          : [region.countryCode, region.city];
      const rapid = slot === 1 || (slot === 0 && key % 3 === 0),
        blitz = slot === 0 && key % 3 === 1,
        tc = tcOf(
          blitz
            ? "Blitz: 3 minutes with 2 seconds"
            : rapid
              ? "Rapid: 15 minutes with 10 seconds"
              : "Standard: 60 minutes with 30 seconds",
        );
      const deadline = stampFromIndex(abs - (foreign ? 2 : 1)),
        name = `${BRANDS[(key + slot) % BRANDS.length]} ${blitz ? "Blitz" : rapid ? "Rapid" : "Open"} · ${stamp.year}/${String(stamp.week).padStart(2, "0")}${foreign ? (slot === 2 ? " International Challenger" : " Circuit") : " Club"}`;
      out.push({
        id: `qol-circuit-${foreign ? "away" : "home"}-${stamp.year}-${stamp.week}${slot ? `-${slot + 1}` : ""}`,
        name,
        level: slot === 2 ? "international" : "local",
        ...stamp,
        fieldSize: slot === 2 ? 64 : foreign ? 48 : 32,
        entryFee: slot === 2 ? 75 : foreign ? 25 : 10,
        minElo: slot === 2 ? 1800 : 0,
        minReputation: slot === 2 ? 10 : 0,
        registrationDeadline: deadline,
        weeksUntilStart: offset,
        weeksUntilDeadline: stampIndex(deadline) - startIndex,
        invitational: false,
        details: {
          category: "Open Tournaments",
          location: host[1],
          country: host[0],
          end: stamp,
          format: "swiss",
          rounds: 7,
          timeControl: tc,
          prize: slot === 2 ? 3500 : foreign ? 1200 : 400,
          prestige: slot === 2 ? 50 : foreign ? 25 : 10,
          provenance: "fictional",
          localShare: foreign ? 0.4 : 0.7,
        },
      });
    }
  }
  return out;
}
export function withTravel(
  event: ScheduledEvent,
  homeCountry: string,
): ScheduledEvent {
  const d = event.details;
  if (!d) return event;
  const travelCost =
    d.country === homeCountry
      ? 0
      : getCountry(homeCountry)?.continent === getCountry(d.country)?.continent
        ? 60
        : 120;
  return { ...event, details: { ...d, travelCost } };
}
