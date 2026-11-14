export const REPUTATION_LEVELS = [
  { min: 0, label: 'Unknown' },
  { min: 10, label: 'Local name' },
  { min: 30, label: 'Regional figure' },
  { min: 60, label: 'National name' },
  { min: 100, label: 'International name' },
  { min: 200, label: 'World-renowned' },
] as const;

/** Offers open to a player who meets both requirements. `monthly` is paid per game month once a sponsorship system accepts it. */
export interface SponsorDefinition { id:string; name:string; minReputation:number; minElo:number; monthly:number; marketWeight:number }
export const SPONSORSHIPS: readonly SponsorDefinition[] = [
  { id: 'local-club', name: 'Local chess club sponsorship', minReputation: 10, minElo: 1300, monthly: 40, marketWeight: 1 },
  { id: 'regional-shop', name: 'Regional chess retailer deal', minReputation: 30, minElo: 1700, monthly: 120, marketWeight: 3 },
  { id: 'federation', name: 'National federation support', minReputation: 60, minElo: 2100, monthly: 400, marketWeight: 6 },
  { id: 'brand', name: 'International brand ambassador', minReputation: 100, minElo: 2400, monthly: 1500, marketWeight: 10 },
  { id: 'aurora-horizon', name: 'Aurora Horizon', minReputation: 5, minElo: 1150, monthly: 25, marketWeight: 1 },
  { id: 'lumen-grove', name: 'Lumen Grove', minReputation: 8, minElo: 1250, monthly: 35, marketWeight: 2 },
  { id: 'cloverstone', name: 'Cloverstone', minReputation: 12, minElo: 1350, monthly: 50, marketWeight: 3 },
  { id: 'ember-finch', name: 'Ember Finch', minReputation: 16, minElo: 1450, monthly: 65, marketWeight: 4 },
  { id: 'willow-crest', name: 'Willow Crest', minReputation: 22, minElo: 1550, monthly: 85, marketWeight: 5 },
  { id: 'silverbrook', name: 'Silverbrook', minReputation: 28, minElo: 1650, monthly: 110, marketWeight: 6 },
  { id: 'meridian-pulse', name: 'Meridian Pulse', minReputation: 35, minElo: 1750, monthly: 150, marketWeight: 7 },
  { id: 'cobalt-lantern', name: 'Cobalt Lantern', minReputation: 42, minElo: 1850, monthly: 200, marketWeight: 8 },
  { id: 'novara-works', name: 'Novara Works', minReputation: 50, minElo: 1950, monthly: 280, marketWeight: 9 },
  { id: 'velora-labs', name: 'Velora Labs', minReputation: 60, minElo: 2050, monthly: 380, marketWeight: 10 },
  { id: 'solstice-union', name: 'Solstice Union', minReputation: 70, minElo: 2150, monthly: 520, marketWeight: 11 },
  { id: 'asterion-group', name: 'Asterion Group', minReputation: 80, minElo: 2250, monthly: 700, marketWeight: 12 },
  { id: 'heliora-systems', name: 'Heliora Systems', minReputation: 95, minElo: 2350, monthly: 950, marketWeight: 13 },
  { id: 'orivelle-capital', name: 'Orivelle Capital', minReputation: 110, minElo: 2400, monthly: 1300, marketWeight: 14 },
  { id: 'zenith-arc', name: 'Zenith Arc', minReputation: 125, minElo: 2450, monthly: 1750, marketWeight: 15 },
  { id: 'vespera-global', name: 'Vespera Global', minReputation: 140, minElo: 2500, monthly: 2300, marketWeight: 16 },
  { id: 'lumivex-industries', name: 'Lumivex Industries', minReputation: 155, minElo: 2550, monthly: 3000, marketWeight: 17 },
  { id: 'astravelle-holdings', name: 'Astravelle Holdings', minReputation: 175, minElo: 2600, monthly: 3900, marketWeight: 18 },
  { id: 'crownspire-international', name: 'Crownspire International', minReputation: 200, minElo: 2700, monthly: 5200, marketWeight: 19 },
  { id: 'celestara-dominion', name: 'Celestara Dominion', minReputation: 230, minElo: 2800, monthly: 7000, marketWeight: 20 },
];

/** Share of the fictional chess sponsorship market, with all firms totaling 100%. */
export const sponsorMarketShare = (sponsor: SponsorDefinition) => sponsor.marketWeight / SPONSORSHIPS.reduce((sum, s) => sum + s.marketWeight, 0) * 100;
