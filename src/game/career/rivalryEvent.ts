import { GAME_CONFIG } from "@/data/config";
import { news } from "@/game/career/expansion";
import type { GameOutcome, GameSave } from "@/types";

export const rivalryBonus = 30;

export function rivalryEventId(save: GameSave, opponentId: string): string | null {
  const rivalry = save.social?.relationships[opponentId];
  if (!rivalry || rivalry.ratedGames < 3) return null;
  const id = `rivalry-${opponentId}-${save.world.date.year}-${save.world.date.week}`;
  return save.history.news.some(item => item.id === id) ||
    save.history.ledger.some(item => item.id === id) ? null : id;
}

export function settleRivalry(before: GameSave, save: GameSave, opponent: { id: string; name: string }, outcome: GameOutcome): GameSave {
  const id = rivalryEventId(before, opponent.id);
  if (!id) return save;
  const headline = outcome === "win" ? "Rivalry won" : outcome === "loss" ? "Rival takes the match" : "Rivals draw";
  const bonus = outcome === "win" ? rivalryBonus : 0;
  const updated = news(save, id, headline, `${save.player.name} · ${opponent.name}${bonus ? ` · +$${bonus}` : ""}`);
  return {
    ...updated,
    player: {
      ...updated.player,
      money: updated.player.money + bonus,
      morale: Math.max(0, Math.min(100, updated.player.morale + (outcome === "win" ? 3 : outcome === "loss" ? -3 : 0))),
    },
    history: { ...updated.history, ledger: [...updated.history.ledger, {
      ...save.world.date, day: save.world.day, id, amount: bonus, kind: "other" as const, label: "Rivalry match",
    }].slice(-GAME_CONFIG.history.maxLedger) },
  };
}
