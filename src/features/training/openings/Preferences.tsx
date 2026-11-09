import { diverseOpeningChoices } from "@/game/qol/openingChoices";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import type { OpeningDatabase } from "@/game/openings/database";
import {
  SITUATIONS,
  fitsSituation,
  type SituationDef,
} from "@/game/openings/situations";
import {
  collectOpeningGames,
  perfForEntry,
  type OpeningGameRef,
} from "@/game/openings/stats";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";

function Situation({
  def,
  db,
  refs,
}: {
  def: SituationDef;
  db: OpeningDatabase;
  refs: OpeningGameRef[];
}) {
  const save = useSave();
  const setPreference = useGameStore((s) => s.setPreference);
  const ids = save.repertoire.preferences[def.id] ?? [];
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [limit, setLimit] = useState(40);

  const options = useMemo(() => {
    if (!adding) return [];
    const q = query.trim().toLowerCase();
    return diverseOpeningChoices(
      db.entries.filter(
        (e) =>
          !ids.includes(e.id) &&
          (all || fitsSituation(def, e)) &&
          (!q ||
            e.name.toLowerCase().includes(q) ||
            e.eco.toLowerCase().includes(q)),
      ),
    );
  }, [adding, db, query, all, ids, def]);

  const move = (i: number, d: number) => {
    const next = [...ids];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setPreference(def.id, next);
  };

  return (
    <Card>
      <CardTitle aside={<Badge>{ids.length} chosen</Badge>}>
        {def.label}
      </CardTitle>
      <p className="-mt-2 mb-3 text-sm text-ink-muted">{def.description}</p>
      {ids.length === 0 ? (
        <p className="mb-3 rounded-lg bg-navy-900 px-3 py-2 text-sm text-ink-faint">
          Nothing chosen. In this situation you play freely.
        </p>
      ) : (
        <ol className="mb-3 space-y-1.5">
          {ids.map((id, i) => {
            const e = db.byId.get(id);
            if (!e)
              return (
                <li key={id} className="text-sm text-ink-faint">
                  Removed opening ({id})
                </li>
              );
            const p = perfForEntry(db, refs, e);
            return (
              <li
                key={id}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 sm:flex"
              >
                <span className="w-5 text-xs tabular-nums text-ink-faint">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {e.eco} · {e.name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {p.games === 0
                      ? "Not played yet"
                      : `${p.games} games · ${p.wins}W ${p.draws}D ${p.losses}L · ${p.winRate}% wins`}
                  </span>
                </span>
                <div className="col-start-2 flex gap-1.5 sm:contents">
                  <button
                    type="button"
                    aria-label={`Move ${e.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="h-11 w-11 shrink-0 rounded-lg border border-white/10 text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${e.name} down`}
                    disabled={i === ids.length - 1}
                    onClick={() => move(i, 1)}
                    className="h-11 w-11 shrink-0 rounded-lg border border-white/10 text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${e.name}`}
                    onClick={() =>
                      setPreference(
                        def.id,
                        ids.filter((x) => x !== id),
                      )
                    }
                    className="h-11 w-11 shrink-0 rounded-lg border border-red-400/30 text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {adding ? (
        <div>
          <label htmlFor={`add-${def.id}`} className="sr-only">
            Search openings to add
          </label>
          <input
            id={`add-${def.id}`}
            type="search"
            autoFocus
            placeholder="Search name or ECO code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2 min-h-11 w-full rounded-lg border border-white/10 bg-navy-900 px-3 text-sm text-ink"
          />
          <label className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
              className="accent-gold-500"
            />{" "}
            Show openings that do not fit this situation
          </label>
          <ul
            className="max-h-56 overflow-y-auto rounded-lg border border-white/10"
            aria-label="Openings to add"
          >
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-faint">
                No matching openings.
              </li>
            )}
            {options.slice(0, limit).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPreference(def.id, [...ids, e.id]);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-white/5"
                >
                  <span className="truncate">
                    {e.eco} · {e.name}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {e.side}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {options.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((n) => n + 40)}>
              More opening variations
            </Button>
          )}
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => setAdding(false)}
          >
            Done
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Add opening
        </Button>
      )}
    </Card>
  );
}

export function Preferences({ db }: { db: OpeningDatabase }) {
  const save = useSave();
  const refs = useMemo(() => collectOpeningGames(save, db), [save, db]);
  return (
    <>
      <Card className="mb-4">
        <p className="text-sm text-ink-muted">
          Choose the openings you want to play in each situation, in order of
          preference. The most specific situation that has a matching opening is
          used first (a critical game before an opponent type, an opponent type
          before 1.e4/1.d4, then your general repertoire). Simulated games and
          your AI use these choices to decide which opening is played.
        </p>
        <p className="mt-2 text-sm text-gold-300">
          A preferred opening never raises your win rate: results depend only on
          the ratings. Preferences decide which opening is played, and your
          statistics then show how it really performs.
        </p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {SITUATIONS.map((s) => (
          <Situation key={s.id} def={s} db={db} refs={refs} />
        ))}
      </div>
    </>
  );
}
