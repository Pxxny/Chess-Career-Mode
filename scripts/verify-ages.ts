import { ADULT_AGE, eloCapForAge, minAgeForElo } from '../src/data/chess/ages.ts';
import { TIERS } from '../src/data/chess/tiers.ts';
import { buildWorldNpcs } from '../src/game/npc/buildWorldNpcs.ts';

let failed = false;
const ok = (cond: boolean, message: string) => {
  if (!cond) {
    failed = true;
    console.log(`FAIL: ${message}`);
  }
};

// the Elo ceiling by age
ok(eloCapForAge(8) < 2000 && eloCapForAge(12) >= 2400 && eloCapForAge(14) >= 2500 && eloCapForAge(18) === Infinity, 'age/Elo ceiling curve');
ok(minAgeForElo(1200) === 8 && minAgeForElo(2500) === 13 && minAgeForElo(2700) === 16 && minAgeForElo(3000) === ADULT_AGE, 'youngest age for a rating');
for (let age = 8; age < 17; age++) ok(eloCapForAge(age) <= eloCapForAge(age + 1), `ceiling must not fall from ${age} to ${age + 1}`);

for (const year of [1950, 1985, 2026]) {
  const npcs = buildWorldNpcs(year).filter((n) => n.kind === 'fictional');
  const again = buildWorldNpcs(year).filter((n) => n.kind === 'fictional');
  ok(JSON.stringify(npcs.map((n) => [n.id, n.age, n.dateOfBirth])) === JSON.stringify(again.map((n) => [n.id, n.age, n.dateOfBirth])), `${year}: ages are not deterministic`);

  const youth = npcs.filter((n) => n.age < ADULT_AGE);
  ok(youth.length / npcs.length > 0.08 && youth.length / npcs.length < 0.2, `${year}: ${youth.length} of ${npcs.length} under 18 is not a plausible share`);
  ok(npcs.every((n) => n.age >= 8 && n.age <= 70), `${year}: an NPC is outside 8-70`);
  const tooStrong = youth.filter((n) => n.currentElo > eloCapForAge(n.age));
  ok(tooStrong.length === 0, `${year}: ${tooStrong.length} young NPCs are stronger than their age allows (${tooStrong[0]?.age}y ${tooStrong[0]?.currentElo})`);
  const prodigies = youth.filter((n) => n.age <= 15 && n.currentElo >= 2000);
  ok(prodigies.length >= 3, `${year}: only ${prodigies.length} prodigies of 15 or younger rated 2000+`);

  const rows: string[] = [];
  for (const tier of TIERS) {
    const group = npcs.filter((n) => n.tier === tier.id);
    if (group.length === 0) continue;
    const ages = group.map((n) => n.age).sort((a, b) => a - b);
    const young = group.filter((n) => n.age < ADULT_AGE).length;
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    ok(ages[0] >= tier.age[0] && ages[ages.length - 1] <= tier.age[1], `${year}: ${tier.id} ages ${ages[0]}-${ages[ages.length - 1]} outside ${tier.age.join('-')}`);
    ok(Math.abs(mean - tier.ageMean) < Math.max(4, tier.ageSd * 0.6), `${year}: ${tier.id} mean age ${mean.toFixed(1)} is far from ${tier.ageMean}`);
    ok(young / group.length <= tier.youthShare * 2 + 0.03, `${year}: ${tier.id} has too many young players (${young}/${group.length})`);
    rows.push(`${tier.id}: n=${group.length} age ${ages[0]}-${ages[ages.length - 1]} mean ${mean.toFixed(0)} median ${ages[Math.floor(ages.length / 2)]} under18 ${young}`);
  }
  if (year === 2026) console.log(rows.join('\n'));
  console.log(`${year}: ${npcs.length} fictional NPCs, ${youth.length} under 18, ${prodigies.length} prodigies (<=15, 2000+), youngest 2500+: ${Math.min(...npcs.filter((n) => n.currentElo >= 2500).map((n) => n.age))}`);
}

if (failed) {
  console.log('\nNPC AGE VERIFICATION FAILED');
  process.exit(1);
}
console.log('\nNPC age verification passed');
