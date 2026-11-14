import type { GameSave, Npc } from '@/types';
import type { ScheduledEvent } from '@/game/world/schedule';
import { previewEntrants, projectedEntrants } from '@/game/match/registration';
export function tournamentSpotlight(save: GameSave, event: ScheduledEvent, npcs: Npc[]) {
  if (event.details?.format === 'team') return { favorites: [] as Npc[], projected: true, count: 0 };
  const announced = previewEntrants(save,event,npcs);
  const field = announced.length>=2 ? announced : projectedEntrants(save,event,npcs);
  return { favorites: [...field].sort((a,b)=>b.currentElo-a.currentElo || b.form-a.form || a.id.localeCompare(b.id)).slice(0,4), projected: announced.length<2, count: field.length };
}
