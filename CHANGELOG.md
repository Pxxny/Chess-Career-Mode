# Changelog

## 2026-11-06 · Train: Games and Openings tabs (save version 6)
**Games tab** (`src/features/training/play/`)
- **Training Game**: play a ranked NPC. Choose opponent, an Elo override, colour, time control and objective (full game, opening practice, tactics, endgame, convert an advantage, defend, time management). The Opening objective makes the opponent follow the chosen book line. Costs 1 training hour (2 for long time controls); experience goes to the objective's skills. Optional per-move feedback, hints and take-backs. "Simulate instead" decides the result from the ratings only.
- **Online Blitz**: simulated server with 600 stable NPC players, matchmaking that widens its rating window, opponent profiles with head-to-head, 3+0 / 3+2 / 4+2 / 5+0 / 5+3, rated or casual, a provisional blitz rating, rating graph and match history. It is not real multiplayer.
- **Game vs the Engine**: Stockfish (WebAssembly, Web Worker, UCI) with presets and an Elo slider 500-3200, full strength, thinking time, hints and take-backs. The engine only ever plays moves checked by the rules engine. If Stockfish cannot load, a built-in alpha-beta engine plays and the screen says so. Elo is approximate.
- Post-game analysis for every game: evaluation graph, move labels (book/best/good/inaccuracy/mistake/blunder), accuracy for both sides, key moments, and feedback that depends on the objective. Finished games are listed in History and can be replayed.

**Openings tab** (`src/features/training/openings/`)
- **Browse**: 3,865 openings, 141 families and 500 ECO codes (A00-E99) from the CC0 lichess-org/chess-openings data, with name, ECO, main line, variations, move sequence, colour, description, difficulty, popularity and historical usage by era, plus a board to step through.
- **Preferences**: assign ordered openings to nine situations (As White, As Black, vs 1.e4/1.d4/1.c4/1.Nf3, vs aggressive, vs defensive, critical games).
- **Performance**: games, W/D/L, win rate, accuracy, opponent Elo, most common variation and knowledge level for every opening, from real games only, with a dashboard of charts.
- **Import**: PGN files or pasted text, as opening lines or as a game collection that replaces estimated popularity with real counts; export to PGN; remove a source.
- Difficulty, popularity and era profiles are editorial estimates until real counts are imported.
- `simulateGame()` (`src/game/openings/simulate.ts`) is the entry point for tournament simulation. Preferences only choose the recorded opening. Results and accuracy come from separate random streams that depend on the ratings only (checked over 4,000 seeds in `npm run test:play`).

**Changed**: `npm install` now also copies Stockfish into `public/engine/` (`scripts/copy-engine.mjs`). Save version 6 adds `practice` and `repertoire` (older saves upgrade automatically). Thematic Games sessions now also count as opening study.

## 2026-11-04 · Train section (save version 5)
**Added**
- Train page with three tabs: Sessions, Games, Openings (`src/pages/TrainPage.tsx`, `src/features/training/`).
- 19 training sessions in four categories (Chess 12, Mind 2, Body 2, Career Preparation 3), defined in `src/data/trainingSessions.ts`. Each has description, difficulty, hours, AP, money, required skills, expected XP, benefits, fatigue and morale effects. The recommended category is marked "⭐ RECOMMENDED".
- Training engine (`src/game/training/engine.ts`): experience points with diminishing returns, random session quality, 8 training hours per day, fatigue, daily and repeat limits, Short Break, Power Nap and End Day (sleep). Ending a day restores AP and advances the calendar (day, week, year) and the player's age.
- Ten new attributes trained alongside the eight skills (pattern recognition, visualization, concentration, opening preparation, positional understanding, mental stability, stamina, physical fitness, resilience, performance under pressure). Stamina lowers fatigue gain; fitness speeds recovery.
- Secondary menus: Thematic Games (opening plus White or Black), Scout Opponent, Tournament Preparation, Study Master Game. Scouting gives +3 accuracy against that opponent and a tournament plan gives +2 there (applied in `recordGame`).
- Thematic Games build positions from an opening's main line and ask for the main-line move; the score changes session quality.
- Opening database of 40 openings with validated main lines (`src/data/chess/openingBook.ts`). The original `OPENINGS` list is untouched, so NPC repertoires are unchanged.
- Small chess rules engine (`src/game/chess/board.ts`): legal moves, SAN, FEN. Verified with standard perft counts. Chess.js is not needed.
- `world.day`, `player.attributes`, `save.training` and `history.sessions` added to the save. Saves from version 4 upgrade automatically (`src/game/training/migrate.ts`).
- Morale now includes real fatigue and completed training sessions.

**Tests** (`npm run test:world`): session catalogue, costs and blocks, determinism, diminishing returns, daily limits, rest and calendar rollover, thematic positions for every opening in both colours, scouting and preparation bonuses, migration, recommendations.

## 2026-11-03 · Dashboard, Profile and Career (save version 4)
**Added**
- Home dashboard: ratings and rankings (world, national, city), chess titles and progress, competitions, last result, recent form, morale breakdown, career news.
- Profile page with Profile, Skills, Stats and Trophies tabs. Skills can be upgraded with AP.
- Career page: timeline, milestones, achievements, financial overview, reputation, rivals, career statistics.
- "AP" label in the top bar. Global navigation unchanged.
- Career history in the save (`GameSave.history`): games, tournaments, trophies, news, training, ledger, titles, rating history.
- `recordGame` and `recordTournament` (also on the store): the integration points for the match engine. They update rating, peak, titles, milestones, league promotions, rivalries, prize money and news.
- Deterministic tournament schedule from country, city, rating and reputation (`src/game/world/schedule.ts`).
- Components: Tabs, ResultBadge.

**Fixed**
- Games recorded in the same week were ordered wrongly; game order now follows the order played.

**Notes**
- A new career starts with no games, trophies or news. Empty states are shown instead of invented data.
- "Current tournament" always shows none until tournament play exists.

## 2026-11-03 · Blank screen after choosing a nationality
**Fixed**
- The app had no error boundary, so one render error unmounted everything. Added `ErrorBoundary` (app, each creation step, and the city selector).
- City data from `public/data/cities/*.json` is now validated; bad rows are dropped and a missing or invalid file falls back to the curated city list with custom entry still possible.
- `useCities` handles a failed load; choosing the same nationality again keeps the chosen city.
- Added `src/utils/log.ts`; recent diagnostics are available in the browser console as `window.__ccmLog`.

## 2026-11-06 — Real dependency verification and fixes

- Added a dependency lockfile, real production Playwright tests, and focused engine/data/session regression commands.
- Verified installed Stockfish JS/WASM in Chromium; fixed startup/search errors, prompt fallback status, disposal and strength limits.
- Fixed PGN variation result handling, escaped tags, unreadable tokens, custom-FEN statistics and atomic imported-source persistence.
- Load imported openings before Games, preserve legacy save version upgrades, and recover interrupted games exactly once after refresh.
- Corrected custom-FEN Black-first analysis/feedback, stale move/clock handling, career reset races and analysis accounting.
- Fixed creation wizard crash from returning scrollIntoView's result as an effect cleanup.
- Fixed phone opening-detail overflow, wrapped headers/badges, improved preference controls, chart/table scrolling and in-game simulation disclosure.
- Bundle fonts locally and handle PGN file-read errors in the UI.
- See VERIFICATION.md for checked paths, commands, evidence and remaining limits.
