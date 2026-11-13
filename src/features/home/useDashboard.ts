import { useMemo } from "react";
import { getCountry } from "@/data/world/countries";
import { buildNews } from "@/game/career/news";
import { getTitleStatus } from "@/game/career/titles";
import { computeMorale } from "@/game/player/morale";
import { computeRankings } from "@/game/world/standings";
import { preserveBookedVenues, regionForSave, getSchedule } from "@/game/world/schedule";
import { useSave } from "@/hooks/useGame";
import { useRankedNpcs } from "@/hooks/useNpcs";

/** Every dashboard value, derived from the saved career and the NPC database. */
export function useDashboard() {
  const save = useSave();
  const ranked = useRankedNpcs();
  const { player, world, history, career } = save;
  const country = getCountry(player.country);

  const rankings = useMemo(
    () => computeRankings(player, ranked),
    [player, ranked],
  );
  const titles = useMemo(
    () => getTitleStatus(player, history),
    [player, history],
  );
  const morale = useMemo(
    () => computeMorale(player, history, world.date, save.training.fatigue),
    [player, history, world.date, save.training.fatigue],
  );
  const schedule = useMemo(
    () => preserveBookedVenues(save, getSchedule(world.date, regionForSave(save), career.id)),
    [world.date, player.city.name, player.country, player.birthPlace, career.id, save.registrations, save.tournament, save.calendarTournaments],
  );
  const news = useMemo(
    () => buildNews(save, schedule, ranked),
    [save, schedule, ranked],
  );

  return { save, ranked, rankings, titles, morale, schedule, news, country };
}
