# Chess Career Mode

Latest release (save version 15): **Player Directory & NPC Relationships**.

- Complete → Rankings → Player directory includes the active saved character alongside NPCs, with a quick link to your own profile even when your rank is outside the first page. Names, countries, Elo, tiers and the displayed world ranks include your character consistently without changing the stored NPC-only ranking data.
- Your directory profile shows real identity, nationality, birth place, age, current/peak Elo, earned title, league, archetype, current skills, repertoire preferences, morale, recent rated form, retained training activity, coach, tournament history and friendships. Unrecorded information is not filled with invented NPC statistics.
- Every NPC profile has **Actions** and two separate relationship values. Familiarity grows from rated meetings and shared traditional/esports events; competitive encounters never award closeness by themselves. Closeness grows through accepted conversations, shared tactics study and meaningful invited friendly games. Relationships belong to one career and use stable NPC IDs.
- NPCs may accept or decline based on their personality, mood, rating gap and your relationship. One approach per NPC per game day prevents repeatedly rerolling an answer. Accepted talk costs 1 AP / 30 minutes; shared study uses 1 AP / 1 hour and the normal training XP rules; starting an accepted friendly game costs 1 AP / 1 hour. Declines use no AP or hours. Busy or era-inactive players cannot accept incompatible activities.
- **Play friendly** opens a real unrated match against that NPC. The result does not change either career Elo. Friendship credit requires human participation and at least twelve half-moves, or a checkmate; cancelling, abandoning or only simulating the game gives no credit. Closeness growth is capped at twelve points per NPC per game week and fades slowly after prolonged inactivity.
- Old saves upgrade in place: retained competitive history seeds familiarity, while old encounters never invent past friendships. Interrupted friendly invitations and games recover safely, and contacts remain separate between save slots.

Run `npm run test:social` for directory ranks, social actions, resource costs, deterministic replies, friendly-match completion/recovery, caps and migration. Production browser coverage is in `tests/social.spec.ts`.

Previous release (save version 14): **Living World & Year in Review**.

- Three foreign circuit events per game week (156 per 52-week year), with hosts across six continents, rapid/blitz/open formats and international challengers. Existing travel fees, entry requirements, registration limits and historical references still apply. Added circuits are fictional career events.
- NPC tournament history now records every participant in completed traditional and esports events, including points, placement, W/D/L and the game week. Retained old tournament archives are reconciled once on load; deleted/unretained events cannot be reconstructed.
- The existing weekly World Circuit now runs multiple three-round fields instead of selecting eight random players and recording only the winner. Active NPCs rotate through an eight-week schedule; the top sixteen have additional opportunities every other week, except when already booked in an active competition. All entrants receive results and result-based Elo updates. Rankings refresh immediately, and legends keep career rating changes separately from their historical Elo curve.
- At the end of week 52, a Year in Review dialog summarizes Elo, annual peak, rated wins/draws/losses, tournaments and podiums, esports, practice, training, cash, reputation, titles and skill changes. Reopen saved reports under **Career → Year in review**. Dedicated counters survive the normal history limits. Saves upgraded mid-year clearly mark the figures available from retained history; full-year tracking starts with the next year.
- Draws already exist: stalemate, insufficient material, repetition, the fifty-move rule and accepted agreements. Simulated boards sample the existing W/D/L forecast; played games use the board rules and are never forced to match a predicted draw percentage. Few draws in a short run, especially against much weaker/stronger opponents, can occur naturally.

Run `npm run test:world-activity` for world participation, NPC history, annual tracking, old-save and draw-rule regressions. The phone-sized browser checks are in `tests/world-activity.spec.ts`.

Previous release: **Match Prediction & Calibration**.
See `CHANGELOG.md` for release history and `verification/prediction/` for verification evidence.

- Separate the exact Elo expected score from deterministic win/draw/loss probabilities. Both the raw Elo and bounded context model preserve `E = W + D/2` and `W + D + L = 1`. Displayed odds total 100.00%.
- Use real player skills/attributes, bounded form/morale/fatigue/preparation/colour effects and clearly marked NPC skill estimates. Use the Online Blitz rating pool for its rating, peak, form and head-to-head history.
- Show pre-match forecasts on Home, Tournament, Swiss pairings, Prepare/Scout, individual/practice/esports setups and the Match Viewer. Freeze each played game's original forecast before move one. Keep the original forecast in history and replays.
- **Career → Match predictions** contains Accuracy, Upsets and Model settings. Match predictions are shown on the match page before each game starts (including every tournament round); there is no player-facing Elo calculator.
- Learn draw-rate residuals from newly recorded games, with sparse-group fallback, smoothing, seven grouping dimensions and bounded storage. NPC regular boards use the same W/D/L model. Older games without a recorded forecast are never retroactively predicted.
- Track Brier score, natural-log loss, top-choice accuracy, class-wise reliability bins and career/NPC upset records. Separate career, practice and NPC samples. Forfeits, byes, nonstandard training positions and interruptions do not train the draw model.
- Draw priors/coefficients are configurable game-design parameters, not externally fitted FIDE statistics. NPC numeric skills are estimates from existing NPC fields. Self-generated NPC results establish internal calibration, not real-world predictive accuracy. Engine Elo remains approximate.

Features retained from Multi-Day Tournaments & Esports:

- Tournament finder: Official / Unofficial, single / multiple days, 3 / 7 days, all-player rotation or BO3, plus the previous Elo / continent / capacity / start-range filters.
- Three new rotating events each calendar month: 3-day single round robin, 7-day single round robin, and 7-day BO3 against every opponent. Existing single-day rapid/blitz events remain.
- Each event shows its daily maximum games and HH:MM itinerary. Active tournaments show their match-day clock; other career screens keep date-only time. Future-day games are blocked until the career calendar actually reaches their day. Match-day advancement restores normal daily resources; missed games are forfeited.
- Organizer names no longer append “(career simulation)”. Historical reference facts remain distinct from career schedules/results.
- Complete → Tournament now switches between **Chess tournaments** and **Esports**, retaining the six existing main submenus.
- Esports: Duo / Trio squads, Free Agency, rare elite offers, paid club contracts, owned teams, NPC invitation refusals, qualifiers, weekly cups and monthly finals. Set Traditional / Esports / Mixed as your focus without locking the other circuit.
- D 1800–2000; C 2001–2200; B 2201–2500; A 2501–2699; S 2700+. Developing players may enter D qualifiers with a temporary pickup squad. Monthly finals require a top-two qualifier pass.
- Esports uses separate bookings/team standings/history while sharing career Elo and the calendar. The player's board runs through the normal chess engine; teammate/NPC boards settle from ratings. Calendar conflicts, duplicate results, salaries and prizes are guarded.
- Keep three save slots, national names/birthplace, shared SVG chess pieces, move annotations, training, federation and earlier features. Old saves upgrade automatically.

All new team names and circuit events are fictional, inspired by [Liquipedia's tournament categories](https://liquipedia.net/chess/Portal:Tournaments). Elo bands, Duo/Trio rules and schedules are game design, not Liquipedia's classification policy or historical results. Standard Swiss retains its documented custom pairing engine, not certified FIDE Dutch software.

After extracting the project ZIP:

```sh
cd Chess-Career-Mode
npm ci
npm run typecheck
npm run test:prediction
npm run test:world-activity
npm run test:esports
npm run test:complete
npm run build
npm run dev -- --host 0.0.0.0
```

Open `http://127.0.0.1:5173` on the same device. `0.0.0.0` is the server binding address. Keep the same browser/origin to retain browser-local saves. The ZIP excludes node_modules and dist; npm ci uses the included lockfile.

`test:match` plays/analyzes full engine games and takes minutes. Cloud/Chromium tests are not measurements on a physical phone or Termux. Project documentation is kept in this README and `CHANGELOG.md`; older standalone reports have been removed.

Stage 1: foundation (shell, navigation, state, UI kit). Stage 2: world database. Stage 3: character creation. Stage 4: dashboard, profile and career. Stage 5: training. See `CHANGELOG.md` for details of every change.

## Run
```
npm install      # also builds the city files (postinstall)
npm run dev
npm run test:world   # Node 22+: checks the NPC database (count, determinism, tiers, legends)
npm run test:play    # Node 22+: openings, PGN, engine wrapper, practice games, no-bias guarantee
```

## World database
- **Countries** – `src/data/world/countries.ts` reads the maintained `world-countries` dataset (ISO 3166-1 plus territories): name, nationality (demonym), code, flag emoji, continent. England, Scotland and Wales are added as FIDE home-nation federations. Flag emoji do not render on Windows desktop browsers; the country name always appears beside them.
- **Federations** – FIDE code (ISO alpha-3 with FIDE's known exceptions) plus a name. Names are generated as "<Country> Chess Federation" except for a handful of well-known ones.
- **Cities** – `scripts/build-world-data.mjs` converts the `all-the-cities` (GeoNames, population >= 1000) package into one file per country in `public/data/cities/`. The selector loads the file for the chosen country, shows the largest cities first, searches the rest, and accepts custom entries. Same-named towns in a country are collapsed to the largest. If the files are missing it falls back to curated major cities + capital, still with custom entry. Rebuild with `npm run build:data`.
- **NPCs** – `src/game/npc/`. 4,000 fictional players (deterministic from `GAME_CONFIG.world.seed`, ID `npc-0001`...), a catalog of 82 historical legends, local cohorts and 100–250 new annual competitors. Fixed tier quotas guarantee beginners through legendary players. Each NPC is generated from its own seeded RNG, so IDs and attributes are stable.
- **Persistence** – up to `GAME_CONFIG.saveSlots` (3) characters live side by side (`store/saveSlots.ts`); the open one is the game store's save. Each character has its own NPC world in the `careerNpcs` IndexedDB store, keyed by career id, written once and loaded on later launches. A world is rebuilt only if the seed, schema version or count in `GAME_CONFIG` changes, or when a new career starts. Changed NPCs are written back individually (`store/npcRepository.ts`). A single save from before slots existed becomes slot 1, with its NPC world, the first time it loads.
- **Legends** – `src/data/chess/legends.ts`. They only hold a ranking in the years they were active (Elo interpolated from `ratings`). Alternate history mode (character creation or Profile) places every legend in their prime. Pre-1970 Elo values are retrospective estimates and dates are best-effort; edit the file to adjust.

## Structure
- `src/types` – interfaces (Player, Npc, Country, City, World, GameSave...)
- `src/data` – config and static data (`world/`, `chess/`)
- `src/game` – pure logic, no React (NPC generation, world state, rankings, city search, career history, training, chess rules)
- `src/store` – Zustand stores (save in `gameStore`, NPC world in `npcStore`) and the IndexedDB repository
- `src/features` – creation, profile, world (directory, profile modal, city service)
- `src/components`, `src/pages`, `src/hooks`, `src/utils`

## Character creation (stage 3)
- **Wizard** – `src/features/creation/`: identity, archetype, look, start year, confirm. Steps validate before advancing, earlier steps can be revisited, and changing nationality clears the city.
- **Archetypes** – `src/data/archetypes.ts`. Each adds a net +16 starting skill points (checked by `npm run test:world`), sets tendencies (aggression, complexity, risk, resilience, adaptability) and a training-speed affinity. No skill is ever locked.
- **Appearance** – `src/data/appearance.ts` holds every option; `src/game/appearance/portraitSvg.ts` draws the portrait as SVG from those tables (pure function, unknown values are replaced, so injecting the SVG is safe). `npm run` the script `scripts/render-portraits.ts` to preview samples. The appearance is saved on the player and shown in the top bar and Profile.
- **Start year** – 1950 to 2026 (`GAME_CONFIG.startYear`). The NPC world is built for that year: legends are filtered and aged by `resolveLegend` (Kasparov and Karpov in 1985, a 14-year-old Carlsen in 2005), fictional players get era-appropriate Elo ceilings, tier mixes, federation strength and real tournament names (`data/chess/historicalEvents.ts`). Alternate history puts every legend in their prime.
- **Permanent link** – `GameSave.career` (`CareerRecord`) stores the career id, start year, country, city and `databaseKey`. The NPC database in IndexedDB is stamped with that key and rebuilt only if it does not match. No action changes country, city or start year.
- **Starting values** – all in `GAME_CONFIG.player` (Elo 1000, 0 rated games, money, AP, morale, skills, age). The league is derived from the starting Elo.
- Saves from stages 1 and 2 are discarded on upgrade and the player creates a new career. Saves from version 3 and later are upgraded in place (`game/training/migrate.ts`).

## Dashboard, profile and career (stage 4)
- **Career history** – `GameSave.history` holds games, tournaments, trophies, news, training and sessions, ledger, titles and rating history. Every statistic on Home, Profile and Career is derived from it and from the player; nothing is invented.
- **Match engine hook** – call `recordGame` or `recordTournament` (also actions on `gameStore`) when a game or tournament ends. They update rating, peak, league, titles, Elo milestones, trophies, rivalries, prize money and news.
- **Rankings** – `game/world/standings.ts` ranks the player among the NPCs holding a world ranking, by world, nationality, home city and league.
- **Titles** – CM 2200, FM 2300, IM 2400, GM 2500 peak Elo (`data/titles.ts`, shared with the NPC world).
- **Morale** – `game/player/morale.ts`: baseline plus recent results, losing streak, tournament form, training, fatigue and recent achievements, all shown on Home.
- **Tournaments** – `game/world/schedule.ts` builds a deterministic upcoming schedule from country, city, rating and reputation. Register in advance under Complete > Tournament; paid entries become playable in their starting week (see `game/match/tournament.ts`).

## Training (stage 5)
- **Sessions** – 19 sessions in `data/trainingSessions.ts`. `game/training/engine.ts` applies them: AP, money, hours, fatigue, morale, experience.
- **Experience** – each stat has an XP pool; `xpNeeded` rises with level and `diminishing` cuts gains for developed stats. Session quality is random, so nothing is guaranteed. Tune the curve in `GAME_CONFIG.sessions`.
- **Time** – 8 training hours a day. Rest and End Day recover fatigue, restore AP and advance day, week and year (the NPC world follows the date).
- **Skills and attributes** – 8 skills plus 10 attributes (`data/stats.ts`). The Profile Skills tab still upgrades skills with AP.
- **Openings and positions** – `data/chess/openingBook.ts` (40 openings, SAN main lines) and `game/chess/board.ts` (legal moves, SAN, FEN). `npm run test:world` checks the engine with perft counts and plays every opening line.
- Save version 6. Saves from versions 3–5 upgrade in place; existing version 6 saves remain compatible.

## Practice games and openings (stage 6)
- **Stockfish** – the `stockfish` npm package is copied into `public/engine/` by `scripts/copy-engine.mjs` after `npm install`; it runs in a Web Worker (`src/game/engine/stockfish.ts`). Single-thread builds are tried first, so no special server headers are needed. If the files are missing or fail, `EngineManager` switches to the built-in engine (`builtin.ts`). Run `node scripts/copy-engine.mjs` by hand if `public/engine/` is empty.
- **Opening data** – `src/data/chess/eco/ecoData.ts` is generated by `scripts/build-eco-data.mjs` from lichess-org/chess-openings (CC0, public domain). Popularity, difficulty and eras in `eco/meta.ts` are editorial estimates, not counted from games. Import a PGN game collection to replace popularity with real counts.
- **Ratings-only simulation API** – `simulateGame(db, save.repertoire.preferences, input)` keeps opening preferences independent of its result when no forecast is supplied. Callers can now pass a previously frozen context forecast; those results sample that exact W/D/L distribution. Actual board games continue to be decided by legal moves, clocks and engine play.


## Match viewer (stage 7)
- `src/game/match/` – referee (chess.js plus built-in rules), clock, NPC strength model, engine review, session controller, tournaments, career aftermath. No React inside; `MatchSession` is tested headless.
- `src/features/match/` – board with drag and drop, clocks, evaluation bar, move list, setup, tournament panel, history and the analysis report. Opened from the Complete page.
- `npm run test:match` verifies all of it.

## Verification and reproducible setup

The chess core caches repeated position work and keeps board/clock rendering scoped to the components that need updates.
Run `npm run bench:chess` for a repeatable perft benchmark, and
`npm run test:chess-cache` for mutable-position, returned-move and frozen-input regressions.
The phone-sized live/review board and clock lifecycle checks run with `npm run test:e2e`.

Use Node.js 22.6 or newer (the verification scripts use native TypeScript stripping).
The committed `package-lock.json` pins the tested dependency versions.

```sh
npm ci
npm run typecheck
npm run build
npm run test:world
npm run test:play
npm run test:data
npm run test:engine
npm run test:session
npx playwright install chromium
npm run test:e2e
```

`test:e2e` serves the production build on port 4173. Run `npm run build` before it.
To use a locally installed Chromium instead of Playwright's download:
`CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` (Linux/macOS).
The browser tests create isolated careers using the real UI, play each mode,
check real Stockfish and the fallback, and verify PGN/persistence using IndexedDB.
No application dependencies are replaced with mocks.

The generated `public/engine/` and `public/data/cities/` are rebuilt by `npm ci`.
The full-project ZIP includes these generated assets for convenience; `npm ci` regenerates them from the locked dependencies. `dist/`
is generated by `npm run build`; never serve the TypeScript source as a production build.
Online Blitz pairs simulated opponents; it has no network multiplayer server.

Verification logs are retained in `verification/` and `performance-evidence/logs/`.

For the additional real-worker stress test, start `npm run dev -- --port 5175`
then run `npm run test:engine:browser` in another terminal. `ENGINE_TEST_URL`
overrides the dev server URL; `CHROMIUM_PATH` selects a local Chromium.
It checks 16 legal plies at several strengths and tests missing manifest/WASM.
Fonts are bundled from Fontsource, so the app no longer requests Google Fonts at runtime.
Stockfish 16.0.0 uses its upstream default classical evaluation (`Use NNUE=false`);
this build does not download or enable an extra NNUE network. Elo remains approximate.

## Deploy to Vercel

Import this repository into Vercel with the project root set to the directory containing `package.json` and `vercel.json`.
Use the Vite framework preset, `npm run build` as the build command and `dist` as the output directory.
The normal install (`npm ci`) runs postinstall to generate the city data and copy Stockfish assets; do not disable install scripts.

`vercel.json` rewrites application URLs to `index.html` so React Router can handle direct links and refreshes on `/complete`, `/career`, `/train` and `/profile`. Existing static files are served normally.
After pushing this configuration to the branch connected to Vercel, wait for the new production deployment to become Ready, then open `/complete` directly and refresh it. An existing browser save is loaded as usual; a new browser will show character selection first.
If the route still returns Vercel's 404, confirm that the deployment includes this commit and that Vercel's Root Directory points to the folder containing `vercel.json`.

## Third-party credits

The twelve Cburnett SVG chess pieces are by Colin M. L. Burnett, licensed under GNU GPL version 2 or later. Their unchanged source, attribution and license are retained in `public/pieces/cburnett/` (see `ATTRIBUTION.txt` and `LICENSE.txt`). The artwork license does not declare a license for the application code.

Stockfish's GPLv3 notices and source links are kept beside the generated engine files in `public/engine/`, including `SOURCE.txt` and the upstream notices. The copy script preserves Markdown notices as `.txt` files so project Markdown stays limited to `README.md` and `CHANGELOG.md`.
