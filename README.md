# Chess Career Mode

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
- **NPCs** – `src/game/npc/`. 1,200 fictional players (deterministic from `GAME_CONFIG.world.seed`, ID `npc-0001`...) plus 23 historical legends. Fixed tier quotas guarantee beginners through legendary players. Each NPC is generated from its own seeded RNG, so IDs and attributes are stable.
- **Persistence** – the NPC database lives in its own IndexedDB store, written once and loaded on later launches. It is rebuilt only if the seed, schema version or count in `GAME_CONFIG` changes, or when a new career starts. Changed NPCs are written back individually (`store/npcRepository.ts`).
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
- **Tournaments** – `game/world/schedule.ts` builds a deterministic upcoming schedule from country, city, rating and reputation. Events held this week can be entered and played from Complete > Tournaments (see `game/match/tournament.ts`).

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
- **Tournament simulation** – call `simulateGame(db, save.repertoire.preferences, input)`; the result depends only on the ratings.


## Match viewer (stage 7)
- `src/game/match/` – referee (chess.js plus built-in rules), clock, NPC strength model, engine review, session controller, tournaments, career aftermath. No React inside; `MatchSession` is tested headless.
- `src/features/match/` – board with drag and drop, clocks, evaluation bar, move list, setup, tournament panel, history and the analysis report. Opened from the Complete page.
- `npm run test:match` verifies all of it.

## Verification and reproducible setup

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
The verified delivery ZIP also contains those assets for convenience. `dist/`
is generated by `npm run build`; never serve the TypeScript source as a production build.
Online Blitz pairs simulated opponents; it has no network multiplayer server.

See `VERIFICATION.md` for results, fixes and practical limits of this review.

For the additional real-worker stress test, start `npm run dev -- --port 5175`
then run `npm run test:engine:browser` in another terminal. `ENGINE_TEST_URL`
overrides the dev server URL; `CHROMIUM_PATH` selects a local Chromium.
It checks 16 legal plies at several strengths and tests missing manifest/WASM.
Fonts are bundled from Fontsource, so the app no longer requests Google Fonts at runtime.
Stockfish 16.0.0 uses its upstream default classical evaluation (`Use NNUE=false`);
this build does not download or enable an extra NNUE network. Elo remains approximate.
