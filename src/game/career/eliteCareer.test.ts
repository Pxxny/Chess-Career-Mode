import { describe, expect, it } from "vitest";
import { randomAppearance } from "@/data/appearance";
import { createCareerRecord } from "@/game/career/createCareer";
import { createNewSave } from "@/game/createNewSave";
import { endDay } from "@/game/training/engine";
import { gameDay } from "@/game/competition/agenda";
import { competitionHealthIssue, recoveryDays, updateHealthAfterMatch } from "./health";
import { retirementIssue } from "./retirement";
import { rivalryEventId, settleRivalry } from "./rivalryEvent";
import { relationshipAt } from "@/game/social/relationships";
import type { GameSave, NewCareerOptions } from "@/types";

function career(): GameSave {
  const options: NewCareerOptions = {
    name: "Career test", gender: "male", countryCode: "TH", city: { name: "Bangkok", custom: false },
    archetype: "balanced", appearance: randomAppearance(), startYear: 2026, alternateHistory: false,
  };
  return createNewSave(options, createCareerRecord(options));
}

describe("Grandmaster Elite career systems", () => {
  it("leaves healthy careers alone and recovers through normal game days", () => {
    const save = career();
    expect(updateHealthAfterMatch(save)).toBe(save);
    const tired = updateHealthAfterMatch({ ...save, training: { ...save.training, fatigue: 99 } });
    expect(tired.health?.condition).toBe("exhaustion");
    expect(recoveryDays(tired)).toBe(2);
    expect(competitionHealthIssue(tired)).toBeTruthy();
    expect(recoveryDays(endDay(tired).save)).toBe(1);
    expect(competitionHealthIssue(endDay(endDay(tired).save).save)).toBeNull();
  });

  it("counts active jet lag toward illness but ignores expired travel strain", () => {
    const save = career();
    save.training.fatigue = 91;
    save.careerSystems = { travelClass: "economy", captain: {}, press: {}, queue: [], contracts: [], transferLog: [],
      jetlag: { until: gameDay(save) + 2, penalty: 3 } };
    const ill = updateHealthAfterMatch(save);
    expect(ill.health?.condition).toBe("illness");
    expect(recoveryDays(ill)).toBe(3);
    expect(updateHealthAfterMatch({ ...save, world: { ...save.world, day: 4 } }).health).toBeUndefined();
  });

  it("awards an established rival’s bonus once per game week without changing Elo", () => {
    const save = career();
    const opponent = { id: "rival", name: "Test rival" };
    const relationship = { ...relationshipAt(save, opponent.id), ratedGames: 3 };
    save.social!.relationships[opponent.id] = relationship;
    const first = settleRivalry(save, save, opponent, "win");
    expect(first.player.money - save.player.money).toBe(30);
    expect(first.player.rating).toBe(save.player.rating);
    expect(first.history.news.at(-1)?.headline).toBe("Rivalry won");
    expect(rivalryEventId(first, opponent.id)).toBeNull();
    expect(settleRivalry(first, first, opponent, "win")).toBe(first);
  });

  it("keeps older careers eligible and rejects competition after retirement", () => {
    const save = career();
    expect(retirementIssue(save)).toBeNull();
    expect(competitionHealthIssue(save)).toBeNull();
    const retired = { ...save, retirement: { ...save.world.date, day: 1, peakElo: 1000, wins: 0, ratedGames: 0 } };
    expect(retirementIssue(retired)).toBeTruthy();
    expect(competitionHealthIssue(retired)).toBeTruthy();
  });
});
