import { writeFile } from "node:fs/promises";
import { randomAppearance } from "../src/data/appearance";
import { createCareerRecord } from "../src/game/career/createCareer";
import { createNewSave } from "../src/game/createNewSave";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs";
import { recordGame } from "../src/game/history/recordGame";
import { yearReviewOf } from "../src/game/career/yearReview";
import { signSponsor } from "../src/game/career/business";
import { performSession, endDay } from "../src/game/training/engine";
import { createBackup } from "../src/store/backup";
/** Seeded veteran careers exercise later-career UI; the new-career and human-board tests use actual UI play. */
export async function makeRoadmapFixtures() {
  const options = {
    name: "Roadmap Veteran",
    gender: "male" as const,
    countryCode: "TH",
    city: { name: "Bangkok", custom: false },
    archetype: "balanced" as const,
    appearance: randomAppearance(),
    startYear: 2010,
    alternateHistory: false,
    dateOfBirth: "1986-01-01",
  };
  const original = createNewSave(options, createCareerRecord(options));
  let veteran = {
    ...original,
    world: { ...original.world, date: { year: 2026, week: 1 } },
    player: {
      ...original.player,
      age: 40,
      rating: 1500,
      peakRating: 2520,
      reputation: 25,
      money: 500,
    },
  };
  veteran = { ...veteran, yearReview: yearReviewOf(veteran) };
  const world = buildWorldNpcs(2026),
    rival = world.find(
      (n) => n.careerStatus === "active" && n.kind === "fictional",
    )!;
  for (const outcome of ["win", "draw", "loss"] as const)
    veteran = recordGame(veteran, {
      opponentId: rival.id,
      opponentName: rival.name,
      opponentElo: 1500,
      outcome,
      color: "white",
      accuracy: 80,
      tournamentName: "Shared career event",
    });
  await writeFile(
    "/tmp/chess-roadmap-veteran-backup.json",
    JSON.stringify(await createBackup(veteran, world)),
  );
  await writeFile(
    "/tmp/chess-roadmap-veteran-info.json",
    JSON.stringify({ rivalId: rival.id, rivalName: rival.name }),
  );
  const signed = signSponsor(veteran, "local-club");
  if (!signed.ok) throw new Error(signed.error);
  let due = signed.save;
  for (let i = 0; i < 6; i++)
    due = recordGame(due, {
      opponentId: rival.id,
      opponentName: rival.name,
      opponentElo: 1500,
      outcome: "draw",
      color: "white",
      accuracy: 80,
    });
  for (let i = 0; i < 8; i++) {
    const trained = performSession(due, "tactics-puzzle");
    if (!trained.ok) throw new Error(trained.error);
    due = endDay(trained.save).save;
  }
  while (due.world.date.week < 4 || due.world.day < 7) due = endDay(due).save;
  await writeFile(
    "/tmp/chess-roadmap-sponsor-due-backup.json",
    JSON.stringify(await createBackup(due, world)),
  );
}
