import { GAME_CONFIG } from '@/data/config';
import type { CareerHistory, GameStamp, Player } from '@/types';
import { weeksBetween } from '../history/createHistory';

export interface MoraleFactor {
  label: string;
  value: number;
  note: string;
}

export interface Morale {
  value: number;
  label: string;
  factors: MoraleFactor[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function moraleLabel(value: number): string {
  if (value >= 85) return 'Excellent';
  if (value >= 70) return 'Good';
  if (value >= 50) return 'Steady';
  if (value >= 30) return 'Low';
  return 'Very low';
}

/** Morale = the player's baseline plus six factors, every one measured from the real career history and state. */
export function computeMorale(player: Player, history: CareerHistory, now: GameStamp): Morale {
  const newestGames = [...history.games].reverse();
  const recent = newestGames.slice(0, GAME_CONFIG.history.recentFormGames);
  const results = recent.reduce((sum, g) => sum + (g.outcome === 'win' ? 3 : g.outcome === 'draw' ? 0.5 : -3), 0);

  let lossStreak = 0;
  for (const g of newestGames) {
    if (g.outcome !== 'loss') break;
    lossStreak++;
  }

  const lastEvents = [...history.tournaments].reverse().slice(0, 3);
  const percentiles = lastEvents.map((t) => (t.fieldSize > 1 ? 1 - (t.rank - 1) / (t.fieldSize - 1) : 1));
  const tournament = percentiles.length ? (percentiles.reduce((a, b) => a + b, 0) / percentiles.length - 0.5) * 12 : 0;

  const recentTraining = history.training.filter((t) => weeksBetween(t, now) <= GAME_CONFIG.training.recentWeeks).length;
  const training = recentTraining === 0 ? -2 : Math.min(8, recentTraining);

  const fatigue = -8 * (1 - player.ap.current / Math.max(1, player.ap.max));

  const achievements = history.trophies.filter((t) => weeksBetween(t, now) <= 26).length;

  const factors: MoraleFactor[] = [
    { label: 'Recent results', value: clamp(results, -12, 12), note: recent.length ? `Last ${recent.length} rated games` : 'No rated games yet' },
    { label: 'Losing streak', value: lossStreak >= 2 ? -Math.min(12, (lossStreak - 1) * 3) : 0, note: lossStreak >= 2 ? `${lossStreak} losses in a row` : 'No losing streak' },
    { label: 'Tournament form', value: Math.round(tournament * 10) / 10, note: lastEvents.length ? `Last ${lastEvents.length} tournaments` : 'No tournaments played' },
    { label: 'Training quality', value: training, note: recentTraining ? `${recentTraining} skill upgrades recently` : 'No recent training' },
    { label: 'Fatigue', value: Math.round(fatigue * 10) / 10, note: `${player.ap.current} of ${player.ap.max} AP available` },
    { label: 'Career achievements', value: Math.min(9, achievements * 3), note: achievements ? `${achievements} recent trophies or titles` : 'None recently' },
  ];
  const value = Math.round(clamp(player.morale + factors.reduce((s, f) => s + f.value, 0), 0, 100));
  return { value, label: moraleLabel(value), factors };
}
