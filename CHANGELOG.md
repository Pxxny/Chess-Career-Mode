# Changelog

## 2026-11-09 · Player Directory and NPC Relationships (save version 15)

- Include the active player once in Player directory with searchable real identity/country/tier/Elo, a pinned own-profile shortcut and consistent displayed world ranks that include the player. Add a detailed player profile based on saved identity, skills, repertoire, form, coach, training and tournament results.
- Add per-career, stable-ID NPC relationships with independent familiarity and closeness. Rated games and co-attendance at traditional/esports events build recognition without granting friendship. Seed familiarity from retained old-save history without fabricating conversations or friendships.
- Add NPC Actions: talk, study together and invite to a friendly game. Respect NPC availability, personality/mood, rating differences, AP/hours, active games, calendar simulation, daily approaches and deterministic responses. Shared study uses existing XP/session/yearly-tracking rules. Retired living players can socialize; era-inactive or deceased players cannot.
- Connect accepted friendly invitations to the normal chess match engine, with configurable colour/time control and an unrated result. Retain invitation context in checkpoints and match records, require meaningful human participation for friendship credit and prevent duplicate rewards. Cancelling/abandoning/only simulating does not grow closeness; early exits and reloads release pending invitations safely.
- Bound relationship/log storage and weekly closeness gains; apply inactivity decay once per elapsed period. Add persisted interaction feedback, action/cooldown explanations, relationship labels and profile counters.
- Add social logic and real-browser regressions, including mobile player/NPC profiles, repeated competitive meetings, real friendly chess moves and results, unchanged Elo, persistence and early-exit recovery. Preserve the full project, Vercel rewrite, world simulation, annual reports and two Markdown documents.

## 2026-11-09 · Living World and Year in Review (save version 14)

- Expand the fictional foreign circuit to three events every week, 156 per game year, across 38 host countries. Add accessible rapid/blitz/open events and higher-level international challengers while retaining home events, normal travel costs, registration gates and clearly sourced historical references.
- Reconcile every NPC's result from completed player tournaments and esports competitions into their persistent history. Include placement, points, rounds, played W/D/L and rating information. Repair missing history from retained archives without inventing unavailable old games or retroactive archive ratings; deduplicate by event ID across reloads.
- Extend the existing weekly World Circuit into multiple three-round fields with rotating participation and regular elite opportunities. Record all entrants, simulate boards through the shared prediction model, update Elo/form/morale from actual outcomes, refresh world ranks and keep legends' career rating adjustments across calendar syncs. Busy traditional/esports participants do not enter simultaneous background events.
- Add year-end reports and a Career → Year in review archive. Persist annual counters independently of trimmed game/training logs and summarize Elo, peak, wins/draws/losses, tournaments, wins/podiums, esports, practice, training, cash, reputation, titles, trophies and skill changes. Queue reports across calendar advances and preserve dismissal. Upgrade old careers in place, labeling incomplete first-year coverage.
- Keep existing draw rules and game outcomes; add explicit regression coverage for stalemate, insufficient material, repetition, fifty-move draws, simulated draws, history persistence, eight-week participation and annual totals beyond log limits. Add production browser checks for NPC results/Magnus and mobile annual reports.
- Keep the Vercel SPA rewrite and the two-file Markdown documentation layout.

## 2026-11-09 · Vercel direct links and documentation cleanup

- Add a Vite deployment configuration and SPA rewrite in `vercel.json` so direct links and refreshes on `/complete` and other React Router pages load the app instead of returning Vercel's 404.
- Keep only the root `README.md` and `CHANGELOG.md` as project Markdown. Remove older standalone guides/reports and update README references and deployment instructions.
- Preserve Cburnett artwork attribution as `ATTRIBUTION.txt` with its existing GPL license. Generate Stockfish source/upstream notices as `.txt` and clean up their former generated Markdown filenames on reinstall.

## 2026-11-09 · Match prediction placement; remove Elo calculator

- Show the match prediction inside the tournament "Upcoming match" card, directly above Play / Simulate, so every round shows its forecast before the game starts. Individual, practice, Blitz, engine and esports match pages keep their pre-start forecast.
- Remove the independent Elo calculator: the `/matchup` route, the save-slot link, the Career → Match predictions "Elo calculator" tab and `EloCalculator.tsx`. Model settings, snapshots and calibration are unchanged.
- Update the prediction browser tests and guides accordingly.

## 2026-11-08 · Match Prediction and Calibration (save version 13)

- Add a shared deterministic prediction engine: exact Elo expected score, feasible W/D/L probabilities, configurable rating/time/style draw priors, seven matchup classifications and exact 100.00% displayed totals using largest-remainder rounding. Reserve a configurable share of underdog expected score for decisive wins; remove the old fixed win floor and inconsistent draw/win clamps.
- Add a separate bounded context forecast using current/peak rating, ten skill/attribute inputs, form, morale, fatigue, preparation quality, opening familiarity, colour, pressure and head-to-head residuals. Keep Elo primary with a default ±100 Elo total cap. Clearly distinguish real player attributes, NPC estimates and unknown rating-only inputs. Respect Online Blitz's separate rating, peak, form and head-to-head history.
- Show green/yellow/red odds bars, expected score, rating difference, confidence, historical sample support and factor explanations before individual, tournament, practice and esports games; show upcoming Home forecasts and Swiss pairing probabilities. Bind preparation and scouting forecasts to their actual event/opponent, including esports boards.
- Freeze detached immutable snapshots before the first engine/human move and persist them through checkpoints, completed records and reload recovery. Compare original odds against actual results in replay, tournament player histories, opening histories and Career statistics. Never invent forecasts for old completed games or byes.
- Add seven-dimensional, bounded historical draw calibration with minimum sample counts, residual shrinkage, protected coarse groups and separate played/simulated support. Batch NPC observations after results; never leak a game's result into its own forecast. Process only new tournament rounds so long events remain idempotent after dedupe history rotates.
- Route NPC tournament, esports, national-team and weekly circuit regular boards through the same prediction principles. Weekly knockout circuits can draw before a separate deciding tiebreak, and their recorded board scores reflect those draws.
- Add Career → Match predictions: lifetime multiclass Brier (sum, range 0–2), natural-log loss, top-choice accuracy, reliability bins, calibration error, recent original forecasts/results, biggest Elo upset and least-likely career/NPC victories. Keep career, practice and NPC samples separate. Byes/forfeits/interrupted games/custom-FEN training do not teach draw rates; completed abandonments still retain their actual loss for scoring.
- Add an independent Elo calculator at `/matchup`, accessible before character creation and inside Career. Validate empty/nonfinite/out-of-range ratings. Expose balanced model parameters and reset controls; settings changes affect future forecasts only.
- Bound recent detailed histories, calibration cells, dedupe IDs and upset records. Compact archived NPC tournament forecasts while preserving original probabilities and conditions. Prevent repeated results from charging resources/ratings twice. Cancel a pending training simulation on unmount and guard against writing its result to another career.
- Upgrade saves to version 13 without deleting characters, ratings, tournaments or opening preferences. Add mathematical/property, Monte Carlo, calibration, persistence, archive, cancellation, esports preparation and browser tests; retain existing tests and update legacy statistical/recovery fixtures for the new frozen forecast contract. Include guide/report and verification logs.


## 2026-11-08 · Multi-Day Tournaments and Esports (save version 12)

- Add Official/Unofficial, duration (single/multiple/3/7 days), round-robin and BO3 options to the suitable-tournament finder. Remove the repeated “(career simulation)” suffix from organizer display names.
- Add three non-overlapping rotations per calendar month (36 per game year): a 3-day single round robin, a 7-day single round robin and a 7-day BO3 series against every opponent. Keep existing rapid/blitz single-day circuits and their daily itineraries. Specify exact starting days for the new events.
- Display per-player daily maximum game counts and HH:MM slots, including rest days. Keep a BO3 series on the same match day, reverse colours in its second game, skip game three after 2–0, and resolve a tied three-game series with a rating-based rapid decider. Rank BO3 by series wins; retain individual game points/results separately.
- Connect future-day round availability to the actual career calendar. Add “Advance to next match day”, apply normal sleep/AP/fatigue/calendar rules, forfeit missed-day games, and warn before manually ending a day with unplayed fixtures. Prevent ending a day during an active match and reject stale previous-round checkpoints during recovery.
- Add an Esports circuit switch under Complete → Tournament without changing the six primary Complete menus. Store Traditional / Esports / Mixed focus and expose a Home shortcut; do not restrict access to the other circuit.
- Add D/C/B/A/S Elo bands (A ends 2699, S starts 2700), weekly cups, open qualifiers and monthly finals, in fictional Duo/Trio team formats inspired by Liquipedia category organization. Monthly entry requires a same-tier top-two qualifier pass valid for 42 days; D qualifiers also admit developing players below 1800 with event-only pickup teams.
- Support Free Agency, skill/form-based weekly club offers, rare global-elite interest (at most 0.8% per eligible club/week), 12-week contracts and once-only weekly salaries. Persist offer checks and expiries so reloads do not reroll them.
- Allow creating an owned Duo/Trio for $100, inviting active NPCs, accepting refusals and observing a 14-day approach cooldown, releasing teammates and dissolving/leaving teams. Lock roster changes while booked or playing; use current active roster/rounded average Elo for eligibility and reject incomplete squads.
- Register esports teams separately with refunds before the event day. Check overlaps against traditional bookings/active events and other esports events. Revalidate player and team Elo at the starting day; cancel/refund an entry when rating changes move it outside the tier, preventing lower-tier prize farming.
- Run the player’s esports board through the real MatchSession/engine/referee, with take-control simulation, checkpoints, analysis and retained replay. Settle other team boards from Elo, aggregate fixture wins/draws, award match/board points and pay the player’s equal share of the team prize once. Keep esports standings/bookings/history separate while using shared career Elo and date.
- Extend calendar simulation/training plans to esports bookings and exact starting days, stopping at the earliest booking across both circuits. Keep the tournament-specific itinerary clock off Home/ordinary career screens.
- Cache active NPC counts/lookups by immutable population-array identity and build the recruit market only when viewing an owned team. Preserve existing chess-core/clock-render performance work and bundled SVG assets.
- Add test:esports covering calendars, full rotations, BO3 clinches/deciders, exact-day gates, tier boundaries/refunds, squad uniqueness, two-way schedule conflicts, recruitment refusal/cooldown, offers/salaries, persistence, real store match progression and seven-day calendar movement. Add three production browser scenarios. Update older fixtures to select available Swiss entries, include travel fees and use an exact event starting day where applicable.

## 2026-11-08 · National Names, Birth Place, Tournament Entries and SVG Boards (save version 11)

- Split Thai, Indonesian, Malaysian and Filipino naming pools; add country-specific pools across Asia, Europe and Africa and expand frequently used global cultures. Balance given/family-name reuse, keep gendered surname forms where applicable, and ensure unique full names across global/local/annual cohorts without fake initials or Jr. suffixes.
- Upgrade existing fictional NPC names and birth-place fields additively; keep IDs, Elo, dates, progression and results. Keep real legend names and avoid inventing undocumented historical birth places. Synchronize stable-ID NPC references in active/archived standings, retained games and pending matches; leave free-text historical news unchanged.
- Add independently configurable player birth country/town to creation, confirmation, persistence and Profile. Default to the chosen home city when requested. Keep birth place unchanged on moves/federation transfers; older saves use marked career-origin data.
- Replace platform Unicode pieces with the same twelve local Cburnett SVG assets in practice/career games, analysis, replay, opening boards, drag ghosts, promotions and side panels. Include artwork source attribution and GPLv2+ license.
- Highlight from/to squares for engine-labeled blunders and brilliant moves with dark-red ?? / light-blue !! badges. Keep markers synchronized with the selected replay ply and clear them at the initial position. Add provisional live career labels when both position evaluations exist; final review replaces them. Practice analysis/live feedback support the same sacrifice / multi-PV-gap criteria for brilliance, without random awards.
- Add deterministic daily NPC arrivals over a 35–63-day registration window. Popular events can fill before the deadline without reserving an unpaid player seat. Central guards reject full/late/duplicate entries. A paid entry reserves one seat, uses a stable planned NPC roster and starts with actual arrivals by closing day; compatible legacy entries keep their original field.
- Add simulated organizer names and Official / Unofficial classification to scheduled/current tournaments. Distinguish game organizer data from sourced FIDE schedule references.
- Add an accessible suitable-tournament finder for inclusive start-week, minimum-entry-Elo and participant-capacity ranges, continent, and current availability (seats, eligibility, deadline, money and schedule). Reset/clear filters explicitly.
- Add two fictional annual Next Generation Nations Showcases: up to five active under-26 players per country and 50 delegations, chosen by rating and delegation strength, playing ten Swiss rounds. Block public registration in the store/core and expose only organizer invitation acceptance for selected players. Snapshot accepted delegations and show invitations on Home only after real selection.
- Cache eligible population totals by immutable NPC-array identity, keeping whole-catalogue capacity/filter passes inexpensive without storing thousands of daily registration writes.
- Add test:circuit and four production browser scenarios covering creation/reload, full fields and invitations, board annotations and consistent loaded SVGs under Android/iPhone emulation. Update older registration tests to check final daily arrivals rather than an always-full N-1 preview. Preserve existing Swiss pairing behavior and previously retained features.

## 2026-11-08 · QoL, World Circuit and UI (save version 10)

- Make Profile → Stats favorite openings clickable. Show the matching rated-career games and retained replays, without inventing moves for old results.
- Make every tournament standing name clickable, including the player. Show round/opponent/colour and W/L/D from the selected participant's perspective, scoped to that event. Wins are green, losses red and draws grey; link genuine retained match replays for either participant.
- Add a pre-simulation daily training planner to paid registrations. Use the normal training and End Day rules, allow rest-only plans, respect AP/money/hours/fatigue/requirements, support full-day camps and existing-game analysis, stop at the earliest registered competition, expose progress/cancellation and guard concurrent calendar commands and cross-career writes.
- Fix repertoire choices being hidden behind the first 100 database rows and Preferences behind 40 rows. Offer diverse family representatives, family search/selection, side-aware choices and incremental access to every matching variation across A00–E99.
- Add four non-tournament income jobs under Train → Work: club assistant, columnist, private lessons and simultaneous exhibitions. Apply actual AP/hours/fatigue, Elo/reputation unlocks, one occurrence per job per day, two jobs total per day and ledger entries.
- Add 60 sourced FIDE-listed references from 11 countries, observed 2026-11-08, with individual source URLs and available venue/date/time-control facts. Keep career rules, fields, prizes and results explicitly simulated; other-year editions are labelled career editions, not historical records.
- Add year-round home/foreign club circuits, replace repetitive generated city-based names with series names, and add location/source filters. The sample 52-week calendar contains about 160 events, depending on career/date. Price travel at $0 / $60 / $120 for home / same-continent / intercontinental events, snapshot the paid estimate, and refund eligible cancelled bookings in full.
- Expand global fictional NPCs from 1,200 to 4,000 and add up to 80 seeded local competitors per home cohort. Local events prioritize city/country entrants; nationality-restricted nationals remain domestic. Upgrade compatible old NPC worlds additively, retaining evolved identities, ratings and IDs. Recover the current-home cohort after reload; add one new cohort after a federation move without duplicating it.
- Add progression-gated nationality/federation representation changes in Profile: 1800 Elo, 25 rated games, $250 non-refundable fee, 30 game-day processing and a one-game-year cooldown. Preserve birthplace and past games, defer completion during active play, relocate the home city, reset membership and refund incompatible national entries.
- Display the current game date on Home and add a Work & income shortcut.
- Use the same underline navigation across main and secondary menus. Give nested tabs unique accessible IDs; keep selected options visible with horizontal scrolling only. Use Manrope for titles/body, warm readable text, charcoal surfaces and muted sage accents; remove the radial background gradient.
- Add close controls, keyboard focus containment/restoration and Escape handling to shared dialogs.
- Add `npm run test:qol` and production browser scenarios for the new flows, history/replay scoping, country processing, cancellation and legacy world upgrades. Update existing tests to use accessible menu selectors and the actual configured round count. Check Swiss repeated-bye fallback against independent pairing feasibility rather than assuming every future pairing graph permits a fresh bye.
- Preserve the previous custom Swiss engine and its documented limitations; this release does not claim FIDE Dutch compliance.

## 2026-11-08 · Complete: Tournament, Swiss and Prepare (save version 9)

- Restructure Complete into exactly six top-level submenus: Tournament, Swiss, Prepare, Rankings, League and History. Keep individual matches, Federation and national teams under Tournament; coaching under Prepare; recorded matches, archived standings/pairings and news under History. Rankings retains the NPC directory; League shows the existing career rating tier.
- Replace the tournament list with current-event management, world rank and event standing, upcoming opponent, full standings/pairings, registration status, entry requirements, prize fund and a searchable 52-week calendar. Cards include venue/country, start/end dates, deadline, fee, minimum Elo, field cap, rounds, time control, format, prize, prestige and qualification conditions. Long tables scroll within their cards on phones.
- Add all twelve requested competition categories plus fictional events. Career schedules, fields, qualification rules, fees, prizes and results are explicitly simulated. Verified FIDE Candidates 2024 dates (3–23 April), Toronto venue and eight-player double round-robin format are used in the 2024 career edition and cited separately. Time controls/entry rules remain adapted; no generated result is presented as historical fact.
- Enforce registration against the current save date, not stale relative countdowns. Validate fees and capacity; prevent duplicate entries, duplicate prize payouts and starting-week conflicts. Snapshot the NPC invitations and entry requirements. Enforce Elo, reputation, title, prior qualification, nationality, league and federation requirements when relevant; preserve legacy registrations. Late registrations are blocked, missed registrations lose their fee, and early cancellation refunds it.
- Add deterministic Swiss matching using Edmonds' blossom algorithm: find a complete pairing without repeat opponents whenever feasible, prefer score groups and balanced colours, and assign byes preferentially to low-scoring players without prior byes. Expose Buchholz Cut 1, Buchholz, Sonneborn–Berger and wins; use a documented virtual-opponent convention for bye tiebreaks. This is game Swiss software, not FIDE-certified Dutch pairing software.
- Implement circle-method round-robin and double round-robin, alternating-colour championship matches with early clinch, and knockout brackets with power-of-two byes and simulated rapid tiebreaks. Round-robin rest rounds award zero points. National teams retain the separate four-board, up-to-eight-team rating simulation. Selected players must register and play during the event week through every entry path; unselected members retain a spectator exhibition/results view.
- Add Prepare's Preparation, Scout Opponent, Game Plan and Repertoire tabs. Five approaches change the simulator's tie-breaking preferences among sound candidate moves. Play Fast / Normal / Think Deeply scale local search/clock time by 0.65 / 1 / 1.5 and prepare 4 / 8 / 12 half-moves. "Cloud usage" is labelled as local simulation, with no external service.
- Preparation spends 1/2/3 AP, 1/2/3 game hours and $10/$20/$40, adding two fatigue per hour. Apply an immutable paid snapshot to its registered individual event only; unpaid draft edits do not affect play. Team events use their separate rating model and do not charge for ineffective individual move preparation.
- Add ordered White/Black repertoires, explicit responses to 1.e4/d4/c4/Nf3, and backup variations from the opening database. Responses take priority over general Black lines; backups are used when primary prefixes no longer match. These are actual legal book moves, not a win-rate bonus.
- Add paid opponent scouting (1 AP, $10, 1 hour) with public Elo/style and unlocked favourite openings, real form/morale indices, strengths/weaknesses and recorded results against the player. Prevent charging twice for the same report in an event.
- Add optional early draw agreement in simulated individual tournament play: at least 20 half-moves, evaluation within 25 cp, a non-stubborn opponent, and the player leading/sharing the lead in the final two rounds. Manual play retains existing draw controls.
- Archive finished events (last 30) and award qualification paths valid through the following two calendar years. Withdrawn or expired events award no prize or qualification; overdue unplayed rounds are forfeited when End Day advances past the event's end week.
- Guard background matches with per-career transient leases and reject stale round completions. Keep callbacks/checkpoints/analysis bound to their original career so a detached simulation cannot write into a different save slot. Release leases on completed or void games.
- Initialize new saves with the same Complete defaults used by migration; migration stays idempotent and preserves games, ratings and opening preferences. Migrate old saves to version 9 without deleting careers. Add `npm run test:complete` and production-browser coverage for registration spam, resource costs, repertoire/scouting, reload persistence, verified historical dates and real Swiss play. Update prior browser tests for the new navigation.

## 2026-11-08 · Career world expansion (save version 8)
- Restore `clearSave` compatibility for older ResetSaveButton files; delete only the active character and its NPC world. Include a replacement component with confirmation/error handling.
- Add 50 available Look choices per gender: 10 hairstyles, 10 outfits, 10 shared accessories and 20 shared colors. Gender-aware Randomize; new choices render in SVG and persist normally.
- Expand the legend database from 23 to 82, including 17 women and 39 players born in 1980 or later. Added rating curves are game estimates. Merge missing legends into existing career databases without rebuilding evolved fictional players.
- Add deterministic annual cohorts of 100–250 new adult competitors, with stable year-based IDs; fictional players retire at 65. Cohorts and retirement persist across reloads and remain separate per career.
- Add simulated weekly eight-player circuit results and upset news, population news, coach/membership news, national cup results, and winner/upset reporting from actual individual tournament results.
- Add Federation directory, annual membership ($35), and 10% member discount on coaching.
- Add a simulated annual National Team Cup: four boards, up to eight teams, round robin, top-rated national selections, vacant-board forfeits, standings and board results. Selected player spends 2 AP; individual Elo is unchanged. Results and prize are persisted once per year.
- Add 12 fictional coaches with per-game, 7-game-day and 30-game-day contracts; paid fees, expiry, cancellation, session XP bonuses and capped post-game specialty lessons. Short resignation farming does not earn lessons: a game needs 12 plies or checkmate, and lessons cap at four per game day.
- Add lazy tournament entrant previews and persistent roster snapshots. Retired entrants withdraw; if nobody remains, cancel and refund instead of awarding a one-person tournament win.
- Add a synchronous wizard creation lock, preventing repeated clicks from generating orphan NPC worlds.
- Add meaningful system and real-browser expansion tests. Stabilize the mobile layout test with a completed real game instead of a still-running background simulation.

## 2026-11-08 · Date of birth, realistic NPC ages, three character slots
- **Date of birth** in character creation (Identity step: day, month, year). The age on the first day of the career follows from it and the start year; the Start year step refuses a combination that makes the player younger than `player.minStartAge` (8) or older than `player.maxStartAge` (60). Without a date of birth the old default (14 on the first day) is used. The age then moves up on the real birthday.
- **NPC ages** (`data/chess/ages.ts`, `data/chess/tiers.ts`, `game/npc/fictional.ts`): adults follow a bell curve per league (`ageMean`, `ageSd`) instead of a skewed range, and each league has a small `youthShare` of players under 18, mostly teenagers with the occasional child. A rating ceiling by age keeps prodigies possible but believable (a nine-year-old tops out near 1900, a 13-year-old near 2500). Existing careers keep the NPCs they already have; new careers get the new ages.
- **Save slots**: up to three characters, each a separate career with its own NPC world. A new "Your characters" screen opens whenever no character is open (Profile > Switch or create character, or a fresh browser); each slot can be continued, deleted (with its NPC world) or filled with a new character. A single save from before this change becomes slot 1 with its NPC world. IndexedDB schema 4 adds the `careerNpcs` store.
- Tests: `npm run test:characters` (date of birth, slots, per-character NPC worlds) and `npm run test:ages`; `tests/slots.spec.ts` covers the slot screens in the browser (not run in the build environment).

## 2026-11-07 · Chess and Match Viewer performance
- Reduce temporary arrays, closures and position copies in chess move generation. Each `legalMoves` call uses its own scratch board; the caller's position is left unchanged.
- Reuse legal moves across rule calls with a private WeakMap cache. Position mutations invalidate the cache; public move results remain independent, and explicit `parseUci` move arrays keep their existing reference behavior.
- Update only the active timed player card every 100 ms. The Match Viewer, board and move list now update on session events instead of clock-display ticks. Session timekeeping and flag-fall checks are unchanged.
- Fix a pre-existing development StrictMode lifecycle bug: effect replay no longer abandons/disposes a newly started match. Real unmounts still release the session after a guarded microtask.
- Preserve the latest eight-row board layout fix, save schema, rewards, AP costs and engine search limits.
- Add `npm run bench:chess`, `npm run test:chess-cache` and browser clock/layout regressions. See `PERFORMANCE.md` for measured results and verification limits.
- Refresh stale browser assertions for the existing Analysis button and configured save version; gameplay and migration behavior are unchanged by those test updates.

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
