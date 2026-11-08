import { randomAppearance } from '../src/data/appearance.ts';
import { createCareerRecord } from '../src/game/career/createCareer.ts';
import { createNewSave } from '../src/game/createNewSave.ts';
import { ageAtStart, birthDateProblem, defaultBirthDate, isRealDate, parseIsoDate, resolveBirthDate, toIsoDate } from '../src/game/player/birth.ts';
import { createPlayer } from '../src/game/player/createPlayer.ts';
import { endDay } from '../src/game/training/engine.ts';
import { createMemoryNpcBackend, deleteNpcDatabase, metaFor, putNpcs, readNpcDatabase, writeNpcDatabase } from '../src/store/npcRepository.ts';
import { createMemorySlotBackend, createSlotManager, summarize } from '../src/store/saveSlots.ts';
import type { Npc } from '../src/types/index.ts';
import { ageOn } from '../src/utils/dates.ts';

let failed = false;
const ok = (cond: boolean, message: string) => {
  if (!cond) {
    failed = true;
    console.log(`FAIL: ${message}`);
  }
};

const base = { name: 'Test', gender: 'undisclosed' as const, countryCode: 'NO', city: { name: 'Oslo', custom: false }, archetype: 'balanced' as const, appearance: randomAppearance(), startYear: 2020, alternateHistory: false };

// ---- date of birth
ok(toIsoDate(defaultBirthDate(2026)) === '2011-06-15' && ageAtStart(defaultBirthDate(2026), 2026) === 14, 'default birth date makes a 14-year-old');
const legacyStyle = createPlayer(base, 2020);
ok(legacyStyle.age === 14 && legacyStyle.dateOfBirth === '2005-06-15', `no date of birth should keep the old default (${legacyStyle.dateOfBirth}, ${legacyStyle.age})`);
const chosen = createPlayer({ ...base, dateOfBirth: '2000-03-20' }, 2020);
ok(chosen.dateOfBirth === '2000-03-20' && chosen.age === 19, `chosen date of birth ignored (${chosen.dateOfBirth}, ${chosen.age})`);
ok(ageOn('2000-03-20', 2020, 11) === 19 && ageOn('2000-03-20', 2020, 13) === 20, 'the birthday must move the age up on the right week');
ok(createPlayer({ ...base, dateOfBirth: '2018-01-01' }, 2020).dateOfBirth === '2005-06-15', 'a date that makes the player too young must fall back to the default');
ok(createPlayer({ ...base, dateOfBirth: 'not a date' }, 2020).age === 14 && createPlayer({ ...base, dateOfBirth: '2001-02-30' }, 2020).age === 14, 'an impossible date must fall back to the default');
ok(parseIsoDate('2004-02-29') !== null && ageAtStart(parseIsoDate('2004-02-29')!, 2020) === 15, 'leap day birthday');
ok(parseIsoDate('2003-02-29') === null && parseIsoDate('2000-13-01') === null && parseIsoDate('2000-00-10') === null && parseIsoDate('2000-1-1') === null, 'impossible dates must not parse');
ok(isRealDate({ year: 2000, month: 12, day: 31 }) && !isRealDate({ year: 2000, month: 4, day: 31 }) && !isRealDate({ year: 1800, month: 1, day: 1 }), 'isRealDate');
ok(birthDateProblem({ year: 2012, month: 1, day: 1 }, 2020) === null, 'age 8 is allowed');
ok(birthDateProblem({ year: 2012, month: 6, day: 1 }, 2020) !== null, 'age 7 must be refused');
ok(birthDateProblem({ year: 1960, month: 1, day: 1 }, 2020) === null && birthDateProblem({ year: 1959, month: 6, day: 1 }, 2020) === null && birthDateProblem({ year: 1959, month: 1, day: 1 }, 2020) !== null, 'age 60 allowed, 61 refused');
ok(birthDateProblem({ year: 2021, month: 1, day: 1 }, 2020) !== null, 'a player born after the start year must be refused');
ok(resolveBirthDate('1999-12-31', 1960).year === defaultBirthDate(1960).year, 'a birth date after the start must fall back');
const defaultDob1990 = toIsoDate(defaultBirthDate(1990));
const dobSave = createNewSave({ ...base, dateOfBirth: '1995-09-09', startYear: 1990 }, createCareerRecord({ ...base, dateOfBirth: '1995-09-09', startYear: 1990 }));
ok(dobSave.player.dateOfBirth === defaultDob1990, 'a birth date after the start year falls back to the default');
const dobSave2 = createNewSave({ ...base, dateOfBirth: '1980-09-09', startYear: 1990 }, createCareerRecord({ ...base, startYear: 1990 }));
ok(dobSave2.player.age === 9 && dobSave2.player.dateOfBirth === '1980-09-09', `save carries the chosen date (${dobSave2.player.age})`);
// the age follows the calendar as days pass
let aged = createNewSave({ ...base, dateOfBirth: '2005-01-10', startYear: 2020 }, createCareerRecord(base));
ok(aged.player.age === 14, `age at start: born 10 Jan 2005, start 1 Jan 2020 (${aged.player.age})`);
for (let i = 0; i < 14; i++) aged = endDay(aged).save;
ok(aged.player.age === 15, `age after the 10 January birthday (${aged.player.age})`);

// ---- save slots
const slotSave = (name: string, id: string) => JSON.stringify({ state: { save: { ...createNewSave({ ...base, name }, { ...createCareerRecord(base), id }) } }, version: 7 });
const closed = JSON.stringify({ state: { save: null }, version: 7 });
const run = async () => {
  // a save from before slots existed becomes slot 1
  const old = createMemorySlotBackend();
  await old.set('chess-career-mode-save', slotSave('Veteran', 'career-old'));
  const m1 = createSlotManager(old);
  await m1.init();
  ok(m1.getActive() === 1, 'legacy save should open in slot 1');
  const list1 = await m1.listSlots();
  ok(list1[0].kind === 'character' && list1[1].kind === 'empty' && list1[2].kind === 'empty' && list1.length === 3, 'legacy save listed in slot 1 only');
  ok(old.entries()['chess-career-mode-save'] === undefined, 'legacy key should be removed after the move');
  ok((await m1.storage.getItem()) === slotSave('Veteran', 'career-old') || (await m1.storage.getItem()) !== null, 'storage reads the active slot');
  ok((await m1.firstFreeSlot()) === 2, 'first free slot');

  // a fresh browser
  const fresh = createMemorySlotBackend();
  const m2 = createSlotManager(fresh);
  ok((await m2.storage.getItem()) === null && m2.getActive() === null, 'fresh browser: nothing open');
  await m2.storage.setItem('x', closed);
  ok(Object.keys(fresh.entries()).every((k) => k.endsWith('-slots')), 'a closed game must not be written anywhere');

  // two characters side by side
  await m2.setActive(2);
  await m2.storage.setItem('x', slotSave('Alice', 'career-a'));
  await m2.setActive(3);
  await m2.storage.setItem('x', slotSave('Bob', 'career-b'));
  const list2 = await m2.listSlots();
  ok(list2[0].kind === 'empty' && list2[1].kind === 'character' && list2[2].kind === 'character', 'slots 2 and 3 filled');
  ok(list2[1].kind === 'character' && list2[1].summary.name === 'Alice' && list2[2].kind === 'character' && list2[2].summary.name === 'Bob', 'each slot keeps its own character');

  // a write made right after switching goes to the new slot, and an old pending write still reaches the old one
  const pendingForBob = m2.storage.setItem('x', slotSave('Bob', 'career-b').replace('"name":"Bob"', '"name":"Bobby"'));
  const switching = m2.setActive(2);
  const pendingForAlice = m2.storage.setItem('x', slotSave('Alice2', 'career-a'));
  await Promise.all([pendingForBob, switching, pendingForAlice]);
  const after = await m2.listSlots();
  ok(after[2].kind === 'character' && after[2].summary.name === 'Bobby', 'a write made before switching must stay in the old slot');
  ok(after[1].kind === 'character' && after[1].summary.name === 'Alice2', 'a write made after switching must go to the new slot');

  // closing a character keeps it, and writes stop
  await m2.setActive(null);
  await m2.storage.setItem('x', slotSave('Ghost', 'career-g'));
  ok((await m2.listSlots()).every((s) => s.kind !== 'character' || s.summary.name !== 'Ghost'), 'nothing is written while no character is open');
  ok((await m2.storage.getItem()) === null, 'no character open: nothing to load');

  // reopening restores the open slot after a restart
  await m2.setActive(3);
  const restarted = createSlotManager(fresh);
  ok((await restarted.storage.getItem()) !== null && restarted.getActive() === 3, 'the open slot must survive a restart');

  // deleting
  await restarted.deleteSlot(3);
  ok(restarted.getActive() === null, 'deleting the open slot closes it');
  const afterDelete = await restarted.listSlots();
  ok(afterDelete[2].kind === 'empty' && afterDelete[1].kind === 'character', 'only the deleted slot is emptied');
  await restarted.deleteSlot(2);
  ok((await restarted.listSlots()).every((s) => s.kind === 'empty') && (await restarted.firstFreeSlot()) === 1, 'all slots empty again');

  // damaged and invalid
  await fresh.set('chess-career-mode-save-slot-2', '{not json');
  ok((await restarted.listSlots())[1].kind === 'broken', 'unreadable data is reported as broken');
  let rejected = false;
  await restarted.setActive(4).catch(() => (rejected = true));
  ok(rejected, 'slot 4 does not exist');
  ok(summarize(1, undefined) === null && summarize(1, closed) === null, 'empty values have no summary');
  const sum = summarize(2, slotSave('Carol', 'career-c'));
  ok(!!sum && sum.name === 'Carol' && sum.careerId === 'career-c' && sum.rating === 1000 && sum.startYear === 2020 && sum.age === 14, 'summary fields');

  // ---- NPC worlds per character
  const fake = (id: string, elo: number): Npc => ({ id, name: id, currentElo: elo, age: 20 }) as unknown as Npc;
  const careerA = { ...createCareerRecord(base), id: 'A', databaseKey: 'k:A' };
  const careerB = { ...createCareerRecord(base), id: 'B', databaseKey: 'k:B' };
  const backend = createMemoryNpcBackend();
  await writeNpcDatabase([fake('n1', 1000), fake('n2', 1100)], careerA, backend);
  await writeNpcDatabase([fake('n1', 2000), fake('n2', 2100), fake('n3', 2200)], careerB, backend);
  await putNpcs([fake('n1', 1234)], 'A', backend);
  const a = await readNpcDatabase(careerA, backend);
  const b = await readNpcDatabase(careerB, backend);
  ok(a.npcs.length === 2 && b.npcs.length === 3, 'each career has its own world');
  ok(a.npcs.find((n) => n.id === 'n1')?.currentElo === 1234 && b.npcs.find((n) => n.id === 'n1')?.currentElo === 2000, 'a change in one world must not touch the other');
  ok(a.meta?.databaseKey === 'k:A' && b.meta?.databaseKey === 'k:B', 'meta per career');
  await deleteNpcDatabase('A', backend);
  ok((await readNpcDatabase(careerA, backend)).npcs.length === 0 && (await readNpcDatabase(careerB, backend)).npcs.length === 3, 'deleting a character removes only its world');

  // the single world of an older save moves to the career it belongs to
  const legacyBackend = createMemoryNpcBackend();
  legacyBackend.seedLegacy(metaFor(careerA), [fake('n1', 1500), fake('n2', 1600)]);
  ok((await readNpcDatabase(careerB, legacyBackend)).npcs.length === 0 && legacyBackend.dump().legacy.length === 2, 'the old world is not given to a different career');
  const moved = await readNpcDatabase(careerA, legacyBackend);
  ok(moved.npcs.length === 2 && legacyBackend.dump().legacy.length === 0, 'the old world moves into its career');
  ok((await readNpcDatabase(careerA, legacyBackend)).npcs.length === 2 && Object.keys(legacyBackend.dump().worlds).join() === 'A', 'and stays there');
};

await run();
if (failed) {
  console.log('\nCHARACTER VERIFICATION FAILED');
  process.exit(1);
}
console.log('Character verification passed: date of birth, save slots, per-character NPC worlds');
