> Archived report from an earlier release. Current Complete implementation and validation: [COMPLETE-REPORT.md](COMPLETE-REPORT.md).

# Career expansion — 8 November 2026

สรุปภาษาไทย: แก้ `clearSave` และเพิ่มระบบตามรายการแล้ว Look มีตัวเลือกใหม่ที่ใช้ได้ 50 รายการต่อเพศ (20 เฉพาะเพศ + 30 ใช้ร่วม), Legends รวม 82 คน, NPC รุ่นใหม่ปีละ 100–250 คนและเกษียณที่ 65, ข่าว, Federation, ทีมชาติ, Coach และรายชื่อผู้สมัคร Tournament

ทดสอบ browser ผ่าน 9/9 และตรวจ flow ข้ามปีซ้ำหลังปรับลำดับเกษียณ/เลือกผู้แข่งแล้ว ทีมชาติเป็น simulation, Coach ให้ผลด้าน XP และ Legends เส้นใหม่ใช้ค่าประมาณในเกม รายเดือนคือ 30 วันในเกม

ข้อจำกัดสำคัญจากรุ่นฐาน: **รอเกมจำลองจบก่อนสลับตัวละคร** เพราะบัคเดิมเรื่องผลเกมไปลงอีกเซฟยังไม่ได้แก้ในชุดขยายนี้ ดูรายละเอียดท้ายรายงาน

Implemented from the supplied **Date of Birth, Realistic NPC Ages, 3 Save Slots** ZIP.

## What changed

### clearSave / ResetSaveButton

The supplied ZIP did not contain ResetSaveButton.tsx. The reported error is consistent with that older file remaining after copying a ZIP over an existing repository. This release includes a compatible replacement component and a `clearSave(): Promise<void>` store action. It deletes only the currently open slot and its NPC database, with confirmation; other characters remain saved.

For updates, extract into a fresh directory and install with `npm ci`. The ZIP contains source and generated public assets; node_modules and dist are excluded.

### Look

Each gender has **50 newly available choices**: 10 gender-specific hairstyles + 10 gender-specific outfits + 10 shared accessories + 20 shared clothing colors. This is 70 new option records in total; shared options are available to both genders. Existing choices remain available.

New options change rendered SVG geometry, decoration or color and persist in Appearance. Randomize selects the male hairstyle/outfit pool for male, the female pool for female (with facial hair set to none), and the combined pool for other/unspecified genders. Manual customization remains available. SVG input still passes through the existing sanitizer.

### Legends

**82 legends total (+59)**, including **17 women** and **39 players born in 1980 or later**. Examples include Tarrasch, Pillsbury, Marshall, Bronstein, Reshevsky, Judit/Susan Polgar, Nakamura, Caruana, Ding, Nepomniachtchi, Giri, So, Gukesh, Erigaisi, Praggnanandhaa, Abdusattorov, Keymer, Hou Yifan and Ju Wenjun.

The added rating curves and career endpoints are simplified gameplay estimates, not a live FIDE database or independently verified historical rating series. New entries are marked `eloSource: estimate`. Gender is preserved for women. Existing legend IDs and fictional NPC progress are retained when missing legends are merged into old career databases.

### Annual NPC population

Crossing into a new game year adds **100–250 fictional entrants** aged 18–35. Examples for the configured seed: 2027 adds 159, 2028 adds 222, 2029 adds 163. New entrants have new stable IDs and no invented past tournament results; initial ratings cap at 2200.

The stored `recruit-YEAR-1` cohort marker prevents generating that year's population again after reload. Missing years can be caught up for older careers. Fictional competitors retire at **65**, disappear from active rankings/selection, and remain in the database/history. Historical legends follow their modeled active periods, and alternate-history mode retains its existing prime-legend behavior.

### News

Complete → News shows career messages and world activity:

- Weekly simulated eight-player knockout circuit: named winner and the seven simulated match results.
- Underdog upsets from those results and from individual tournaments.
- Named winner from completed individual tournament standings, including an NPC winner when the player loses.
- New annual entrants, retirements, federation membership, coaching lessons and national cup outcomes.

Circuit results depend on the seeded simulation and ratings, not randomly chosen headlines. The circuit is a world simulation, not seven engine-played chess games. Its winner gets a stored tournament-history entry. News retains the existing bounded history cap.

### Federation and national teams

New Complete tabs: **Federation**, **National teams**, **Coach**, **News**.

The federation directory uses the existing country database and its generated federation labels. A character represents their career nationality. Annual membership costs **$35**, expires at the next game year, unlocks national cup entry and discounts coaching fees by 10%. It does not renew automatically.

National Team Cup is an invented **simulated** annual competition. Your federation and up to seven leading nations play a round robin, four boards per fixture. Highest-rated active/semi-retired players make each lineup; you play when selected. Small federations may field fewer than four players; missing boards forfeit. Your membership and roster are visible before entering.

Selected players spend **2 AP** and receive **$20–160** appearance/prize money. Unselected members can follow the event without AP or a player prize. Individual Elo is unchanged; all national board results are stored separately with final standings. Only one cup can complete per career/year. An ongoing individual tournament must finish first.

### Coaches

There are **12 fictional coaches**, three levels, with specialty skills:

- Per game: one lesson after a qualifying game, then the contract ends.
- Weekly: 7 game days.
- Monthly: 30 game days.

Starting coach fees are $15/game, $60/week and $210/month before the federation discount. Higher levels cost more. Hiring charges the balance and ledger once; insufficient funds or an active contract block another hire. Canceling forfeits unused time. Expired contracts stop granting benefits; no automatic renewal.

Time-based contracts give **10/20/30% session XP** by coach level. Game lessons give **24/48/72 specialty XP**, with normal level thresholds and the skill cap. A played/practice game needs at least 12 plies or checkmate. Lessons cap at **4 per game day**; a game contract remains pending if the day's cap is already used. A selected player's simulated national board games can also receive lessons, subject to the cap. Coaching does not alter recorded engine accuracy or force wins.

### Tournament registration

Open the **NPC entrants** disclosure before registering or in Your registrations. It shows names, flags, ratings and ages. The roster is computed lazily when opened, avoiding repeated full-field selection for every closed event card.

New registrations save NPC IDs and the field seed. The tournament uses those identities at the start; ratings can evolve. Retired entrants are shown as withdrawn and excluded when play starts. If no eligible opponents remain, the event cancels and refunds the fee. Older registrations without snapshots use the existing fallback selection behavior.

## Persistence and checks

Save version is **8**. Older version 3–7 careers upgrade in place and get empty expansion state. Coaching, membership, cup results and lesson limits live inside the career's own save slot. NPC cohorts/retirements live in that career's IndexedDB namespace. No new runtime dependency was added.

Executed successfully on Node 24.22.1, npm 11.9.0 and Linux Chromium 156:

- npm ci
- npm run typecheck / npm run build
- npm run test:world
- npm run test:ages
- npm run test:characters
- npm run test:data
- npm run test:session
- npm run test:engine
- npm run test:play
- npm run test:match (251.986 seconds; referee cross-check 23,059 positions)
- npm run test:expansion
- Chromium production tests: **9/9 passed**, including the new mobile expansion flow

The added unit checks cover rendered Look options and gender randomization, deterministic cohorts/no duplicate IDs, retirement, migration, coach payment/expiry/lesson caps/XP, membership, national cup once-per-year/AP/prizes, circuit idempotency, stable registered entrants, and empty-field refunds.

The production UI test creates a female character with a burst of Create clicks, verifies one initial world, hires a coach, joins the federation, completes the cup, registers with an entrant snapshot, reloads, executes an actual End Day across a seeded year-end boundary, checks recruitment/retirement and reloads again to verify no duplicate cohort. It also opens the new News UI. Screenshots are under `artifacts/expansion-*.png`; test output is under `expansion-verification/`.

After the final ordering change (new-date population/retirement before selecting weekly circuit entrants), build and the expansion UI test were rerun successfully. The compatibility action also passed an isolated real-store test deleting the active character/world while preserving the second slot and its NPC world.

One initial mobile layout test failed because it opened statistics while its full background simulation had not finished. Its fixture now finishes a short real game before inspecting the dashboard. The final entire browser suite passed 9/9. No application behavior was changed to satisfy an outdated assertion.

## Limits and existing base issues

- This is a game simulation with modeled prices, careers and national-team rules; it is not live multiplayer, official federation software or live FIDE data.
- Existing reports from the base ZIP are historical evidence, not verification of this expansion. This release does not claim to resolve every issue in the previous read-only audit. In particular, finish background simulations before switching characters: the base global-store callback ownership issue still needs a separate persistence/session fix. Storage-failure recovery and exact daily DOB/calendar behavior also retain the base limitations.
- Existing fictional NPCs are not rerolled; new legends are appended and new entrants arrive on year transitions. Retired records remain, so long careers grow the database.
- Build succeeds with the existing large-bundle warning (over 500 kB). No performance gain is claimed from these feature additions.
- Tests ran here, not on the user's Termux device. Install dependencies locally rather than copying Linux node_modules to Android.

## Run locally

```sh
npm ci
npm run typecheck
npm run test:expansion
npm run build
npm run dev -- --host 0.0.0.0
```

Open `http://127.0.0.1:5173`. The new world systems are under Complete; Look is in character creation.
