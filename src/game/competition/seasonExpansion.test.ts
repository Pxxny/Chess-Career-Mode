import { describe, expect, it } from "vitest";
import { SPONSORSHIPS, sponsorMarketShare } from "@/data/reputation";
import { DEFAULT_APPEARANCE } from "@/data/appearance";
import { createCareerRecord } from "@/game/career/createCareer";
import { createNewSave } from "@/game/createNewSave";
import { registerForEvent, startRegisteredTournament } from "@/game/match/registration";
import { reportPlayerResult, standings } from "@/game/match/tournament";
import { travelQuote } from "./travel";
import { annualSeriesEvents, seriesStandings } from "./seasonSeries";
import { eligibilityIssues, registrationIssue } from "./eligibility";
import { circuitNpcField } from "./qualificationCircuit";
import { sponsorEvents } from "./sponsorEvents";
import { hostTournament } from "./hostTournament";
import { divisionFixture, divisionState } from "./divisionLeague";
import type { GameSave, NewCareerOptions, Npc } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";

function career(): GameSave {
  const options: NewCareerOptions = {
    name: "Season QA", gender: "male", countryCode: "TH", city: { name: "Bangkok", custom: false },
    archetype: "balanced", appearance: DEFAULT_APPEARANCE, startYear: 2026, alternateHistory: false,
  };
  const save = createNewSave(options, createCareerRecord(options));
  return { ...save, player: { ...save.player, money: 10000 } };
}

const roster: Npc[] = Array.from({ length: 32 }, (_, index) => ({
  id: `npc-${index}`, kind: "fictional", name: `NPC ${index}`, nationality: "TH", city: "Bangkok",
  dateOfBirth: "2004-02-24", gender: "male", careerStatus: "active", careerStartYear: 2015, style: "solid",
  currentElo: 1400 + index, peakElo: 1400 + index, worldRank: index + 1, potentialRating: 1600,
  tier: "club", league: "club", personality: "calm", title: "none", age: 22,
  preferredOpenings: [], strengths: [], weaknesses: [],
  training: { intensity: "regular", weeklyHours: 8, focus: "opening", hasCoach: false, usesEngine: false },
  morale: 60, form: 50, tournamentHistory: [],
}));

function result(event: ScheduledEvent, rank: number) {
  return { year: event.year, week: event.week, tournamentId: event.id, name: event.name,
    rank, level: event.level, fieldSize: event.fieldSize, points: 4 };
}

describe("competition expansion", () => {
  it("changes monthly market share and keeps LogG in the lowest position", () => {
    const month = 2026 * 12;
    const shares = SPONSORSHIPS.map(sponsor => sponsorMarketShare(sponsor, month));
    expect(shares.reduce((a, b) => a + b)).toBeCloseTo(100);
    expect(shares.at(-1)).toBe(Math.min(...shares));
    expect(shares.at(-1)).not.toBe(sponsorMarketShare(SPONSORSHIPS.at(-1)!, month + 1));
    expect(SPONSORSHIPS.every(sponsor => sponsor.headquarters.executive && sponsor.headquarters.city)).toBe(true);
  });

  it("registers the remote qualifier without travel, then restricts the live final", () => {
    const year = 2026;
    const events = sponsorEvents(year);
    const qualifier = events.find(event => event.id === "sponsor-hybrid-logg-2026-online")!;
    const final = events.find(event => event.id === "sponsor-hybrid-logg-2026-final")!;
    const save = career();
    save.world.date = qualifier.registrationDeadline;
    expect(travelQuote(save, qualifier).cost).toBe(0);
    expect(registerForEvent(save, qualifier, roster).ok).toBe(true);
    expect(eligibilityIssues(save, final)).not.toEqual([]);
    const npc = { ...roster[0], tournamentHistory: [{ eventId: qualifier.id, event: qualifier.name, year, rank: 2, points: 4, fieldSize: 48, games: 5 }] };
    expect(circuitNpcField(final, [npc, roster[1]], 1).map(entry => entry.id)).toEqual([npc.id]);
  });

  it("qualifies finalists using actual points and rejects missing results", () => {
    const [leg, ...other] = annualSeriesEvents(2026);
    const final = other.find(event => event.details?.pointsSeries?.stage === "final")!;
    const save = career();
    save.world.date = final.registrationDeadline;
    expect(registrationIssue(save, final, roster)).toMatch(/highest points/);
    save.history.tournaments.push(result(leg, 1));
    const points = seriesStandings(save, roster, "fide-season", 2026);
    expect(points[0].points).toBe(25);
    expect(registrationIssue(save, final, roster)).toBe(null);
    expect(new Set([2026, 2027, 2028, 2029].map(year => annualSeriesEvents(year).find(event => event.details?.pointsSeries?.stage === "final")!.fieldSize))).toEqual(new Set([16, 32, 64, 128]));
  });

  it("publishes a funded hometown tour once and refuses an unaffordable budget", () => {
    const save = career();
    const plan = { name: "Bangkok Invitational", budget: 500, format: "swiss" as const, size: 8, inviteIds: [roster[0].id] };
    const posted = hostTournament(save, plan, roster);
    expect(posted.save?.player.money).toBe(save.player.money - 500);
    expect(posted.event?.details).toMatchObject({ location: "Bangkok", prize: 400, invitedNpcIds: [roster[0].id] });
    expect(hostTournament(posted.save!, plan, roster).error).toBeTruthy();
    expect(hostTournament(save, { ...plan, budget: 10001 }, roster).error).toBeTruthy();
  });

  it("starts a ten-player league field and applies right-of-promotion results", () => {
    const save = career();
    const fixture = divisionFixture(save, roster, false)!;
    expect(fixture.fieldSize).toBe(10);
    save.world.date = fixture.registrationDeadline;
    const registered = registerForEvent(save, fixture, roster);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    registered.save.world.date = { year: fixture.year, week: fixture.week };
    registered.save.world.day = 7;
    const started = startRegisteredTournament(registered.save, fixture.id, roster, 8);
    expect(started.ok && started.save.tournament?.players.length).toBe(10);
    save.history.tournaments.push(result(fixture, 1));
    expect(divisionState(save).division).toBe(9);
  });

  it("plays a tiebreak only when the two-playoff-game score is level", () => {
    const save = career();
    const season = divisionFixture(save, roster, false)!;
    save.history.tournaments.push({ ...result(season, 1), tournamentId: "division-league-2025-2-10", year: 2025, week: 49 });
    save.history.tournaments.push({ ...result(season, 2), tournamentId: "division-league-2026-1-9" });
    save.world.date = { year: 2026, week: 24 };
    const fixture = divisionFixture(save, roster, true)!;
    const registered = registerForEvent(save, fixture, roster);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    registered.save.world.date = { year: 2026, week: 25 };
    registered.save.world.day = 7;
    const played = startRegisteredTournament(registered.save, fixture.id, roster, 8);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const start = played.save.tournament!;
    const first = reportPlayerResult(start, "win");
    expect(first.pairings[0][0].white).toBe(first.pairings[1][0].black);
    const won = reportPlayerResult(first, "draw");
    expect(won.status).toBe("finished");
    expect(standings(won)[0].player.id).toBe("player");
    expect(reportPlayerResult(first, "loss").status).toBe("playing");
  });
});
