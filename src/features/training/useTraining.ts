import { useMemo } from 'react';
import { CATEGORY_ORDER } from '@/data/trainingSessions';
import { getCountry } from '@/data/world/countries';
import { recommendCategory } from '@/game/training/recommend';
import { computeMorale } from '@/game/player/morale';
import { getSchedule } from '@/game/world/schedule';
import { useSave } from '@/hooks/useGame';
import { useRankedNpcs } from '@/hooks/useNpcs';

/** Everything the training screens need, derived from the saved career. */
export function useTraining() {
  const save = useSave();
  const ranked = useRankedNpcs();
  const { player, world, history, career, training } = save;
  const country = getCountry(player.country);
  const schedule = useMemo(
    () => getSchedule(world.date, { city: player.city.name, countryCode: player.country, demonym: country?.nationality ?? player.country, continent: country?.continent ?? 'World' }, career.id),
    [world.date, player.city.name, player.country, country, career.id],
  );
  const recommendation = useMemo(() => recommendCategory(save, schedule), [save, schedule]);
  const morale = useMemo(() => computeMorale(player, history, world.date, training.fatigue), [player, history, world.date, training.fatigue]);
  return { save, ranked, schedule, recommendation, morale, categories: CATEGORY_ORDER };
}
