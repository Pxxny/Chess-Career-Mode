import { useMemo, useState } from "react";
import type { OpeningDatabase } from "@/game/openings/database";
import type { Side } from "@/game/openings/types";
import { diverseOpeningChoices } from "@/game/qol/openingChoices";
import { Button } from "@/components/ui";
export function RepertoirePicker({
  db,
  label,
  query,
  side,
  first,
  exclude,
  onPick,
  disabled,
}: {
  db: OpeningDatabase;
  label: string;
  query: string;
  side?: Side;
  first?: string;
  exclude: string[];
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  const [family, setFamily] = useState(""),
    [limit, setLimit] = useState(80);
  const eligible = useMemo(
    () =>
      db.entries.filter(
        (e) => (!side || e.side === side) && (!first || e.moves[0] === first),
      ),
    [db, side, first],
  );
  const families = useMemo(
    () => [...new Set(eligible.map((e) => e.family))].sort(),
    [eligible],
  );
  const choices = useMemo(
    () =>
      diverseOpeningChoices(
        eligible.filter(
          (e) =>
            (!family || e.family === family) &&
            `${e.eco} ${e.name}`.toLowerCase().includes(query.toLowerCase()) &&
            !exclude.includes(e.id),
        ),
      ),
    [eligible, family, query, exclude.join("|")],
  );
  return (
    <div className="space-y-2">
      <select
        aria-label={`Opening family for ${label}`}
        value={family}
        className="w-full min-w-0 rounded-lg bg-navy-700 p-2 text-xs text-ink"
        onChange={(e) => {
          setFamily(e.target.value);
          setLimit(80);
        }}
      >
        <option value="">All families ({families.length})</option>
        {families.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
      <select
        aria-label={`Add ${label}`}
        value=""
        disabled={disabled}
        className="w-full min-w-0 rounded-lg bg-navy-700 p-2 text-xs text-ink"
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      >
        <option value="">Choose opening or variation…</option>
        {choices.slice(0, limit).map((e) => (
          <option key={e.id} value={e.id}>
            {e.eco} · {e.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-muted">
        {choices.length} matching lines · {Math.min(limit, choices.length)}{" "}
        shown. Choose a family or search to narrow the list.
      </p>
      {choices.length > limit && (
        <Button
          variant="secondary"
          className="text-xs"
          onClick={() => setLimit((n) => n + 80)}
        >
          More variations for {label}
        </Button>
      )}
    </div>
  );
}
