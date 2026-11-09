import type { GameSave, GameStamp, Npc } from "@/types";
import type { Region, ScheduledEvent } from "@/game/world/schedule";
import { stampFromIndex, stampIndex } from "./catalog";

export function showcaseEvents(
  now: GameStamp,
  region: Region,
  horizon: number,
): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  for (
    let year = now.year;
    year <= stampFromIndex(stampIndex(now) + horizon).year;
    year++
  ) {
    for (const week of [20, 44]) {
      const when = { year, week },
        gap = stampIndex(when) - stampIndex(now);
      if (gap < 0 || gap > horizon) continue;
      const deadline = stampFromIndex(stampIndex(when) - 3);
      out.push({
        id: `showcase-rising-stars-${year}-${week}`,
        name: `Next Generation Nations Showcase · ${year}/${week}`,
        ...when,
        level: "international",
        fieldSize: 250,
        entryFee: 0,
        minElo: 0,
        minReputation: 0,
        registrationDeadline: deadline,
        weeksUntilStart: gap,
        weeksUntilDeadline: stampIndex(deadline) - stampIndex(now),
        invitational: true,
        details: {
          category: "Invitational Showmatches",
          country: region.countryCode,
          location: region.city,
          end: when,
          format: "swiss",
          rounds: 10,
          timeControl: {
            id: "showcase-rapid",
            label: "15+10",
            base: 900,
            increment: 10,
            category: "rapid",
          },
          prize: 10000,
          prestige: 60,
          provenance: "fictional",
          organizer: {
            name: "Next Generation Chess Foundation",
            status: "Unofficial",
            simulated: true,
          },
          showcase: { countries: 50, perCountry: 5, maxAge: 25 },
        },
      });
    }
  }
  return out;
}

/** Selection is sporting, not random: top five active under-26 players per represented country.
 * The 50 strongest delegations by average rating are invited; no invented NPCs fill absent countries. */
export function showcaseSelection(
  save: GameSave,
  event: Pick<ScheduledEvent, "details">,
  npcs: Npc[],
): { entrants: Npc[]; invited: boolean; countries: number } {
  const rule = event.details?.showcase;
  if (!rule) return { entrants: [], invited: false, countries: 0 };
  const groups = new Map<string, { id: string; rating: number; npc?: Npc }[]>();
  for (const n of npcs) {
    if (
      n.age > rule.maxAge ||
      !["active", "semi-retired"].includes(n.careerStatus)
    )
      continue;
    const g = groups.get(n.nationality) ?? [];
    g.push({ id: n.id, rating: n.currentElo, npc: n });
    groups.set(n.nationality, g);
  }
  if (save.player.age <= rule.maxAge) {
    const g = groups.get(save.player.country) ?? [];
    g.push({ id: "player", rating: save.player.rating });
    groups.set(save.player.country, g);
  }
  const delegations = [...groups.entries()]
    .map(([country, group]) => {
      const players = group
        .sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id))
        .slice(0, rule.perCountry);
      return {
        country,
        players,
        average: players.reduce((sum, p) => sum + p.rating, 0) / players.length,
      };
    })
    .sort((a, b) => b.average - a.average || a.country.localeCompare(b.country))
    .slice(0, rule.countries);
  const selected = delegations.flatMap((d) => d.players);
  return {
    entrants: selected.flatMap((p) => (p.npc ? [p.npc] : [])),
    invited: selected.some((p) => p.id === "player"),
    countries: delegations.length,
  };
}
