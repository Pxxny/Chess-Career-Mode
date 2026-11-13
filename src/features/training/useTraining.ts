import { useMemo } from 'react';
import { CATEGORY_ORDER } from '@/data/trainingSessions';
import { recommendCategory } from '@/game/training/recommend';
import { computeMorale } from '@/game/player/morale';
import { preserveBookedVenues, regionForSave, getSchedule } from '@/game/world/schedule';
import { useSave } from '@/hooks/useGame';
import { useRankedNpcs } from '@/hooks/useNpcs';

/** Everything the training screens need, derived from the saved career. */
export function useTraining() {
  const save = useSave();
  const ranked = useRankedNpcs();
  const { player, world, history, career, training } = save;
  const schedule = useMemo(
    () => preserveBookedVenues(save, getSchedule(world.date, regionForSave(save), career.id)),
    [world.date, player.city.name, player.country, player.birthPlace, career.id, save.registrations, save.tournament, save.calendarTournaments],
  );
  const recommendation = useMemo(() => recommendCategory(save, schedule), [save, schedule]);
  const morale = useMemo(() => computeMorale(player, history, world.date, training.fatigue), [player, history, world.date, training.fatigue]);
  return { save, ranked, schedule, recommendation, morale, categories: CATEGORY_ORDER };
}
