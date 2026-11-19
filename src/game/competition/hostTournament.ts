import { stampFromIndex, stampIndex } from "./catalog";
import { addMoney } from "@/game/player/resources";
import type { GameSave, Npc } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";

export interface HostPlan {
  name: string;
  budget: number;
  format: "swiss" | "round-robin";
  size: number;
  inviteIds: string[];
}

export function hostTournament(save: GameSave, plan: HostPlan, npcs: Npc[]) {
  const name = plan.name.trim();
  if (save.retirement) return { error: "Your competitive career has ended." };
  if (name.length < 4 || name.length > 56) return { error: "Enter a tournament name of 4–56 characters." };
  if (!Number.isSafeInteger(plan.budget) || plan.budget < 300 || plan.budget > save.player.money)
    return { error: "Hosting costs at least $300 and requires cash on hand." };
  if (![8, 12, 16].includes(plan.size) || !["swiss", "round-robin"].includes(plan.format))
    return { error: "Choose a supported format and field size." };
  const scheduled = save.hostedEvents ?? [];
  const starts = stampIndex(save.world.date) + 4;
  if (scheduled.some(event => stampIndex(event) >= stampIndex(save.world.date)))
    return { error: "You already have a host event scheduled." };
  const size = plan.size;
  const inviteIds = [...new Set(plan.inviteIds)].filter(id => npcs.some(npc => npc.id === id && npc.careerStatus === "active"));
  if (inviteIds.length >= size) return { error: "Leave at least one free place in the field." };
  const date = stampFromIndex(starts);
  const event: ScheduledEvent = {
    ...date, id: `player-host-${save.career.id}-${starts}`, name, level: "local", fieldSize: size,
    entryFee: 0, minElo: 0, minReputation: 0, invitational: false,
    registrationDeadline: stampFromIndex(starts - 1), weeksUntilStart: 4, weeksUntilDeadline: 3,
    details: {
      category: "Player-hosted Tournament", location: save.player.city.name, country: save.player.country,
      end: date, format: plan.format, rounds: plan.format === "swiss" ? 5 : size - 1,
      timeControl: { id: "host-rapid", label: "10+5", base: 600, increment: 5, category: "rapid" },
      prize: Math.floor(plan.budget * .8), prestige: 20, provenance: "fictional",
      invitedNpcIds: inviteIds,
      organizer: { name: save.player.name, status: "Unofficial", simulated: true },
      agenda: { days: 2, startDay: 5, startMinute: 540, slotMinutes: 40, exactStart: true },
    },
  };
  return { event, save: { ...save, player: addMoney(save.player, -plan.budget), hostedEvents: [...scheduled, event] } };
}
