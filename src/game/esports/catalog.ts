import type { EsportsEvent, EsportsTier } from "./types";
import { hashString } from "@/utils/format";
export const ESPORTS_TIERS: {
  id: EsportsTier;
  min: number;
  max: number;
  prize: number;
}[] = [
  { id: "D", min: 1800, max: 2000, prize: 600 },
  { id: "C", min: 2001, max: 2200, prize: 1800 },
  { id: "B", min: 2201, max: 2500, prize: 6000 },
  { id: "A", min: 2501, max: 2699, prize: 20000 },
  { id: "S", min: 2700, max: Infinity, prize: 100000 },
];
export const tierRule = (id: EsportsTier) =>
  ESPORTS_TIERS.find((t) => t.id === id)!;
export const esportsTier = (rating: number): EsportsTier | null =>
  ESPORTS_TIERS.find((t) => rating >= t.min && rating <= t.max)?.id ?? null;
export const ORGANIZATIONS = [
  {
    id: "rookhouse",
    name: "Rookhouse Gaming",
    min: 1750,
    prestige: 18,
    salary: 40,
  },
  {
    id: "clockwork",
    name: "Clockwork Collective",
    min: 1850,
    prestige: 25,
    salary: 60,
  },
  {
    id: "meridian",
    name: "Meridian Esports",
    min: 2000,
    prestige: 38,
    salary: 90,
  },
  {
    id: "nextmove",
    name: "Next Move United",
    min: 2150,
    prestige: 45,
    salary: 120,
  },
  {
    id: "silverline",
    name: "Silverline Knights",
    min: 2250,
    prestige: 55,
    salary: 160,
  },
  {
    id: "kingside",
    name: "Kingside Syndicate",
    min: 2400,
    prestige: 65,
    salary: 220,
  },
  { id: "vertex", name: "Vertex Gaming", min: 2500, prestige: 75, salary: 300 },
  { id: "aurora", name: "Aurora Elite", min: 2600, prestige: 82, salary: 400 },
  { id: "crown", name: "Apex Crown", min: 2700, prestige: 96, salary: 700 },
  {
    id: "obsidian",
    name: "Obsidian Royal",
    min: 2750,
    prestige: 100,
    salary: 850,
  },
] as const;
/** Inspiration only. Elo bands, team formats, all names and schedules below are game rules. */
export const ESPORTS_REFERENCES = [
  "Portal:Tournaments",
  "S-Tier_Tournaments",
  "A-Tier_Tournaments",
  "B-Tier_Tournaments",
  "C-Tier_Tournaments",
  "D-Tier_Tournaments",
  "Monthly_Tournaments",
  "Weekly_Tournaments",
  "Qualifier_Tournaments",
].map((path) => ({
  name: path.replaceAll("_", " "),
  url: `https://liquipedia.net/chess/${path}`,
}));
const NAMES: Record<EsportsTier, string[]> = {
  D: ["Rising Rooks", "Open Board Academy", "First Rank"],
  C: ["Challenger Grid", "Next Move Masters", "Clockwork Cup"],
  B: ["Contenders Tour", "Clutch Board", "Pro Circuit"],
  A: ["Elite Speed Series", "Grandboard Invitational", "Premier Chess Clash"],
  S: [
    "World Esports Chess Crown",
    "Champions Circuit Finals",
    "Global Speed Chess Summit",
  ],
};
export function esportsEvents(
  day: number,
  careerId: string,
  horizon = 91,
): EsportsEvent[] {
  const out: EsportsEvent[] = [];
  for (let at = day; at <= day + horizon; at++)
    for (const tier of ESPORTS_TIERS) {
      const year = Math.floor(at / 364),
        date = new Date(Date.UTC(year, 0, 1 + at - year * 364)),
        monthlyDay = date.getUTCDate();
      const cadence =
        monthlyDay === 23
          ? "Monthly"
          : monthlyDay === 4 || monthlyDay === 18
            ? "Qualifier"
            : at % 7 === 5
              ? "Weekly"
              : null;
      if (!cadence) continue;
      const hash = hashString(`${careerId}:${at}:${tier.id}`),
        size = (hash % 2 ? 2 : 3) as 2 | 3;
      out.push({
        id: `esports-${tier.id}-${at}-${cadence}`,
        name: `${NAMES[tier.id][hash % 3]} ${cadence} · ${year}/${date.getUTCMonth() + 1}`,
        tier: tier.id,
        cadence,
        size,
        day: at,
        days: cadence === "Monthly" ? 7 : cadence === "Qualifier" ? 1 : 3,
        deadline: at - (cadence === "Monthly" ? 5 : 1),
        fee:
          cadence === "Qualifier"
            ? 0
            : tier.id === "D"
              ? 10
              : tier.id === "C"
                ? 20
                : tier.id === "B"
                  ? 40
                  : tier.id === "A"
                    ? 80
                    : 150,
        prize: Math.round(
          tier.prize *
            (cadence === "Monthly" ? 3 : cadence === "Qualifier" ? 0.25 : 1),
        ),
        timeControl: {
          id: "esports-5+3",
          label: "5+3",
          base: 300,
          increment: 3,
          category: "blitz",
        },
        organizer:
          cadence === "Qualifier"
            ? "Open Board Esports League"
            : "World Chess Gaming Circuit",
        status: cadence === "Monthly" ? "Official" : "Unofficial",
      });
    }
  return out;
}
