import type { Player } from '@/types';

/** Returns the updated player, or null when there are not enough action points. */
export function spendActionPoints(player: Player, amount: number): Player | null {
  if (amount < 0 || player.ap.current < amount) return null;
  return { ...player, ap: { ...player.ap, current: player.ap.current - amount } };
}

export function restoreActionPoints(player: Player): Player {
  return { ...player, ap: { ...player.ap, current: player.ap.max } };
}

export function addMoney(player: Player, amount: number): Player {
  return { ...player, money: Math.max(0, player.money + amount) };
}
