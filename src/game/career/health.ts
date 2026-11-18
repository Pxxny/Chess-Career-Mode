import { gameDay } from "@/game/competition/agenda";
import type { GameSave } from "@/types";

export interface CareerHealth {
  restUntil: number;
  condition: "exhaustion" | "illness";
}

export function recoveryDays(save: GameSave): number {
  return Math.max(0, (save.health?.restUntil ?? 0) - gameDay(save));
}

export function competitionHealthIssue(save: GameSave): string | null {
  if (save.retirement) return "Your competitive career has ended.";
  return recoveryDays(save) > 0 ? "Rest before playing another competitive match." : null;
}

export function updateHealthAfterMatch(save: GameSave): GameSave {
  const jetlag = save.careerSystems?.jetlag;
  const travelStrain = jetlag && jetlag.until > gameDay(save) ? jetlag.penalty * 4 : 0;
  if (save.training.fatigue + travelStrain < 98 || recoveryDays(save)) return save;
  const illness = travelStrain >= 8 && save.training.fatigue >= 90;
  return {
    ...save,
    health: { restUntil: gameDay(save) + (illness ? 3 : 2), condition: illness ? "illness" : "exhaustion" },
    player: { ...save.player, morale: Math.max(0, save.player.morale - 6) },
  };
}
