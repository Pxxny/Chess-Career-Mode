import assert from "node:assert/strict";
import { DEFAULT_APPEARANCE } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import {
  directoryEntries,
  playerDirectoryEntry,
} from "../src/game/social/directory.ts";
import {
  approachNpc,
  cancelSocialInvitation,
  emptyRelationship,
  emptySocial,
  recordRatedContact,
  recordSharedContacts,
  relationshipAt,
  relationshipLabel,
  socialActionIssue,
} from "../src/game/social/relationships.ts";
import {
  beginFriendly,
  FRIENDLY_CONTROLS,
} from "../src/game/social/friendly.ts";
import { endDay } from "../src/game/training/engine.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { recordGame } from "../src/game/history/recordGame.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import {
  applyFinishedMatch,
  recoverPendingMatch,
} from "../src/game/match/aftermath.ts";
import { useGameStore } from "../src/store/gameStore.ts";
import { useNpcStore } from "../src/store/npcStore.ts";
import { acquireMatch, releaseMatch } from "../src/store/matchLocks.ts";
import type { GameSave, Npc } from "../src/types/index.ts";
import type { MatchFinish } from "../src/game/match/session.ts";

const options = {
  name: "Directory QA",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: DEFAULT_APPEARANCE,
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(options, {
  ...createCareerRecord(options),
  id: "social-qa",
});
const npcs = buildWorldNpcs(2026),
  db = getBaseOpeningDatabase();
const copy = JSON.stringify(npcs);
const entries = directoryEntries(base, npcs),
  player = entries.find((n) => n.kind === "player")!;
assert.equal(entries.length, npcs.length + 1);
assert.equal(entries.filter((n) => n.kind === "player").length, 1);
assert.equal(player.name, base.player.name);
const ranks = entries
  .filter((n) => n.worldRank !== null)
  .map((n) => n.worldRank!);
assert.deepEqual(
  ranks,
  Array.from({ length: ranks.length }, (_, i) => i + 1),
);
assert.equal(
  playerDirectoryEntry(
    {
      ...base,
      player: { ...base.player, name: "Renamed Player", rating: 4000 },
    },
    npcs,
  ).worldRank,
  1,
);
assert.equal(
  JSON.stringify(npcs),
  copy,
  "directory insertion never changes stored NPC ranks",
);
console.log(
  "PASS player directory includes one real player, consistent ranks/ties and live character values.",
);

const active = npcs.filter(
  (n) => n.careerStatus === "active" && n.currentElo < 1600,
);
function accepted(action: "talk" | "study" | "play") {
  for (const npc of active) {
    const result = approachNpc(base, npc, action);
    if (result.ok && result.accepted) return { npc, result };
  }
  throw Error("No accepted fixture");
}
let competitive = base;
const rival = active[0];
for (let i = 0; i < 100; i++)
  competitive = recordGame(competitive, {
    opponentId: rival.id,
    opponentName: rival.name,
    opponentElo: rival.currentElo,
    outcome: i % 2 ? "draw" : "win",
    color: "white",
    accuracy: 80,
  });
for (let i = 0; i < 30; i++)
  competitive = recordSharedContacts(competitive, `event-${i}`, [
    rival.id,
    rival.id,
    "player",
  ]);
assert.equal(relationshipAt(competitive, rival.id).familiarity, 100);
assert.equal(relationshipAt(competitive, rival.id).closeness, 0);
assert.equal(relationshipAt(competitive, rival.id).ratedGames, 100);
assert.equal(relationshipAt(competitive, rival.id).sharedEvents, 30);
assert.equal(
  relationshipLabel(relationshipAt(competitive, rival.id)),
  "Regular opponents",
);
assert.strictEqual(
  recordSharedContacts(competitive, "event-29", [rival.id]),
  competitive,
);
console.log(
  "PASS 100 competitive meetings and 30 shared events create familiarity without friendship or duplicate co-encounters.",
);

const talk = accepted("talk"),
  study = accepted("study"),
  play = accepted("play");
assert.equal(talk.result.save.player.ap.current, base.player.ap.current - 1);
assert.equal(talk.result.save.training.hoursUsedToday, 0.5);
assert.equal(relationshipAt(talk.result.save, talk.npc.id).closeness, 3);
assert(!approachNpc(talk.result.save, talk.npc, "study").ok);
assert.deepEqual(
  approachNpc(base, talk.npc, "talk"),
  talk.result,
  "reload cannot reroll a response",
);
assert.equal(
  study.result.save.training.sessionCounter,
  base.training.sessionCounter + 1,
);
assert.equal(
  study.result.save.history.sessions.at(-1)?.sessionId,
  "social-study",
);
assert.equal(study.result.save.yearReview?.current.sessions, 1);
assert.equal(study.result.save.training.hoursUsedToday, 1);
assert.equal(study.result.save.player.ap.current, 9);
assert.equal(relationshipAt(study.result.save, study.npc.id).closeness, 5);
const declined = active
  .map((npc) => ({ npc, result: approachNpc(base, npc, "talk") }))
  .find((x) => x.result.ok && !x.result.accepted)!;
assert(declined && declined.result.ok);
assert.equal(declined.result.save.player.ap.current, base.player.ap.current);
assert.equal(declined.result.save.training.hoursUsedToday, 0);
assert.equal(
  relationshipAt(declined.result.save, declined.npc.id).closeness,
  0,
);
assert(!approachNpc(declined.result.save, declined.npc, "talk").ok);
assert(
  socialActionIssue(
    { ...base, player: { ...base.player, ap: { current: 0, max: 10 } } },
    talk.npc,
    "talk",
  ),
);
assert(
  socialActionIssue(
    { ...base, training: { ...base.training, hoursUsedToday: 8 } },
    talk.npc,
    "study",
  ),
);
const deceased = npcs.find((n) => n.careerStatus === "deceased")!;
assert(!approachNpc(base, deceased, "play").ok);
console.log(
  "PASS accepted/declined actions, AP/hours, real training XP, daily cooldown, era gates and stable responses.",
);

const acceptedSave = play.result.save;
assert.equal(acceptedSave.player.ap.current, 10);
assert.equal(relationshipAt(acceptedSave, play.npc.id).closeness, 0);
const cfg = {
  color: "white" as const,
  timeControlId: FRIENDLY_CONTROLS[1].id,
  speed: "brisk" as const,
};
const started = beginFriendly(acceptedSave, play.npc, cfg, db);
assert(started.ok);
assert.equal(started.setup.rated, false);
assert.equal(started.save.player.ap.current, 9);
assert.equal(started.save.training.hoursUsedToday, 1);
assert(!beginFriendly(started.save, play.npc, cfg, db).ok);
assert(
  !beginFriendly(
    acceptedSave,
    play.npc,
    { ...cfg, timeControlId: "invalid" },
    db,
  ).ok,
);
const moves = [
  "e4",
  "e5",
  "Nf3",
  "Nc6",
  "Bc4",
  "Bc5",
  "c3",
  "Nf6",
  "d3",
  "d6",
  "O-O",
  "O-O",
];
const finish: MatchFinish = {
  setup: started.setup,
  result: "white",
  termination: "resignation",
  moves,
  ucis: [],
  controlLog: [],
  playerMoved: true,
};
const done = applyFinishedMatch(started.save, finish, db);
assert(done.record);
assert.equal(
  done.record.setup.social?.requestId,
  started.setup.social?.requestId,
);
assert.equal(done.save.player.rating, 1000);
assert.equal(done.save.player.ratedGames, 0);
assert.equal(done.save.social?.pending, null);
assert.equal(relationshipAt(done.save, play.npc.id).friendlyGames, 1);
assert.equal(relationshipAt(done.save, play.npc.id).closeness, 5);
assert.deepEqual(
  applyFinishedMatch(done.save, finish, db).save.social,
  done.save.social,
);
for (const partial of [
  { ...finish, termination: "abandoned" as const },
  { ...finish, playerMoved: false },
  { ...finish, moves: ["e4", "e5"] },
]) {
  const noReward = applyFinishedMatch(started.save, partial, db);
  assert.equal(relationshipAt(noReward.save, play.npc.id).closeness, 0);
  assert.equal(noReward.save.social?.pending, null);
}
const invalid = {
  ...finish,
  setup: {
    ...started.setup,
    social: { ...started.setup.social!, careerId: "other" },
  },
};
assert.equal(applyFinishedMatch(started.save, invalid, db).record, null);
const pending = {
  setup: started.setup,
  ucis: ["e2e4", "e7e5"],
  playerMoved: true,
};
const recovered = recoverPendingMatch(
  { ...started.save, pendingMatch: pending },
  db,
);
assert.equal(recovered.record?.termination, "abandoned");
assert.equal(recovered.save.social?.pending, null);
assert.equal(relationshipAt(recovered.save, play.npc.id).closeness, 0);
const early = recoverPendingMatch(
  {
    ...started.save,
    pendingMatch: { ...pending, ucis: [], playerMoved: false },
  },
  db,
);
assert.equal(early.save.social?.pending, null);
console.log(
  "PASS real friendly setup/result, single payment, meaningful-play reward, duplicate/abandonment/simulation protection and reload recovery.",
);

useNpcStore.setState({
  npcs,
  careerId: base.career.id,
  status: "ready",
  startYear: 2026,
});
useGameStore.setState({ save: started.save });
assert(useGameStore.getState().finishMatch(finish, db));
assert.equal(useGameStore.getState().finishMatch(finish, db), null);
assert.equal(
  useNpcStore.getState().npcs.find((n) => n.id === play.npc.id)!.currentElo,
  play.npc.currentElo,
);
useGameStore.setState({ save: started.save });
useGameStore.getState().recoverMatch(db);
assert.equal(useGameStore.getState().save!.social?.pending, null);
const lease = Symbol("social-test");
assert(acquireMatch(base.career.id, lease));
useGameStore.setState({ save: base });
assert(!useGameStore.getState().approachNpc(talk.npc.id, "talk").ok);
releaseMatch(base.career.id, lease);
useNpcStore.setState({ careerId: "different-career" });
assert(!useGameStore.getState().approachNpc(talk.npc.id, "talk").ok);
console.log(
  "PASS store integration: NPC Elo preserved, no double reward, abandoned invitations clear, activity locks and career isolation.",
);

let social = base,
  firstWeekGain = 0;
for (let day = 0; day < 70; day++) {
  const response = approachNpc(social, talk.npc, "talk");
  assert(response.ok);
  social = response.save;
  if (day === 6) firstWeekGain = relationshipAt(social, talk.npc.id).closeness;
  social = endDay(social).save;
}
assert(firstWeekGain <= 12);
assert(relationshipAt(social, talk.npc.id).closeness >= 55);
assert.equal(
  relationshipLabel(relationshipAt(social, talk.npc.id)),
  "Close friends",
);
assert(relationshipAt(social, talk.npc.id).closeness <= 100);
for (let day = 0; day < 100; day++) social = endDay(social).save;
const aged = relationshipAt(social, talk.npc.id).closeness;
for (let i = 0; i < 30; i++)
  social = recordRatedContact(social, talk.npc.id, "draw");
assert.equal(
  relationshipAt(social, talk.npc.id).closeness,
  aged,
  "repeated meetings do not apply inactivity decay repeatedly",
);
assert(aged < 100);
const legacy = upgradeSave({ ...competitive, social: undefined, version: 14 });
assert.equal(relationshipAt(legacy, rival.id).closeness, 0);
assert.equal(relationshipAt(legacy, rival.id).ratedGames, 100);
assert.deepEqual(
  upgradeSave(JSON.parse(JSON.stringify(social))).social,
  social.social,
);
assert.equal(
  Object.keys(base.social!.relationships).length,
  0,
  "pure actions never mutate their input career",
);
console.log(
  "PASS gradual friendship, weekly cap, bounded values, idempotent decay and old-save migration without invented friends.",
);
console.log("All directory and social checks passed.");
