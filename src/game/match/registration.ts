import { addMoney } from '@/game/player/resources';
import { isEligible, registrationOpen, type ScheduledEvent } from '@/game/world/schedule';
import type { ActiveTournament, EventRegistration, GameSave, Npc } from '@/types';
import { createTournament } from './tournament';
import { highestTitle } from './setup';

/** Weeks since year 0, to compare dates. */
export const weekIndex = (d: { year: number; week: number }): number => d.year * 52 + (d.week - 1);

export type Registration = EventRegistration & { status: 'upcoming' | 'ready' | 'missed' };

/** Registrations with their state today: upcoming, ready to play (the event week), or missed (the week has passed). */
export function registrationStates(save: GameSave): Registration[] {
  const now = weekIndex(save.world.date);
  return save.registrations.map((r) => {
    const at = weekIndex(r);
    return { ...r, status: at > now ? 'upcoming' : at === now ? 'ready' : 'missed' };
  });
}

export type Result<T> = { ok: true; save: T } | { ok: false; error: string };

/** Registers for an upcoming event: registration must be open, the player eligible and able to pay the entry fee. */
export function registerForEvent(save: GameSave, event: ScheduledEvent): Result<GameSave> {
  if (save.registrations.some((r) => r.eventId === event.id)) return { ok: false, error: 'You are already registered.' };
  if (save.history.tournaments.some((t) => t.tournamentId === event.id)) return { ok: false, error: 'You already played this event.' };
  if (!registrationOpen(event)) return { ok: false, error: 'Registration for this event is closed.' };
  if (!isEligible(event, save.player.rating, save.player.reputation)) return { ok: false, error: `You need ${event.minElo} Elo${event.minReputation ? ` and reputation ${event.minReputation}` : ''}.` };
  if (save.player.money < event.entryFee) return { ok: false, error: 'You cannot afford the entry fee.' };
  const entry: EventRegistration = { eventId: event.id, name: event.name, level: event.level, year: event.year, week: event.week, fieldSize: event.fieldSize, entryFee: event.entryFee };
  return { ok: true, save: { ...save, player: addMoney(save.player, -event.entryFee), registrations: [...save.registrations, entry] } };
}

/** Cancels a registration and refunds the fee while the event has not started. */
export function cancelRegistration(save: GameSave, eventId: string): GameSave {
  const reg = save.registrations.find((r) => r.eventId === eventId);
  if (!reg) return save;
  const refund = weekIndex(reg) > weekIndex(save.world.date) ? reg.entryFee : 0;
  return { ...save, player: addMoney(save.player, refund), registrations: save.registrations.filter((r) => r.eventId !== eventId) };
}

/** Starts the tournament of a registration in its week. The fee was paid at registration. */
export function startRegisteredTournament(save: GameSave, eventId: string, npcs: Npc[], seed: number): Result<GameSave> {
  if (save.tournament && save.tournament.status === 'playing') return { ok: false, error: 'You are already playing a tournament.' };
  const reg = save.registrations.find((r) => r.eventId === eventId);
  if (!reg) return { ok: false, error: 'You are not registered for this event.' };
  const diff = weekIndex(reg) - weekIndex(save.world.date);
  if (diff > 0) return { ok: false, error: `The event starts in ${diff} week${diff === 1 ? '' : 's'}. End days in Train to move the calendar forward.` };
  if (diff < 0) return { ok: false, error: 'The event has already taken place.' };
  const event = { id: reg.eventId, name: reg.name, level: reg.level, year: reg.year, week: reg.week, fieldSize: reg.fieldSize, entryFee: reg.entryFee } as ScheduledEvent;
  const t: ActiveTournament = createTournament({ event, player: { name: save.player.name, rating: save.player.rating, country: save.player.country, title: highestTitle(save) }, npcs, seed });
  return { ok: true, save: { ...save, registrations: save.registrations.filter((r) => r.eventId !== eventId), tournament: t } };
}
