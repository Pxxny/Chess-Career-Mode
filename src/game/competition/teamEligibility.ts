import {
  teamSpec,
  type TeamEventInfo,
  type TeamEventSpec,
} from "@/data/chess/nationalTeamEvents";
import { getCountry } from "@/data/world/countries";
import type { GameSave } from "@/types";

export const regionAllows = (spec: TeamEventSpec, code: string): boolean => {
  if (!spec.continents && !spec.countries) return true;
  if (spec.countries?.includes(code)) return true;
  const country = getCountry(code);
  return !!(country && spec.continents?.includes(country.continent));
};

/** Why the career player cannot enter this event (empty when allowed). */
export function teamEntryIssues(
  save: GameSave,
  info: TeamEventInfo | undefined,
): string[] {
  const spec = info && teamSpec(info.key);
  if (!spec) return [];
  const issues: string[] = [];
  if (spec.abstract) issues.push("Disability classification (not modelled)");
  if (!regionAllows(spec, save.player.country))
    issues.push("A federation taking part in this event");
  if (spec.gender && save.player.gender !== "female")
    issues.push("Women's section eligibility");
  if (spec.minAge !== undefined && save.player.age < spec.minAge)
    issues.push(`Age ${spec.minAge}+`);
  if (spec.maxAge !== undefined && save.player.age > spec.maxAge)
    issues.push(`Age ${spec.maxAge} or younger`);
  return issues;
}

