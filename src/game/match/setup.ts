import { getCountry } from '@/data/world/countries';
import { TITLE_LADDER } from '@/data/titles';
import { createRng, mixSeed } from '@/game/rng';
import { accuracyBonusFor } from '@/game/history/recordGame';
import type { OpeningDatabase } from '@/game/openings/database';
import { linesFromEntries, opponentFromNpc, type Opponent } from '@/game/play/opponent';
import type { ChessTitle, GameSave, MatchSide, MatchTimeControl, MatchTournamentInfo, Npc, PieceColor } from '@/types';
import { buildNpcProfile, buildPlayerProfile } from './npcProfile';
import type { MatchSetup, Speed } from './session';

/** The highest title the player has earned. */
export function highestTitle(save: GameSave): ChessTitle {
  let best: ChessTitle = 'none';
  let bestIndex = -1;
  for (const t of save.history.titles) {
    const i = TITLE_LADDER.findIndex((s) => s.id === t.title);
    if (i > bestIndex) {
      bestIndex = i;
      best = t.title;
    }
  }
  return best;
}

const nationalityOf = (code: string): { nationality: string; flag: string } => {
  const c = getCountry(code);
  return { nationality: c?.nationality ?? c?.name ?? code, flag: c?.flag ?? '' };
};

export function sideForNpc(npc: Npc): MatchSide {
  return { id: npc.id, name: npc.name, elo: npc.currentElo, title: npc.title, countryCode: npc.nationality, ...nationalityOf(npc.nationality), isPlayer: false };
}

export function sideForPlayer(save: GameSave): MatchSide {
  const p = save.player;
  return { id: null, name: p.name, elo: p.rating, title: highestTitle(save), countryCode: p.country, ...nationalityOf(p.country), isPlayer: true };
}

/** The opening lines the player's repertoire gives for a colour, so a simulated player follows the player's own preparation. */
export function playerLines(db: OpeningDatabase, save: GameSave): Opponent['lines'] {
  return linesFromEntries(db, [...save.repertoire.preferences.white, ...save.repertoire.preferences.black]);
}

export interface SetupInput {
  save: GameSave;
  npc: Npc;
  playerColor: PieceColor;
  timeControl: MatchTimeControl;
  rated: boolean;
  mode: 'play' | 'simulate';
  speed: Speed;
  tournament: MatchTournamentInfo | null;
  seed: number;
  db: OpeningDatabase;
  /** Plays the opponent at this rating instead of its own */
  eloOverride?: number | null;
}

/** Everything a match needs: both sides' details and the strength profile of each simulated player. */
export function buildMatchSetup(input: SetupInput): MatchSetup {
  const { save, npc, playerColor, db } = input;
  const rng = createRng(mixSeed(input.seed, 0x77));
  const round = input.tournament?.round ?? 1;
  const npcProfile = buildNpcProfile(npc, opponentFromNpc(npc).lines, { rng, round, baseEloOverride: input.eloOverride ?? undefined });
  const playerProfile = buildPlayerProfile(save.player, save.training.fatigue, playerLines(db, save));
  const player = sideForPlayer(save);
  const opponent = sideForNpc(npc);
  const npcColor: PieceColor = playerColor === 'white' ? 'black' : 'white';
  return {
    white: playerColor === 'white' ? player : opponent,
    black: playerColor === 'white' ? opponent : player,
    playerColor,
    timeControl: input.timeControl,
    rated: input.rated,
    tournament: input.tournament,
    accuracyBonus: input.rated ? accuracyBonusFor(save, npc.id, input.tournament?.id ?? null) : 0,
    profiles: { [playerColor]: playerProfile, [npcColor]: npcProfile } as MatchSetup['profiles'],
    mode: input.mode,
    speed: input.speed,
    seed: input.seed,
  };
}
