import type { Federation } from '@/types';

/**
 * FIDE federation codes mostly equal the ISO 3166-1 alpha-3 code.
 * These are the exceptions (keyed by ISO alpha-3).
 */
const FIDE_CODE_OVERRIDES: Record<string, string> = {
  DZA: 'ALG', AGO: 'ANG', ATG: 'ANT', ABW: 'ARU', BHS: 'BAH', BGD: 'BAN', BRB: 'BAR', BMU: 'BER',
  BTN: 'BHU', BWA: 'BOT', BRN: 'BRU', BGR: 'BUL', BFA: 'BUR', KHM: 'CAM', CYM: 'CAY', COG: 'CGO',
  TCD: 'CHA', CHL: 'CHI', CRI: 'CRC', HRV: 'CRO', DNK: 'DEN', SLV: 'ESA', GMB: 'GAM', DEU: 'GER',
  GRC: 'GRE', GRD: 'GRN', GTM: 'GUA', GIN: 'GUI', HTI: 'HAI', HND: 'HON', IDN: 'INA', IRN: 'IRI',
  VIR: 'ISV', VGB: 'IVB', SAU: 'KSA', KWT: 'KUW', LVA: 'LAT', LBY: 'LBA', LSO: 'LES', LBN: 'LIB',
  MDG: 'MAD', MYS: 'MAS', MWI: 'MAW', MNG: 'MGL', MUS: 'MRI', MRT: 'MTN', MMR: 'MYA', MCO: 'MNC',
  NIC: 'NCA', NLD: 'NED', NPL: 'NEP', NGA: 'NGR', OMN: 'OMA', PRY: 'PAR', PHL: 'PHI', PSE: 'PLE',
  PRT: 'POR', PRI: 'PUR', ZAF: 'RSA', WSM: 'SAM', SYC: 'SEY', SGP: 'SIN', KNA: 'SKN', SVN: 'SLO',
  SLB: 'SOL', LKA: 'SRI', SDN: 'SUD', CHE: 'SUI', TZA: 'TAN', TON: 'TGA', TGO: 'TOG', TWN: 'TPE',
  ARE: 'UAE', URY: 'URU', VUT: 'VAN', VNM: 'VIE', VCT: 'VIN', ZMB: 'ZAM', ZWE: 'ZIM', UNK: 'KOS',
};

/** Well-known federations with a proper name; all others get "<Country> Chess Federation". */
const FEDERATION_NAMES: Record<string, string> = {
  RUS: 'Chess Federation of Russia', USA: 'US Chess Federation', IND: 'All India Chess Federation',
  CHN: 'Chinese Chess Association', DEU: 'Deutscher Schachbund', FRA: 'Fédération Française des Échecs',
  ESP: 'Federación Española de Ajedrez', NLD: 'Royal Dutch Chess Federation', GBR: 'British Chess Federation',
  ENG: 'English Chess Federation', SCO: 'Chess Scotland', WLS: 'Welsh Chess Union',
  CUB: 'Federación Cubana de Ajedrez', ARM: 'Chess Federation of Armenia', UKR: 'Ukrainian Chess Federation',
  AZE: 'Azerbaijan Chess Federation', ITA: 'Federazione Scacchistica Italiana', NOR: 'Norwegian Chess Federation',
};

export function buildFederation(code3: string, countryName: string): Federation {
  const code = FIDE_CODE_OVERRIDES[code3] ?? code3;
  return { code, name: FEDERATION_NAMES[code3] ?? `${countryName} Chess Federation` };
}
