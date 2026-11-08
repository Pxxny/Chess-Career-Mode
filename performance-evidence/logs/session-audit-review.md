# Session and chess-core regression review

Reviewed the final performance changes read-only; no source files were edited by this reviewer. Evidence artifacts were saved afterward at the parent agent's request.

## Conclusion

No further required fixes or confirmed regressions were found in the reviewed changes. This is a bounded review and sampled equivalence check, not a proof of all possible positions or UI event orderings.

## Reviewed files and evidence

- `chess-career-mode/src/game/chess/rules.ts:11-23`: the private legal-move cache compares every Position scalar plus board length and contents before reusing an entry.
- `chess-career-mode/src/game/chess/rules.ts:104-113`: default `parseUci` and `movesBetween` clone public Move results; an explicitly supplied legal list preserves its previous object-identity contract.
- `chess-career-mode/src/game/chess/board.ts:219-251`: `applyMove` writes only to a copied board.
- `chess-career-mode/src/game/chess/board.ts:254-289`: legal-move generation uses a private scratch board and restores candidate changes.
- `chess-career-mode/src/game/play/objectives.ts:42-54`: odds setup copies the parsed board before modifying squares.
- `chess-career-mode/src/game/engine/builtin.ts:77-96`: move ordering sorts fresh arrays from public `board.legalMoves`, not arrays held by the private rules cache.
- `chess-career-mode/src/features/match/MatchViewer.tsx:46-53`: only an active timed player card redraws on its interval; cleanup tracks both session and active state.
- `chess-career-mode/src/features/match/MatchViewer.tsx:139` and `:156`: card activity comes from the running status and current turn.
- `chess-career-mode/src/features/match/useMatchSession.ts:34-46`: session snapshots remain subscribed; the removed display tick has one consumer, MatchViewer.
- `chess-career-mode/src/game/match/session.ts:420-437`, `:493-508`, and `:595-619`: moves, pause/resume and finish emit snapshots, refreshing stopped clock values and card activity.

The repository call-path search found no current application consumer that mutates public Position fields or Move fields returned by these functions. The guard and cloned results also protect callers that do use the existing mutable API.

## Runtime check

`session-audit-probe.stdin.mjs` contains the inline probe source and its run command. `session-audit-probe.output.txt` contains the raw stdout from the completed run (exit status 0).

The deterministic sample covered 2,283 positions across 20 random games, up to 120 plies each. Positions and board arrays were frozen. Current and pristine code agreed on exact legal-move order and flags, every legal child's applied position, and SAN. The probe also checked no input mutation, mutable board/turn cache invalidation, cloned public Move results and explicit-list identity preservation.

Clock lifecycle conclusions above are based on source control-flow review; this reviewer did not run a new browser test.
