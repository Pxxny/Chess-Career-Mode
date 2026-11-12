import type { Appearance } from "./appearance";
import type { ArchetypeId } from "./archetype";
import type { PlayerCity } from "./geo";
import type { CareerHistory } from "./history";
import type {
  ActiveTournament,
  EventRegistration,
  MatchRecord,
  PendingMatch,
} from "./match";
import type { PracticeState, RepertoireState } from "./play";
import type { TrainingState } from "./training";
import type { Player, PlayerGender } from "./player";
import type { World } from "./world";

/** The permanent link between a player, their country and city, their historical period and their NPC database. */
export interface CareerRecord {
  playerDatabase?: import("@/game/npc/playerDatabase").PlayerDatabaseSize;
  id: string;
  startYear: number;
  countryCode: string;
  city: PlayerCity;
  createdAt: number;
  /** Key of the NPC database built for this career: `<world seed>:<start year>:<career id>` */
  databaseKey: string;
}

export interface GameSave {
  highlights?: import("@/game/career/highlights").CareerHighlights;
  matchArchivePending?: MatchRecord[];
  seasonSimulation?: import("@/game/career/seasonSimulation").SeasonSimulation;
  calendarTournaments?: import("@/game/competition/worldCalendar").CalendarTournamentState;
  tournamentArchivePending?: import("@/game/competition/archive").ArchivedEvent[];
  planning?: import("@/game/career/planning").PlanningState;
  sponsorship?: import("@/game/career/business").SponsorshipState;
  legacy?: import("@/game/career/business").LegacyState;
  social?: import("@/game/social/relationships").SocialState;
  yearReview?: import("@/game/career/yearReview").YearReviewState;
  prediction?: import("@/game/prediction/types").PredictionState;
  esports?: import("@/game/esports/types").EsportsState;
  npcNameVersion?: number;
  qol?: import("@/game/qol/career").QolState;
  competition?: import("@/game/competition/types").CompetitionState;
  expansion?: import("@/game/career/expansion").ExpansionState;
  version: number;
  career: CareerRecord;
  player: Player;
  world: World;
  history: CareerHistory;
  training: TrainingState;
  /** Practice games (training, online blitz, engine) and the blitz rating. Added in save version 6. */
  practice: PracticeState;
  /** Opening preferences and study. Added in save version 6. */
  repertoire: RepertoireState;
  /** Finished matches with their analysis (rated career games and friendlies). Added in save version 7. */
  matches: MatchRecord[];
  /** The tournament the player is currently playing, or the one that just finished. Added in save version 7. */
  tournament: ActiveTournament | null;
  /** Checkpoint of a human-played match, recovered as an abandoned game after a reload. Added in save version 7. */
  pendingMatch: PendingMatch | null;
  /** Events the player has registered for and paid. */
  registrations: EventRegistration[];
}

export interface NewCareerOptions {
  playerDatabase?: import("@/game/npc/playerDatabase").PlayerDatabaseSize;
  birthPlace?: import("./geo").BirthPlace;
  name: string;
  gender: PlayerGender;
  countryCode: string;
  city: PlayerCity;
  archetype: ArchetypeId;
  appearance: Appearance;
  startYear: number;
  alternateHistory: boolean;
  /** ISO date (YYYY-MM-DD). Without one the player is born mid-year so that they are `startingAge` on the first day. */
  dateOfBirth?: string;
}
