# Changelog

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
