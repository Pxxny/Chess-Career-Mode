export const REPUTATION_LEVELS = [
  { min: 0, label: 'Unknown' },
  { min: 10, label: 'Local name' },
  { min: 30, label: 'Regional figure' },
  { min: 60, label: 'National name' },
  { min: 100, label: 'International name' },
  { min: 200, label: 'World-renowned' },
] as const;

/** Offers open to a player who meets both requirements. `monthly` is paid per game month once a sponsorship system accepts it. */
export const SPONSORSHIPS = [
  { id: 'local-club', name: 'Local chess club sponsorship', minReputation: 10, minElo: 1300, monthly: 40 },
  { id: 'regional-shop', name: 'Regional chess retailer deal', minReputation: 30, minElo: 1700, monthly: 120 },
  { id: 'federation', name: 'National federation support', minReputation: 60, minElo: 2100, monthly: 400 },
  { id: 'brand', name: 'International brand ambassador', minReputation: 100, minElo: 2400, monthly: 1500 },
] as const;
