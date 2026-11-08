# Performance evidence

`logs/` contains the before/after differential checks, benchmark samples,
command output and an independent source review. Final production browser
results are in `final-browser-test-e2e.log` (6/6 passed). The earlier browser
failure log is retained to explain the stale assertions fixed in this release.
See the project-root `PERFORMANCE.md` for the final interpretation and limits.

`bench/` contains the five unchanged comparison scripts used from the supplied
perf-kit. They compare two complete projects, not two arbitrary files.
To reproduce, prepare this layout outside this project:

```text
compare/
  orig/       contents of the latest input ZIP's chess-career-mode directory
  patched/    contents of this performance release's chess-career-mode directory
  bench/      copy of this directory's bench/
```

Install dependencies with `npm ci` in each project. From `compare/bench`, run
the following commands one at a time with other CPU-heavy work stopped:

```sh
node --experimental-strip-types --import ../orig/scripts/register-alias.mjs equiv_board.ts
node --experimental-strip-types --import ../patched/scripts/register-alias.mjs equiv_rules.ts
node --experimental-strip-types --import ../orig/scripts/register-alias.mjs perf_board.ts ../orig
node --experimental-strip-types --import ../patched/scripts/register-alias.mjs perf_board.ts ../patched
node --experimental-strip-types --import ../orig/scripts/register-alias.mjs gc.ts ../orig
node --experimental-strip-types --import ../patched/scripts/register-alias.mjs gc.ts ../patched
node --experimental-strip-types --import ../orig/scripts/register-alias.mjs engine.ts ../orig
node --experimental-strip-types --import ../patched/scripts/register-alias.mjs engine.ts ../patched
```

`equiv_rules.ts` also times five batches of 60 seeded games after warm-up.
`engine.ts` includes both fixed-depth and wall-clock-limited searches; the
latter may legitimately choose different moves after optimization.

Inside the released project alone, `npm run bench:chess` verifies reference
perft counts and prints seven measured samples after warm-up. Its numbers
depend on machine load. `npm run test:chess-cache` checks public mutation and
object-identity contracts as well as frozen inputs.

`performance-code.patch` is a supplemental diff for application code,
package scripts and tests against the latest input ZIP. Documentation and
generated evidence are supplied in the full ZIP separately. Do not apply the
diff again to this already-patched release.

Render/StrictMode/actual dev UI results and phone screenshots are under the
project-root `artifacts/` directory. `tests/match-clock.browser.mjs` documents
its development-server setup. Production regression tests run through
`npm run build` followed by `npm run test:e2e`.
