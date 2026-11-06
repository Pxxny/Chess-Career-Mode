# Verification — 2026-11-06

Reviewed and repaired the supplied `chess-career-mode-latest.zip` with real project dependencies. No React shims or replacement application libraries were used.

Environment: Node.js 24.22.1, npm 11.9.0, Chromium (system installation), React 18.3.1, TypeScript 5.6.3, Vite 5.4.21, stockfish 16.0.0. Exact versions are pinned in package-lock.json.

## Results for the five requested areas

| Area | Result | Evidence |
| --- | --- | --- |
| Install / typecheck / production build | PASS | npm install, real tsc, vite build; browser test sources separately typechecked |
| Real Stockfish / fallback | PASS | Real JS/WASM worker, legal moves at 500/1400/2300/3000/3200/full; missing manifest/WASM switches promptly to built-in with accurate status |
| Main game paths / records | PASS | Actual character wizard, Training Game, Engine, simulated rated Blitz; moves, clocks, live feedback, resign, analysis, history review; Performance shows 3 games, 0% wins, 3 analyses matching saved games |
| Legacy save / persistence / PGN | PASS | v3/v4/v5 pure migrations; real IndexedDB v5 migration preserving career; active-game refresh records one resignation; second refresh adds nothing; file/paste import, PGN download, collections, removal and Games-first imported-line hydration |
| Mobile / disclosure | PASS | Touch-emulated production Chromium at 320/390/768px; 30 view/width checks; document does not overflow; performance table scrolls internally; Blitz explicitly discloses simulated opponents |

Final production browser suite: **5 passed (47.2 seconds)**.

Also passed: `test:world`, `test:play`, `test:data`, `test:engine`, `test:session`. Logs are in `artifacts/test-*.log`. Playwright HTML report is included in `playwright-report/`; run `npx playwright show-report` after installing dependencies.

Screenshots: `artifacts/desktop-analysis.png`, `artifacts/desktop-performance.png`, and `artifacts/mobile/`. The mobile JSON/screenshots were captured against the real dev application before the final switch to locally bundled fonts; the production mobile regression also passed after that switch.

## Repairs

- Real creation wizard crash: React effect returned the result of scrollIntoView (a Promise in this Chromium); now effects return no DOM method result.
- Stockfish startup/search lifecycle, error listeners, cancellation/disposal, timer cleanup and fallback label. Elo 3000–3200 no longer silently enables unrestricted full strength.
- PGN results inside variations, escaped/bracketed tags, unreadable tokens, custom-FEN exclusion from standard opening counts, file-read failure feedback.
- Imported opening hydration before Games, serialized edits and atomic storage of source lines/statistics.
- Save internal version upgraded with schema; interrupted game snapshots recover once after reload and clear atomically on normal finish.
- Correct Black-first custom-FEN analysis/feedback and move numbering; guard stale/illegal/late moves and career reset races; freeze finished clocks; prune takeback feedback; correct outstanding analysis accounting.
- Responsive opening-detail grids, headers/badges, preference controls and promotion picker; internal chart/table scroll and touch/focus readouts; in-game simulation disclosure.
- Fonts bundled from npm instead of Google Fonts runtime requests, avoiding external certificate/network dependency.

## Practical limits

- Online Blitz remains simulated multiplayer; this review did not add a server.
- Stockfish 16 uses the npm build's default classical evaluation (`Use NNUE=false`), without an additional neural-network download. Human Elo settings remain approximate.
- Browser game flow coverage includes resignation endings; checkmate, draw rules and position legality are covered by the logic suites. This is not exhaustive testing of every possible game or browser.
- Interrupted games recover the last snapshot committed to IndexedDB. A browser/process crash before a write commits can lose that latest move; this is not server-backed storage. Recovered games have no automatic post-game analysis, though their moves remain reviewable.
- Versions 3–5 upgrade in place. The project's existing policy discards versions 1–2; that policy was not changed.
- Production build succeeds with Vite's existing large-chunk warning (~1.4 MB JavaScript, ~350 KB gzip). Code splitting remains a possible future performance improvement.

## Run

```sh
npm ci
npm run build
npm run dev
```

All verification commands and Chromium installation options are in README.md. No node_modules, dist, credentials, user saves or git history are included in the delivery ZIP. Generated engine/city assets, test source, report and screenshots are included.
