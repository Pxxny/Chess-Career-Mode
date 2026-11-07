# Changelog

## 2026-11-07 · Complete: Match Viewer, rated games and tournaments (save version 7)
**Match Viewer** (`src/features/match/`, `src/game/match/`)
- **Chessboard** (`MatchBoard.tsx`): drag and drop (mouse, touch, pen), click-to-move and keyboard play. Legal moves come from **chess.js** through a referee layer (`referee.ts`); the project's own perft-verified rules engine runs beside it for Stockfish, analysis and openings, and takes over if chess.js is missing or fails. The two are compared after every move and any disagreement is logged. Highlights: selected piece, legal targets, last move, check, checkmate, stalemate/draw. Promotion picker, castling and en passant. A read-only review mode when a past move is selected.
- **Game information**: both players with name, title, Elo, nationality and flag; tournament name and round number; time control; who controls each side.
- **Clock** (`clock.ts`, `timeControls.ts`): bullet, blitz, rapid, classical presets plus custom minutes and increment. Only the side to move loses time; increment after each move; flag fall ends the game. Simulated players spend game time that is played back at the chosen speed.
- **Move list**: "1. e4 e5" rows, click any move to review, arrow/Home/End keys and buttons.
- **Evaluation**: Stockfish (the built-in engine if it cannot load) evaluates the position on the board while you play: advantage bar, pawns and centipawns, mate detection (M3, -M2), best line and short position notes. Always White's point of view.
- **Simulate or play**: every match can be played by you, simulated (both sides by the engine, your side at your rating, skills, morale and fatigue), or both. Take control of your side (or the opponent's) at any moment and hand it back. Speeds: real time, brisk, fast-forward, instant. Pause while nobody moves by hand. Leaving a pure simulation lets it finish in the background.
- **Resign, draw offers** (the NPC decides from the position and its character), and **abandoned games**: leaving a game you play with two or more moves is a loss; a game closed by reloading the page is recorded as abandoned on the next start.

**NPC strength model** (`npcProfile.ts`): no longer one strength for everyone. Each NPC plays at an effective Elo from its rating, morale, form and fatigue (which grows over a tournament and with age and training load), shifted per phase by its strong and weak skills (opening, middlegame, endgame). Playing style bends the choice between near-equal engine moves (attackers capture and check, defenders castle and retreat). Opening preparation sets the book depth. Time management: a poor clock manager spends too much early, then plays weaker in time trouble and can lose on time. A hopeless position may be resigned, depending on character.

**Game analysis** (`review.ts`), after every finished game: evaluation graph, move-by-move table, accuracy for both sides, key moments, opening identification (and who left the book first), critical mistakes, missed opportunities, tactical opportunities (found or missed) and better alternatives with the engine's line. Every label comes from engine data, nothing is random:
- Best / Excellent / Good / Inaccuracy / Mistake / Blunder from the win percentage the move gave away (thresholds in `THRESHOLDS`).
- **Brilliant**: best or near-best, the engine's line gives up at least two pawns of material, the position stays sound and was not already won, and the move is clearly better than the second choice.
- **Missed opportunity**: a mistake after the opponent erred (or with a forced mate on the board) that did not take the advantage.
- Accuracy uses the same engine-based formula as practice games.

**Career** (`aftermath.ts`, `gameStore.finishMatch`): a rated game now updates Elo, peak Elo, rated games, win rate, current form, career statistics and opening statistics (these are the existing `recordGame` effects, which no screen called before), plus fatigue and morale, the opponent's rating, form and morale, and a stored match with its analysis. The accuracy of a rated game is set when the analysis finishes. Friendly games change nothing but fatigue.

**Tournaments** (`tournament.ts`): events from the existing schedule can be registered for and played in their week. Swiss pairing, standings with tie-breaks, the other boards simulated from the ratings, prize money by rank, withdrawal (remaining games forfeited). The result is recorded with `recordTournament`.

**Complete page** now has Play, Tournaments, History (replay with full analysis) and Players.

**Changed**: save version 7 adds `matches`, `tournament` and `pendingMatch` (older saves upgrade automatically). `GameResult.analyzed` marks rated games whose analysis is still pending; statistics ignore their accuracy until it is set. `recordGame` accepts `accuracy: null`. New script `npm run test:match`.

**Changed (same day)**: Train > Games > Training Game > "Simulate instead" now plays a real game (engine vs engine at the two players' strengths, `src/game/match/headless.ts`) instead of rolling a result from the ratings, so the game has a full move list. It is recorded as before (no training cost) and analysed in the background. In Games > History every game, simulated ones included, can be opened (Review / Analysis), and a game without analysis has an **Analyse this game** button. Older simulated games (opening moves only) can be analysed too and say so. If a simulation cannot finish, the old ratings-based result is used. Games simulated at Instant speed in Complete are analysed automatically and listed in Complete > History. Checked in `npm run test:match`.

**Fixed (same day)**: in rated and tournament games the player could take control of the opponent and resign for it. `MatchSession.setController` and `resign` now refuse any side but the player's when the game is rated (enforced in the session, and the opponent's control button is hidden). Controlling both sides stays available in friendly games. Covered in `npm run test:match`. Also: tournaments could not be entered. Complete > Tournaments only offered events held in the current week, which is usually none. You can now **register** for any upcoming event whose registration is open (the same list Home shows), pay the fee, cancel with a refund before the event, and **start the tournament in its week** (move the calendar forward with End Day in Train). A missed event loses its fee. Registrations are saved in `save.registrations` (`src/game/match/registration.ts`, checked in `npm run test:match`). Also: in a simulation the page jumped down on every move because the move list used `scrollIntoView`, which also scrolls the page. The list now scrolls only itself.

**Known limits**: chess.js and Stockfish could not be installed where this was built (no network), so the chess.js adapter is checked only against its documented API. `npm run test:match` plays 120 random games through both rule sets and compares every position as soon as chess.js is installed. Run `npm install`, `npm run typecheck` and `npm run test:match` once. Stockfish strength is approximate. Tournament pairings of other boards are simulated from ratings only.

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
