import { useMemo } from 'react';
import { getCountry } from '@/data/world/countries';
import { buildNews } from '@/game/career/news';
import { getTitleStatus } from '@/game/career/titles';
import { computeMorale } from '@/game/player/morale';
import { computeRankings } from '@/game/world/standings';
import { getSchedule } from '@/game/world/schedule';
import { useSave } from '@/hooks/useGame';
import { useRankedNpcs } from '@/hooks/useNpcs';

/** Every dashboard value, derived from the saved career and the NPC database. */
export function useDashboard() {
  const save = useSave();
  const ranked = useRankedNpcs();
  const { player, world, history, career } = save;
  const country = getCountry(player.country);

  const rankings = useMemo(() => computeRankings(player, ranked), [player, ranked]);
  const titles = useMemo(() => getTitleStatus(player, history), [player, history]);
  const morale = useMemo(() => computeMorale(player, history, world.date), [player, history, world.date]);
  const schedule = useMemo(
    () =>
      getSchedule(
        world.date,
        { city: player.city.name, countryCode: player.country, demonym: country?.nationality ?? player.country, continent: country?.continent ?? 'World' },
        career.id,
      ),
    [world.date, player.city.name, player.country, country, career.id],
  );
  const news = useMemo(() => buildNews(save, schedule), [save, schedule]);

  return { save, ranked, rankings, titles, morale, schedule, news, country };
}
