import type { Appearance } from './appearance';
import type { ArchetypeId } from './archetype';
import type { PlayerCity } from './geo';
import type { Player, PlayerGender } from './player';
import type { World } from './world';

/** The permanent link between a player, their country and city, their historical period and their NPC database. */
export interface CareerRecord {
  id: string;
  startYear: number;
  countryCode: string;
  city: PlayerCity;
  createdAt: number;
  /** Key of the NPC database built for this career: `<world seed>:<start year>:<career id>` */
  databaseKey: string;
}

export interface GameSave {
  version: number;
  career: CareerRecord;
  player: Player;
  world: World;
}

export interface NewCareerOptions {
  name: string;
  gender: PlayerGender;
  countryCode: string;
  city: PlayerCity;
  archetype: ArchetypeId;
  appearance: Appearance;
  startYear: number;
  alternateHistory: boolean;
}
