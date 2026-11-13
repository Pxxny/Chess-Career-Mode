import { COUNTRIES, getCountry } from "@/data/world/countries";
import { getSeedCities } from "@/data/world/seedCities";
import { normalizeText } from "@/utils/text";
import { hashString } from "@/utils/format";
import type { Region, ScheduledEvent } from "@/game/world/schedule";

export const TOURNAMENT_CONTINENTS = ["Asia", "Europe", "North America", "South America", "Africa", "Oceania"] as const;
export const matchesVenueContinent = (country: string | undefined, continent: string): boolean =>
  continent === "all" || (!!country && getCountry(country)?.continent === continent);

const countries = COUNTRIES.filter((c) => c.continent !== "Antarctica" && (c.status === "sovereign" || c.status === "additional") && (c.capital || getSeedCities(c.code).length));
const sameCity = (a: string, b: string) => normalizeText(a) === normalizeText(b);
const citiesFor = (country: string) => [...new Set([...(getCountry(country)?.capital ? [getCountry(country)!.capital!] : []), ...getSeedCities(country).slice(0, 12)])];
const fixedHost = (e: ScheduledEvent) => !!(e.details?.reference || e.details?.historicalSchedule || e.details?.host);

/** An annual allocation: 20% hometown, 80% elsewhere, without moving sourced or regional team venues. */
export function distributeAnnualVenues(events: ScheduledEvent[], region: Region, careerId: string): ScheduledEvent[] {
  const hometown = region.birthPlace ?? { countryCode: region.countryCode, city: region.city };
  const isHome = (e: ScheduledEvent) => e.details?.country === hometown.countryCode && sameCity(e.details.location, hometown.city);
  const physical = events.filter((e) => e.details && e.details.host?.mode !== "online");
  const movable = physical.filter((e) => !fixedHost(e));
  const permitsHome = (e: ScheduledEvent) =>
    (!e.details!.nationality || e.details!.nationality === hometown.countryCode) &&
    (e.details!.category !== "Continental Championships" || getCountry(hometown.countryCode)?.continent === region.continent);
  const domesticAlternatives = (country: string) => citiesFor(country).filter((city) => country !== hometown.countryCode || !sameCity(city, hometown.city));
  const forcedHome = movable.filter((e) => e.details!.nationality === hometown.countryCode && !domesticAlternatives(hometown.countryCode).length);
  const fixedHome = physical.filter((e) => fixedHost(e) && isHome(e)).length;
  const target = Math.max(forcedHome.length, Math.round(physical.length * 0.2) - fixedHome);
  const order = (a: ScheduledEvent, b: ScheduledEvent) => hashString(`${careerId}:home:${a.id}`) - hashString(`${careerId}:home:${b.id}`) || a.id.localeCompare(b.id);
  const homeIds = new Set(forcedHome.map((e) => e.id));
  for (const e of movable.filter(permitsHome).sort(order)) {
    if (homeIds.size >= target) break;
    homeIds.add(e.id);
  }
  // Stable ordering makes every calendar/finder/horizon agree on the same event host.
  const awayOrder = [...movable].sort((a, b) => a.id.localeCompare(b.id));
  const awayIndices = new Map(awayOrder.filter((e) => !homeIds.has(e.id)).map((e, i) => [e.id, i]));
  return events.map((event) => {
    const d = event.details;
    if (!d || fixedHost(event)) return event;
    const key = hashString(`${careerId}:venue:${event.id}`), index = awayIndices.get(event.id) ?? 0;
    let country = hometown.countryCode, city = hometown.city;
    if (!homeIds.has(event.id)) {
      const domestic = domesticAlternatives(region.countryCode);
      if (d.nationality) {
        country = d.nationality;
        const pool = domesticAlternatives(country);
        city = pool[key % pool.length] ?? citiesFor(country)[0] ?? d.location;
      } else if (index % 4 === 0 && domestic.length && d.category !== "Continental Championships") {
        // Some away fixtures visit other cities in the player's represented country.
        country = region.countryCode;
        city = domestic[key % domestic.length];
      } else {
        const continent = d.category === "Continental Championships" ? region.continent : TOURNAMENT_CONTINENTS[index % TOURNAMENT_CONTINENTS.length];
        let pool = countries.filter((c) => c.continent === continent && c.code !== hometown.countryCode);
        if (!pool.length) pool = countries.filter((c) => c.code !== hometown.countryCode);
        const host = pool[key % pool.length];
        country = host?.code ?? region.countryCode;
        const cityPool = domesticAlternatives(country);
        city = cityPool[Math.floor(key / Math.max(1, pool.length)) % cityPool.length] ?? citiesFor(country)[0] ?? d.location;
      }
    }
    const host = getCountry(country);
    const name = d.venueNamePattern
      ? d.venueNamePattern.replaceAll("{city}", city).replaceAll("{demonym}", host?.nationality ?? country).replaceAll("{continent}", host?.continent ?? region.continent)
      : event.name;
    return { ...event, name, details: { ...d, country, location: city } };
  });
}
