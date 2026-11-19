import { hashString } from "@/utils/format";
import type { GameStamp } from "@/types";

export const REPUTATION_LEVELS = [
  { min: 0, label: 'Unknown' },
  { min: 10, label: 'Local name' },
  { min: 30, label: 'Regional figure' },
  { min: 60, label: 'National name' },
  { min: 100, label: 'International name' },
  { min: 200, label: 'World-renowned' },
] as const;

/** Offers open to a player who meets both requirements. `monthly` is paid per game month once a sponsorship system accepts it. */
export interface SponsorDefinition { id:string; name:string; minReputation:number; minElo:number; monthly:number; marketWeight:number; headquarters: {city:string; country:string; executive:string} }
export const SPONSORSHIPS: readonly SponsorDefinition[] = [
  { id: 'local-club', name: 'Local chess club sponsorship', minReputation: 10, minElo: 1300, monthly: 40, marketWeight: 1, headquarters: { city: "Bangkok", country: "TH", executive: "Niran Wattanakul" } },
  { id: 'regional-shop', name: 'Regional chess retailer deal', minReputation: 30, minElo: 1700, monthly: 120, marketWeight: 3, headquarters: { city: "Utrecht", country: "NL", executive: "Mara van Vliet" } },
  { id: 'federation', name: 'National federation support', minReputation: 60, minElo: 2100, monthly: 400, marketWeight: 6, headquarters: { city: "Reykjavík", country: "IS", executive: "Elín Sigurðardóttir" } },
  { id: 'brand', name: 'International brand ambassador', minReputation: 100, minElo: 2400, monthly: 1500, marketWeight: 10, headquarters: { city: "Geneva", country: "CH", executive: "Camille Reymond" } },
  { id: 'aurora-horizon', name: 'Aurora Horizon', minReputation: 5, minElo: 1150, monthly: 25, marketWeight: 1, headquarters: { city: "Helsinki", country: "FI", executive: "Aino Salmi" } },
  { id: 'lumen-grove', name: 'Lumen Grove', minReputation: 8, minElo: 1250, monthly: 35, marketWeight: 2, headquarters: { city: "Dublin", country: "IE", executive: "Niamh Keane" } },
  { id: 'cloverstone', name: 'Cloverstone', minReputation: 12, minElo: 1350, monthly: 50, marketWeight: 3, headquarters: { city: "Bristol", country: "GB", executive: "Rowan Ellis" } },
  { id: 'ember-finch', name: 'Ember Finch', minReputation: 16, minElo: 1450, monthly: 65, marketWeight: 4, headquarters: { city: "Lisbon", country: "PT", executive: "Inês Duarte" } },
  { id: 'willow-crest', name: 'Willow Crest', minReputation: 22, minElo: 1550, monthly: 85, marketWeight: 5, headquarters: { city: "Stockholm", country: "SE", executive: "Maja Lindholm" } },
  { id: 'silverbrook', name: 'Silverbrook', minReputation: 28, minElo: 1650, monthly: 110, marketWeight: 6, headquarters: { city: "Edinburgh", country: "GB", executive: "Isla Fraser" } },
  { id: 'meridian-pulse', name: 'Meridian Pulse', minReputation: 35, minElo: 1750, monthly: 150, marketWeight: 7, headquarters: { city: "Montréal", country: "CA", executive: "Émile Gagnon" } },
  { id: 'cobalt-lantern', name: 'Cobalt Lantern', minReputation: 42, minElo: 1850, monthly: 200, marketWeight: 8, headquarters: { city: "Copenhagen", country: "DK", executive: "Sofie Lund" } },
  { id: 'novara-works', name: 'Novara Works', minReputation: 50, minElo: 1950, monthly: 280, marketWeight: 9, headquarters: { city: "Milan", country: "IT", executive: "Giulia Serafini" } },
  { id: 'velora-labs', name: 'Velora Labs', minReputation: 60, minElo: 2050, monthly: 380, marketWeight: 10, headquarters: { city: "Taipei", country: "TW", executive: "Lin Jia-Wei" } },
  { id: 'solstice-union', name: 'Solstice Union', minReputation: 70, minElo: 2150, monthly: 520, marketWeight: 11, headquarters: { city: "Oslo", country: "NO", executive: "Nora Solberg" } },
  { id: 'asterion-group', name: 'Asterion Group', minReputation: 80, minElo: 2250, monthly: 700, marketWeight: 12, headquarters: { city: "Vienna", country: "AT", executive: "Lukas Leitner" } },
  { id: 'heliora-systems', name: 'Heliora Systems', minReputation: 95, minElo: 2350, monthly: 950, marketWeight: 13, headquarters: { city: "Singapore", country: "SG", executive: "Tan Wei Ming" } },
  { id: 'orivelle-capital', name: 'Orivelle Capital', minReputation: 110, minElo: 2400, monthly: 1300, marketWeight: 14, headquarters: { city: "Auckland", country: "NZ", executive: "Aroha Clarke" } },
  { id: 'zenith-arc', name: 'Zenith Arc', minReputation: 125, minElo: 2450, monthly: 1750, marketWeight: 15, headquarters: { city: "Seoul", country: "KR", executive: "Seo Min-jun" } },
  { id: 'vespera-global', name: 'Vespera Global', minReputation: 140, minElo: 2500, monthly: 2300, marketWeight: 16, headquarters: { city: "Luxembourg", country: "LU", executive: "Léa Weber" } },
  { id: 'lumivex-industries', name: 'Lumivex Industries', minReputation: 155, minElo: 2550, monthly: 3000, marketWeight: 17, headquarters: { city: "Tokyo", country: "JP", executive: "Hana Mori" } },
  { id: 'astravelle-holdings', name: 'Astravelle Holdings', minReputation: 175, minElo: 2600, monthly: 3900, marketWeight: 18, headquarters: { city: "Amsterdam", country: "NL", executive: "Sander de Vries" } },
  { id: 'crownspire-international', name: 'Crownspire International', minReputation: 200, minElo: 2700, monthly: 5200, marketWeight: 19, headquarters: { city: "Sydney", country: "AU", executive: "Talia Bennett" } },
  { id: 'celestara-dominion', name: 'Celestara Dominion', minReputation: 230, minElo: 2800, monthly: 7000, marketWeight: 20, headquarters: { city: "Paris", country: "FR", executive: "Adrien Laurent" } },
  { id: 'powervant', name: 'Powervant', minReputation: 90, minElo: 2300, monthly: 840, marketWeight: 12, headquarters: { city: "Chicago", country: "US", executive: "Jordan Hale" } },
  { id: 'keenly', name: 'Keenly', minReputation: 24, minElo: 1550, monthly: 95, marketWeight: 5, headquarters: { city: "Tallinn", country: "EE", executive: "Kärt Saar" } },
  { id: 'saswell', name: 'Saswell', minReputation: 48, minElo: 1900, monthly: 250, marketWeight: 8, headquarters: { city: "Brno", country: "CZ", executive: "Klára Novotná" } },
  { id: 'highpro', name: 'Highpro', minReputation: 115, minElo: 2450, monthly: 1500, marketWeight: 14, headquarters: { city: "Hamburg", country: "DE", executive: "Milan Berger" } },
  { id: 'logg', name: 'LogG', minReputation: 0, minElo: 0, monthly: 15, marketWeight: 0.35, headquarters: { city: "Chiang Mai", country: "TH", executive: "Pim Arunrat" } },
];

/** Calendar months use the same 364-day season as the competition calendar. */
export const sponsorMonth = ({ year, week }: GameStamp, day = 1) =>
  year * 12 + new Date(Date.UTC(year, 0, (week - 1) * 7 + day)).getUTCMonth();

function monthlyWeight(sponsor: SponsorDefinition, month: number): number {
  const interest = (hashString(`${sponsor.id}:${month}:audience`) % 41 - 20) / 100;
  const momentum = (hashString(`${sponsor.id}:${month - 1}:audience`) % 21 - 10) / 100;
  return sponsor.marketWeight * (1 + interest + momentum);
}

export const sponsorMarketShare = (sponsor: SponsorDefinition, month?: number) => {
  const weight = (entry: SponsorDefinition) => month === undefined ? entry.marketWeight : monthlyWeight(entry, month);
  return weight(sponsor) / SPONSORSHIPS.reduce((sum, entry) => sum + weight(entry), 0) * 100;
};
