import type { GameSave } from "@/types";

export function retirementIssue(save: GameSave): string | null {
  if (save.retirement) return "This career is already retired.";
  if (save.pendingMatch || save.practice.pendingGame || save.social?.pending ||
      save.tournament?.status === "playing" || save.esports?.active?.status === "playing") {
    return "Finish or withdraw from your current activity before retiring.";
  }
  if (save.registrations.length || save.esports?.entries.length) {
    return "Clear outstanding tournament registrations before retiring.";
  }
  if (save.sponsorship?.active) return "Finish or cancel your sponsorship before retiring.";
  return null;
}
